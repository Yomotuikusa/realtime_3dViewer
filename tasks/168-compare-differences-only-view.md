---
id: 168
title: 「差分だけを表示」中は対象メッシュの本体を描かず、比較重ね描きだけを深度書き込みありで描く
feature: compare
depends_on: [167]
owns: [web/src/features/compare/target-surface.ts, web/src/features/compare/overlay.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/compare-target-surface.test.ts, web/tests/compare-overlay.test.ts, web/tests/compare-rig.test.ts, web/tests/compare-overlay-color.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/features/compare/deviation.ts, web/src/features/compare/overlay-material.ts, web/src/features/compare/overlay-geometry.ts, web/src/features/compare/model-scenes.ts, web/src/features/viewer/mesh-display.ts, web/src/store/display.ts, web/tests/compare-overlay-shader.test.ts, web/tests/compare-visibility.test.ts, web/tests/summary-coverage.test.ts, node_modules/three/src/core/Layers.js]
verify: npm run typecheck && npm run test
status: done
---

## 目的
メッシュ比較で、ブーリアン差分のように「しきい値を超えた赤(飛び出し)・青(へこみ)の部分だけ」を
3D ビューに残したい。167 で `MeshCompare` に載った `differencesOnly` が true のあいだ、対象の各 Mesh を
描画とレイキャストから外し、その子として付いている比較重ね描きだけを描く。本体が無くなると
裏側の差分が透けて重なるので、このあいだは重ね描き材質の `depthWrite` を true にして手前の差分で奥を隠す。
チェックボックス(169)は別タスク。

## 前提
- 167 で `MeshCompare` に任意フィールド `differencesOnly?: boolean` が入っている(`shared/src/types.ts`)。
  未指定は false(本体も描く)。`meshCompareEquals` は未指定と false を同値として比較する。
  web の display ストア(`web/src/store/display.ts`)は `MeshCompare` を丸ごと `meshCompare` に持つ
- 現在の `MeshCompareRig.tsx`(47 行)は 2 つの `useEffect` を持つ。
  1 つ目(`:30-37`、依存 `[base, target]`)が `computeDeviation(target, base)` の結果を `result` state に置き、
  cleanup で `clearCompareOverlays(target)` と `setResult(null)` を行う。
  2 つ目(`:39-44`、依存 `[result, compare.thresholdPermille, outsideColor, insideColor]`)が
  `result.meshes` の各 `{ mesh, signedDistance }` に `applyCompareOverlay(mesh, signedDistance, threshold, colors)` を呼ぶ
- `DeviationResult.meshes`(`deviation.ts:72-77`)は `collectComparableMeshes(target)` の traverse 順と同じ Mesh 集合で、
  `isComparableMesh`(`deviation.ts:16-18`)は `Mesh` かつ `InstancedMesh` でなく `isViewerOverlay` でないもの。
  つまり重ね描きを付けた Mesh と本体を消す Mesh は同じ集合になる。`computeDeviation` が null を返す
  (基準に三角形が無い)場合は `result` が null のままで、重ね描きも付かない
- `applyCompareOverlay`(`overlay.ts:61-77`)は既存の重ね描き(`isMeshCompareOverlay` な子)を再利用し、
  無ければ `createCompareOverlay(mesh)` で作って `mesh.add(overlay)` する。材質は `createCompareOverlayMaterial()` の
  `MeshBasicMaterial`(`transparent: true`、`opacity: 0.85`、`depthWrite: false`)。`overlay.renderOrder = -1`、
  `overlay.raycast = () => undefined`。**`createCompareOverlayMaterial` と `createCompareOverlay` の振る舞いは変えない**。
  `web/tests/compare-overlay-shader.test.ts:23` が生成直後の `depthWrite === false` を検査しており、このタスクでは触らない
- three 0.186 の描画(`WebGLRenderer.projectObject`)は `object.visible === false` なら子ごと打ち切るが、
  `object.layers.test(camera.layers)` が false のときはそのオブジェクトだけ描かず**子は引き続き走査する**。
  `Raycaster.intersectObject(object, true)` も同様に、`object.layers.test(raycaster.layers)` が false ならその
  オブジェクトの `raycast` を呼ばず子へ進む。カメラと Raycaster の layers は既定で layer 0 だけ
- three の `Layers`(`node_modules/three/src/core/Layers.js`)は `mask` を持ち、初期値 1(layer 0 のみ)。
  `disable(0)` は `mask &= ~1`、`enable(0)` は `mask |= 1`、`test(layers)` は `(mask & layers.mask) !== 0`。
  他のビットは触らない。glTF / FBX / OBJ ローダが作る Mesh の layers は既定の 1
