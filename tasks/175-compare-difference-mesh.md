---
id: 175
title: 比較の差分を陰影付きの実メッシュとして生成・描画し、シェーダ重ね描きを撤去する
feature: compare
depends_on: [174]
owns: [web/src/features/compare/difference-material.ts, web/src/features/compare/difference-mesh.ts, web/src/features/compare/overlay.ts, web/src/features/compare/overlay-geometry.ts, web/src/features/compare/overlay-material.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/compare-difference-material.test.ts, web/tests/compare-difference-mesh.test.ts, web/tests/compare-overlay.test.ts, web/tests/compare-overlay-shader.test.ts, web/tests/compare-overlay-color.test.ts, web/tests/compare-rig.test.ts, web/tests/compare-target-surface.test.ts, web/tests/viewer-colors.test.ts, web/tests/outliner-highlight.test.ts]
reads: [web/src/features/compare/difference-geometry.ts, web/src/features/compare/deviation.ts, web/src/features/compare/target-surface.ts, web/src/features/viewer/mesh-display.ts, web/src/features/theme/viewer-colors.ts, web/src/store/display.ts, shared/src/types.ts, shared/src/compare.ts, web/tests/summary-coverage.test.ts, web/tests/compare-visibility.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
174 の `buildDifferenceGeometry` で切り出した差分パッチを、ライトの影響を受ける不透明な実メッシュとして
対象 Mesh の子に置き、凹凸が目視できるようにする。これまでの「対象全体を複製してシェーダで画素を
discard するべた塗り重ね描き」(`overlay.ts` / `overlay-geometry.ts` / `overlay-material.ts`)は削除する。
UI のスイッチ(基準を表示・差分だけを表示・差分を着色)の構成と意味は変えない。

## 前提
- 174 が `web/src/features/compare/difference-geometry.ts` に
  `buildDifferenceGeometry(source: BufferGeometry, signedDistance: ArrayLike<number>, threshold: number): BufferGeometry`
  を置いている。返る geometry は index 無し、groups が 2 つ(materialIndex 0 = 飛び出し、1 = へこみ)、
  source に `skinIndex`/`skinWeight` があれば同名属性、`morphAttributes.position` があれば同数の morph 属性を持つ
- 現在の `MeshCompareRig.tsx`(59 行)は 3 つの `useEffect` を持つ。
  1 つ目(依存 `[base, target]`)が `computeDeviation(target, base)` を `result` state に置き、cleanup で
  `clearCompareOverlays(target)` と `setResult(null)`。
  2 つ目(依存 `[result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly, colorized]`)が
  `result.meshes` の各 `{ mesh, signedDistance }` に
  `applyCompareOverlay(mesh, signedDistance, threshold, colors, { depthWrite: differencesOnly, visible: colorized })`。
  3 つ目(依存 `[result, differencesOnly]`)が `setCompareSurfacesHidden(meshes, true)` と cleanup で `false`。
  **1 つ目と 3 つ目の中身は呼び出し名の差し替え以外変えない**
- `overlay.ts` の import 元は `MeshCompareRig.tsx` と、web/tests の
  `compare-overlay.test.ts`、`compare-overlay-shader.test.ts`、`compare-overlay-color.test.ts`、
  `compare-target-surface.test.ts:11`(`applyCompareOverlay` で「親を隠しても子が残る」検査に使用)、
  `viewer-colors.test.ts:7`(`COMPARE_INSIDE_COLOR` / `COMPARE_OUTSIDE_COLOR` を import)だけである(grep 済み)。
  すべて owns: に含めてある
- **import ではなくパス文字列でソースを読むテストがもう 1 本ある**。
  `web/tests/outliner-highlight.test.ts:250` が
  `expect(readSource("features/compare/overlay.ts")).not.toContain("SELECTION_OVERLAY_KEY");` と書いており、
  `overlay.ts` を消すとこのテストは ENOENT で落ちる。この 1 行を `difference-mesh.ts` に差し替える
  (同ファイルも owns: に含めてある。差し替える 1 行以外は触らない)
- `web/tests/compare-rig.test.ts` は Rig のソースを文字列で検査する(`:26-53`)。現在
  `clearCompareOverlays(`、`applyCompareOverlay(`、
  `applyCompareOverlay(mesh, signedDistance, threshold, colors, { depthWrite: differencesOnly, visible: colorized })`、
  `}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly, colorized]);` を見ている。
  本タスクで新しい文字列に書き換える
- `web/tests/compare-visibility.test.ts` は Rig のソースを見ていない(grep 済み)。触らない
- `VIEWER_OVERLAY_KEY`(`web/src/features/viewer/mesh-display.ts:10`)を userData に付けた子は、
  アウトライナのツリー(`outliner-tree.ts:32`)、表示切替(`outliner/visibility.ts:12`)、
  ピック(`pick-selection.ts:34`)、選択ハイライト(`selection-highlight.ts:95`)、
  比較対象の収集(`deviation.ts:17`)のすべてから除外される。差分 Mesh にも同じキーを付ける
- three のワイヤーフレーム重ね描き(`mesh-display.ts`)は同一面の z ファイト回避に `polygonOffset` を使っている。
  差分 Mesh は対象本体の表面と完全に重なるので、同じ方法で本体より手前に描く
- 比較色は theme ストアの `compareOutside` / `compareInside`(`web/src/features/theme/viewer-colors.ts:52-53, 65-66`)で、
  既定値 `COMPARE_OUTSIDE_COLOR` / `COMPARE_INSIDE_COLOR` は現在 `overlay-material.ts:5-8` が
  `hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside)` などで定義している。本タスクで `difference-material.ts` へ移す
- `web/tests/summary-coverage.test.ts` は src の各ファイルと tests の各テストファイル名が Summary に載っていることを検査する。
  削除したファイルの記述は消し、新規ファイルは載せる

## インターフェイス契約

### `web/src/features/compare/difference-material.ts`(新規)

```ts
import { MeshStandardMaterial } from "three";

/** 飛び出し(正の距離)の既定色。VIEWER_COLOR_DEFAULTS.light.compareOutside */
export const COMPARE_OUTSIDE_COLOR: number;
/** へこみ(負の距離)の既定色。VIEWER_COLOR_DEFAULTS.light.compareInside */
export const COMPARE_INSIDE_COLOR: number;
/** 対象本体と同一面での z ファイトを避けるための polygonOffsetFactor / polygonOffsetUnits */
export const DIFFERENCE_POLYGON_OFFSET = -1;

/** 比較の色。値は 0xrrggbb */
export interface CompareColors {
  outside: number;
  inside: number;
}

/**
 * [飛び出し用, へこみ用] の材質を新しく作る(呼ぶたび新規、共有しない)。
 * 両方とも: color は既定色、roughness 1、metalness 0、side DoubleSide、transparent false、opacity 1、
 * depthWrite true、polygonOffset true、polygonOffsetFactor / polygonOffsetUnits = DIFFERENCE_POLYGON_OFFSET。
 * 添字は difference-geometry.ts の DIFFERENCE_OUTSIDE_MATERIAL / DIFFERENCE_INSIDE_MATERIAL に対応する。
 */
export function createDifferenceMaterials(): [MeshStandardMaterial, MeshStandardMaterial];

/** materials[0].color に colors.outside、materials[1].color に colors.inside を setHex する。長さが 2 未満なら何もしない */
export function setDifferenceColors(materials: readonly MeshStandardMaterial[], colors: CompareColors): void;
```

### `web/src/features/compare/difference-mesh.ts`(新規。`overlay.ts` の後継)

```ts
import { Mesh, Object3D } from "three";
import type { CompareColors } from "./difference-material";

/** 差分 Mesh の見え方。呼び出しごとに必ず書き直す(省略時は既定値を書く) */
export interface CompareDifferenceOptions {
  /** 差分 Mesh の visible。未指定は true */
  visible?: boolean;
}

/** 差分 Mesh の userData キー。値は true */
export const MESH_COMPARE_DIFFERENCE_KEY = "meshCompareDifference";
/** 前回 geometry を作った入力を覚える userData キー。値は { signedDistance, threshold } */
export const MESH_COMPARE_DIFFERENCE_SOURCE_KEY = "meshCompareDifferenceSource";

/** userData[MESH_COMPARE_DIFFERENCE_KEY] === true なら差分 Mesh */
export function isMeshCompareDifference(object: Object3D): boolean;

/**
 * mesh の子として置く差分 Mesh を、空の BufferGeometry と createDifferenceMaterials() で作る(まだ add はしない)。
 * mesh が SkinnedMesh なら SkinnedMesh で作り、bindMode を写して mesh.skeleton / mesh.bindMatrix で bind する。
 * morphTargetInfluences / morphTargetDictionary は mesh のものを同一参照で共有する。
 * raycast は () => undefined、frustumCulled は false、
 * userData に MESH_COMPARE_DIFFERENCE_KEY と VIEWER_OVERLAY_KEY(mesh-display.ts)を true で付ける。
 */
export function createCompareDifference(mesh: Mesh): Mesh;

/**
 * mesh 直下の差分 Mesh(isMeshCompareDifference な子)を再利用し、無ければ createCompareDifference で作って mesh.add する。
 * userData[MESH_COMPARE_DIFFERENCE_SOURCE_KEY] の signedDistance が同一参照で threshold が === なら geometry は作り直さない。
 * それ以外は buildDifferenceGeometry(mesh.geometry, signedDistance, threshold) で新しい geometry を作り、
 * 古い geometry を dispose() してから差し替え、userData の記録を更新する。
 * 毎回 setDifferenceColors(materials, colors) と options.visible(未指定 true)を書く。
 */
export function applyCompareDifference(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
  options?: CompareDifferenceOptions,
): Mesh;

/** root 配下の差分 Mesh をすべて親から外し、geometry と材質 2 つを dispose する */
export function clearCompareDifferences(root: Object3D): void;
```

### `web/src/features/compare/MeshCompareRig.tsx`

import を `import { clearCompareDifferences, applyCompareDifference } from "./difference-mesh";` に変え、
1 つ目の effect の cleanup を `clearCompareDifferences(target);` に、2 つ目の effect を次の形にする
(ソース検査テストが文字列で見るので**この通り**に書く)。`differencesOnly` / `colorized` の宣言、
`ZERO_THRESHOLD_RATIO`、`thresholdWorld`、3 つ目の effect は変えない。

```tsx
useEffect(() => {
  if (result === null) return;
  const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
  const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) };
  for (const { mesh, signedDistance } of result.meshes) {
    applyCompareDifference(mesh, signedDistance, threshold, colors, { visible: colorized });
  }
}, [result, compare.thresholdPermille, outsideColor, insideColor, colorized]);
```

### 削除するファイル
`web/src/features/compare/overlay.ts`、`overlay-geometry.ts`、`overlay-material.ts`、
`web/tests/compare-overlay.test.ts`、`compare-overlay-shader.test.ts`、`compare-overlay-color.test.ts`。
`git rm` で消す(残すと `compare-overlay.test.ts` が削除済み module を import して落ちる)。

### 既存テストの import 差し替え
- `web/tests/viewer-colors.test.ts:7` → `from "../src/features/compare/difference-material"`
- `web/tests/compare-target-surface.test.ts:11` → `applyCompareDifference` を `"../src/features/compare/difference-mesh"` から import し、
  `:65` を `applyCompareDifference(source, new Float32Array(24), 0.5, { outside: 1, inside: 2 })` に変える
- `web/tests/outliner-highlight.test.ts:250`(import ではなく `readSource` のパス文字列)→
  `expect(readSource("features/compare/difference-mesh.ts")).not.toContain("SELECTION_OVERLAY_KEY");`。
  差分 Mesh は `MESH_COMPARE_DIFFERENCE_KEY` と `VIEWER_OVERLAY_KEY` だけを使い `SELECTION_OVERLAY_KEY` を持ち込まないので、
  この検査はそのまま通る。同ファイルの他の行は変えない

## 振る舞い

`box()` = `new Mesh(new BoxGeometry(), new MeshStandardMaterial())`、`d1` = `new Float32Array(24).fill(1)`、
`colors` = `{ outside: 0xff0000, inside: 0x0000ff }`。`skinnedMesh()` は削除する `compare-overlay.test.ts:32-45` と同じ作り方
(skinIndex / skinWeight / morph 付き BoxGeometry、Bone 1 本の Skeleton、`morphTargetInfluences = [0.5]`)。

### difference-material.ts(`web/tests/compare-difference-material.test.ts`)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `COMPARE_OUTSIDE_COLOR` / `COMPARE_INSIDE_COLOR` | `hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside)` / `.compareInside` と等しい |
| `createDifferenceMaterials()` | 長さ 2、両方 `MeshStandardMaterial`。`[0].color.getHex() === COMPARE_OUTSIDE_COLOR`、`[1].color.getHex() === COMPARE_INSIDE_COLOR` |
| 同上の各材質 | `roughness === 1`、`metalness === 0`、`side === DoubleSide`、`transparent === false`、`opacity === 1`、`depthWrite === true`、`polygonOffset === true`、`polygonOffsetFactor === -1`、`polygonOffsetUnits === -1` |
| 2 回呼ぶ | 別インスタンス(`[0] !== 前回[0]`) |
| `setDifferenceColors(materials, colors)` | `[0].color.getHex() === 0xff0000`、`[1].color.getHex() === 0x0000ff` |
| `setDifferenceColors([single], colors)` | 例外なく何もしない(色は変わらない) |
| Rig のソース | `useThemeStore(selectViewerColor("compareOutside"))`、`useThemeStore(selectViewerColor("compareInside"))`、`hexToNumber(outsideColor)`、`hexToNumber(insideColor)` を含む(削除する `compare-overlay-color.test.ts` の結線検査をここへ移す) |

### difference-mesh.ts(`web/tests/compare-difference-mesh.test.ts`)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createCompareDifference(box())` | `Mesh` で `SkinnedMesh` ではない。`geometry.getAttribute("position")` が無いか count 0。`material` は長さ 2 の配列。`raycast` が `undefined` を返す。`frustumCulled === false`。`userData[MESH_COMPARE_DIFFERENCE_KEY] === true`、`userData[VIEWER_OVERLAY_KEY] === true`。まだ `box.children` に入っていない |
| `createCompareDifference(skinnedMesh())` | `SkinnedMesh`。`skeleton` が元と同一参照、`bindMode` が等しい、`bindMatrix.equals(元.bindMatrix)`。`morphTargetInfluences` が元と同一参照 |
| `isMeshCompareDifference(差分)` / `isMeshCompareDifference(box())` | `true` / `false` |
| `applyCompareDifference(a, d1, 0.5, colors)` | 返り値が `a.children` に 1 つだけ入り `isMeshCompareDifference`。geometry の position count 36、groups が `[[0,36,0],[36,0,1]]`。`(material as MeshStandardMaterial[])[0].color.getHex() === 0xff0000`。`visible === true`。`userData[MESH_COMPARE_DIFFERENCE_SOURCE_KEY]` が `{ signedDistance: d1, threshold: 0.5 }`(同一参照) |
| 同じ `a` に `applyCompareDifference(a, d1, 0.5, colors)` を 2 回 | 同じ Mesh インスタンス、`a.children.length === 1`、2 回目の `geometry` は 1 回目と同一参照(作り直さない) |
| `applyCompareDifference(a, d1, 0.5, ...)` の後に `applyCompareDifference(a, d1, 0.25, ...)` | 同じ Mesh インスタンスで `geometry` が別インスタンス。古い geometry の `dispose` が呼ばれている(`vi.spyOn(old, "dispose")` または `addEventListener("dispose")`) |
| `d1` の後に `new Float32Array(24).fill(1)`(別参照)で同じしきい値 | geometry が作り直される(別インスタンス) |
| `applyCompareDifference(a, new Float32Array(24).fill(-1), 0.5, colors)` | groups が `[[0,0,0],[0,36,1]]`、`[1].color.getHex() === 0x0000ff` |
| `applyCompareDifference(a, d1, 0.5, { outside: 1, inside: 2 })` の後に `colors` で再度 | geometry は同一参照のまま色だけ `0xff0000` / `0x0000ff` に更新 |
| `applyCompareDifference(a, d1, 0.5, colors, { visible: false })` | `visible === false`、`a.children.length === 1`、geometry は通常どおり作られている(count 36) |
| `{ visible: false }` の後に第 5 引数なし | `visible === true` に戻る |
| `applyCompareDifference(skinnedMesh(), d1, 0.5, colors)` | `SkinnedMesh`、geometry に `skinIndex`・`skinWeight`(itemSize 4)と `morphAttributes.position` 長さ 1 があり、`morphTargetsRelative === true` |
| 差分 Mesh を含む `a` に対する `new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1))` の `intersectObject(a, true)`(`a.updateMatrixWorld(true)` 済み) | ヒットの `object` に差分 Mesh が含まれない(本体 `a` のヒットはある) |
| `applyCompareDifference` の後に、`a` を入れた Group へ `applyMeshDisplay(root, "solid-wireframe")`(`mesh-display.ts:119`)、続けて `applyMeshDisplay(root, "solid")` | 差分 Mesh の材質 `[0].wireframe === false` のまま、`a.children.filter(isMeshCompareDifference).length === 1`、`"solid"` に戻しても `a.children` に差分 Mesh が残る(削除する `compare-overlay.test.ts:222-231` の共存検査を移す) |
| `clearCompareDifferences(root)`(root 配下に差分付き Mesh が 2 つ) | 両方の差分 Mesh が親から外れ(`parent === null`)、各 geometry と材質 2 つの `dispose` が呼ばれている。本体 Mesh 自体は残る |
| `clearCompareDifferences(new Group())` | 例外なし |
| Rig のソース(`compare-rig.test.ts`) | `clearCompareDifferences(`、`applyCompareDifference(`、`applyCompareDifference(mesh, signedDistance, threshold, colors, { visible: colorized })`、`}, [result, compare.thresholdPermille, outsideColor, insideColor, colorized]);` を含み、`applyCompareOverlay`、`clearCompareOverlays`、`depthWrite` を含まない。既存の `}, [base, target]);`、`if (result === null || !differencesOnly) return;`、`}, [result, differencesOnly]);`、`setCompareSurfacesHidden(`、`not.toContain("useFrame")`、計算 effect の正規表現検査はそのまま残す |
| `compare-target-surface.test.ts` の「親を隠しても子が残る」 | `applyCompareDifference` で作った子の `layers.mask === 1` のまま、`intersectObject(source, true)` が `[]` |
| 実行時: しきい値スライダーを動かす | 2 つ目の effect が再実行され、距離計算(BVH)なしで各 Mesh の geometry が作り直される |
| 実行時: テーマ色だけ変わる / `colorized` だけ変わる | `signedDistance` 参照としきい値が同じなので geometry は作り直されず、色 / `visible` だけ更新される |
| 実行時: `differencesOnly` が true | 3 つ目の effect が対象本体の layer 0 を外す(従来どおり)。差分 Mesh は不透明・depthWrite true なので単独で正しく描かれる |
| 実行時: 対象の版を切り替える | 1 つ目の effect の cleanup で `clearCompareDifferences(target)` が走り、新しい `result` で作り直される |

## やらないこと
- `triangle-clip.ts` / `difference-geometry.ts` の変更(174 の成果物をそのまま使う)
- `deviation.ts`、`target-surface.ts`、`compare-visibility.ts`、`model-scenes.ts`、`ViewerCanvas.tsx`、`CompareControls.tsx`、
  `objects-labels.ts`(凡例文言)の変更。`web/tests/compare-visibility.test.ts`、`compare-target-surface.test.ts` の
  import 行以外、`compare-threshold-slider.test.ts` は触らない
- 差分 Mesh をアウトライナに出す・選択やピックの対象にする・書き出す
- しきい値変更時の非同期化・デバウンス・Worker 化(同期で作り直す)
- `MeshCompare`(shared)や protocol の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している(overlay 3 本とテスト 3 本は削除)
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `compare_Summary.md` を更新している: 「ファイル一覧と役割」から overlay-geometry.ts / overlay-material.ts / overlay.ts を消し、
      `difference-material.ts`(陰影付き材質 2 つと色更新)と `difference-mesh.ts`(差分 Mesh の作成・再利用・破棄)を足す。
      「公開インターフェイス」を本契約の名前に合わせる。「テスト」から compare-overlay*.test.ts 3 本を消し、
      `tests/compare-difference-material.test.ts` と `tests/compare-difference-mesh.test.ts` を足す。
      「他フォルダとの関係」の「差分は陰影なしのべた塗り」「overlay.ts は元 geometry の位置・index・変形属性を共有し…」
      「符号付き距離は頂点間で線形補間されるので…透明帯が出る」の記述を、
      「差分はしきい値の等値線で三角形を切った index 無しの実メッシュで、`MeshStandardMaterial` によりライトの影響を受ける。
      対象本体と同一面なので polygonOffset で手前に描く。しきい値の変更は距離計算なしに geometry を同期で作り直す。
      切断で生じた頂点のスキンウェイトは近い端点の値を写すので、アニメ再生時に縁がわずかにずれうる」に置き換える
- [ ] すべてのファイルが300行以内(`MeshCompareRig.tsx` は現在 59 行、`compare-rig.test.ts` は 55 行、
      `compare-target-surface.test.ts` は 75 行、`viewer-colors.test.ts` は 88 行、
      `outliner-highlight.test.ts` は 252 行で 1 行の書き換えのみ)
- [ ] verify: に書いたコマンドが成功する