- `web/src` には `layers` を使う箇所が無い(grep 済み)。`mesh-display.ts` の `applyMeshDisplay` は材質の差し替えと
  ワイヤーフレーム重ね描き(子 Mesh、`VIEWER_OVERLAY_KEY`)の付け外しだけで、layers に触れない
- `web/tests/compare-rig.test.ts`(48 行)は Rig のソース文字列を検査している。
  `:28-37` が `useDisplayStore` / `useModelScenesStore` / `isMeshCompareActive(` / `computeDeviation(` /
  `clearCompareOverlays(` / `applyCompareOverlay(` の包含と `useFrame` の不在、
  `:39-47` が計算 effect の中身(`computeDeviation(target, base)` を含み `thresholdPermille` を含まない)と
  依存配列の文字列 `}, [base, target]);` と `}, [result, compare.thresholdPermille, outsideColor, insideColor]);` を検査する。
  後者の文字列は本タスクで変わるので、テストも本タスクで書き換える
- `web/tests/compare-overlay-color.test.ts:63` も同じ依存配列文字列
  `}, [result, compare.thresholdPermille, outsideColor, insideColor]);` を Rig のソースに対して包含検査している。
  この 1 行を新文字列 `}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly]);` へ書き換える
  (旧文字列を検査しているのは compare-rig.test.ts と compare-overlay-color.test.ts の 2 本だけ。grep 済み)
- `web/tests/compare-overlay.test.ts`(181 行)は `function mesh()` で `new Mesh(new BoxGeometry(), new MeshStandardMaterial())` を作り、
  `applyCompareOverlay` の再利用・親のピック維持などを検査している。depthWrite の行はここに足す
- `web/tests/summary-coverage.test.ts` は src 配下の各ファイルの相対パスと tests 配下の各テストファイル名が
  Summary に載っていることを検査する。新規の `target-surface.ts` と `compare-target-surface.test.ts` は
  `compare_Summary.md` に載せる

## インターフェイス契約

### `web/src/features/compare/target-surface.ts`(新規)

```ts
import type { Mesh } from "three";

/**
 * meshes の layer 0 を外す(hidden = true)/ 戻す(false)。
 * 描画とレイキャストの両方から外れる。他の layer ビットと子オブジェクト(比較重ね描き)は触らない。
 * 何度呼んでも同じ結果になる(冪等)。
 */
export function setCompareSurfacesHidden(meshes: readonly Mesh[], hidden: boolean): void;
```

### `web/src/features/compare/overlay.ts`

```ts
/**
 * 比較重ね描きを作成または再利用し、距離と uniform を更新する。
 * differencesOnly が true なら材質の depthWrite を true に、false なら false にする(作成時・再利用時とも毎回書く)。
 */
export function applyCompareOverlay(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
  differencesOnly = false,
): Mesh;
```

他の export(`createCompareOverlay`、`clearCompareOverlays`、再 export 群)は変えない。

### `web/src/features/compare/MeshCompareRig.tsx`

既存の 2 つの effect に加えて、次の形にする(ソース検査テストが文字列で見るので依存配列は**この通り**に書く)。

```tsx
const differencesOnly = compare.differencesOnly === true;

// 既存の計算 effect(依存 [base, target])は変えない

useEffect(() => {
  if (result === null) return;
  const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
  const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) };
  for (const { mesh, signedDistance } of result.meshes) applyCompareOverlay(mesh, signedDistance, threshold, colors, differencesOnly);
}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly]);

useEffect(() => {
  if (result === null || !differencesOnly) return;
  const meshes = result.meshes.map(({ mesh }) => mesh);
  setCompareSurfacesHidden(meshes, true);
  return () => setCompareSurfacesHidden(meshes, false);
}, [result, differencesOnly]);
```

## 振る舞い

`box()` = `new Mesh(new BoxGeometry(), new MeshStandardMaterial())`、`ray` = `new Raycaster()` に
`ray.set(new Vector3(0, 0, 5), new Vector3(0, 0, -1))` を与えたもの(原点の箱に当たる)とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `setCompareSurfacesHidden([a, b], true)`(a, b は `box()`) | `a.layers.mask === 0`、`b.layers.mask === 0`、`a.layers.test(new Layers())` が `false`、`ray.intersectObject(a)` が `[]` |
| 上の後に `setCompareSurfacesHidden([a, b], false)` | `a.layers.mask === 1`、`b.layers.mask === 1`、`ray.intersectObject(a).length > 0` |
| 隠していない `box()` に `setCompareSurfacesHidden([a], false)` | `a.layers.mask === 1` のまま、例外なし |
| `setCompareSurfacesHidden([a], true)` を 2 回 | `a.layers.mask === 0`(冪等)。その後 1 回の `false` で `1` に戻る |
| `a.layers.enable(1)` してから `true` → `false` | `true` 後は `mask === 2`(layer 1 は残る)、`false` 後は `mask === 3` |
| `a` に `applyCompareOverlay` で重ね描き `o` を付けてから `setCompareSurfacesHidden([a], true)` | `o.layers.mask === 1` のまま。`ray.intersectObject(a, true)` は `[]`(o は raycast 無効、a は layer 外) |
| `setCompareSurfacesHidden([], true)` | 例外なし |
| `applyCompareOverlay(a, d, t, colors)`(第 5 引数なし) | 重ね描き材質の `depthWrite === false`、`transparent === true`、`opacity === 0.85`、`renderOrder === -1`(現状どおり) |
| `applyCompareOverlay(a, d, t, colors, true)` | 同じ重ね描きインスタンスで `depthWrite === true`。`transparent` / `opacity` / `renderOrder` は変わらない |
| `true` で呼んだ後に同じ a へ `false` で呼ぶ | 同じ重ね描きインスタンス(`a.children.length === 1`)で `depthWrite === false` に戻る |
| Rig のソース | `setCompareSurfacesHidden(` を含む。`applyCompareOverlay(mesh, signedDistance, threshold, colors, differencesOnly)` を含む。`}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly]);` と `}, [result, differencesOnly]);` と `}, [base, target]);` を含む。`useFrame` を含まない(`compare-rig.test.ts` と `compare-overlay-color.test.ts:63` の両方を新文字列に合わせる) |
| Rig のソース(既存検査) | 計算 effect の中身は `computeDeviation(target, base)` を含み `thresholdPermille` を含まない(`compare-rig.test.ts:39-47` の正規表現をそのまま残す) |
| 実行時: `differencesOnly` が true → false に切り替わる | 3 つ目の effect の cleanup が走り、`result.meshes` の各 Mesh の layer 0 が戻る。2 つ目の effect が再実行され depthWrite が false に戻る |
| 実行時: 比較解除や対象の版のアンマウントで `target` が null になる | 1 つ目の effect の cleanup で `result` が null になり、3 つ目の effect の cleanup で layer 0 が戻る(重ね描きの破棄は従来どおり) |
| 実行時: `computeDeviation` が null を返す(基準に三角形が無い) | `result` が null なので本体は消えない(何も起きない) |

## やらないこと
- `differencesOnly` のチェックボックス(`CompareControls.tsx`、`objects-labels.ts`)。169 の担当
- `createCompareOverlayMaterial` / `createCompareOverlay` の既定値(`depthWrite: false`、`opacity`、`transparent`)の変更。
  `web/tests/compare-overlay-shader.test.ts` は触らない
- `compare-visibility.ts` / `ViewerCanvas.tsx` の変更(基準の描画抑止は従来どおり `baseVisible` で決める)。
  `web/tests/compare-visibility.test.ts` は 169 が所有するので触らない
- 重ね描きを陰影付き材質へ変えること。差分は現状どおり陰影なしのべた塗りのままでよい
- 「ソリッド+ワイヤー」表示中に対象へ付くワイヤーフレーム重ね描き(`VIEWER_OVERLAY_KEY` の子 Mesh)を消すこと。
  消すのは `result.meshes` の本体だけで、その子はそのまま描かれる
- `deviation.ts` / `overlay-geometry.ts` / `overlay-material.ts` / `model-scenes.ts` の変更
- レイキャスト側(`pick-selection.ts`、`AnnotationLayer.tsx`)の変更。本体を消しているあいだは 3D ビューのクリックが
  対象に当たらなくなるが、それは仕様として Summary に明記する

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る(`setCompareSurfacesHidden` は新規 `web/tests/compare-target-surface.test.ts`、
      `applyCompareOverlay` の depthWrite は `web/tests/compare-overlay.test.ts`、Rig のソース検査は `web/tests/compare-rig.test.ts` と `web/tests/compare-overlay-color.test.ts`)
- [ ] `compare_Summary.md` の「ファイル一覧と役割」に `target-surface.ts` を、「公開インターフェイス」に
      `setCompareSurfacesHidden` と `applyCompareOverlay` の第 5 引数を、「テスト」に `tests/compare-target-surface.test.ts` を追記し、
      「他フォルダとの関係」に「`differencesOnly` 中は対象の本体を layer 0 から外すので描画とレイキャストの両方から外れる。
      ワイヤーフレーム重ね描きの子は残る。差分は陰影なしのべた塗り」を追記している
- [ ] すべてのファイルが300行以内(`overlay.ts` は現在 102 行、`MeshCompareRig.tsx` は 47 行、`compare-overlay.test.ts` は 181 行)
- [ ] verify: に書いたコマンドが成功する
