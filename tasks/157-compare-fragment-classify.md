---
id: 157
title: メッシュ比較の重ね描きを、符号付き距離を補間してフラグメントシェーダで赤・青・透明に判定する方式へ変える
feature: compare
depends_on: []
owns: [web/src/features/compare/overlay-geometry.ts, web/src/features/compare/overlay-material.ts, web/src/features/compare/overlay.ts, web/src/features/compare/compare_Summary.md, web/tests/compare-overlay.test.ts, web/tests/compare-overlay-color.test.ts, web/tests/compare-overlay-faces.test.ts, web/tests/compare-overlay-shader.test.ts]
reads: [web/src/features/compare/deviation.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/polygon-edge-material.ts, web/src/features/theme/viewer-colors.ts, web/tests/compare-rig.test.ts, web/tests/viewer-colors.test.ts, web/tests/outliner-highlight.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
現在の重ね描きは 152 で「三角形の 3 頂点のうち絶対値最大の距離」で面全体を 1 色に塗る。
基準面をまたぐ三角形(頂点の符号が混在する面)では、外に出て見えている部分まで
内側の色(青)で塗られてしまう。
色の決定を CPU の面単位から GPU のピクセル単位へ移す。頂点ごとの符号付き距離を
float 属性として渡し、三角形内で線形補間された値をフラグメントシェーダで
`>= しきい値 → 外(赤)` / `<= -しきい値 → 内(青)` / `それ以外 → discard` に 3 値化する。
これで基準面との交線が三角形の内部に出るようになり、152 が嫌った混色(茶・紫)も出ない。
しきい値と色は uniform になるので、スライダー操作で頂点色を塗り直す CPU 処理が消える。

## 前提
- 距離の計算は `web/src/features/compare/deviation.ts` の `computeDeviation(target, base)` で、
  結果 `MeshDeviation.signedDistance` は**元 geometry の頂点番号**ごとの `Float32Array`(ワールド単位)。
  基準に三角形が無い頂点は `Infinity`。**このタスクでは deviation.ts を変更しない**
- 呼び出し元は `web/src/features/compare/MeshCompareRig.tsx:43` の
  `applyCompareOverlay(mesh, signedDistance, threshold, colors)` と `:36` の `clearCompareOverlays(target)` だけ。
  **`applyCompareOverlay` / `clearCompareOverlays` のシグネチャを変えず、MeshCompareRig.tsx は変更しない**。
  `web/tests/compare-rig.test.ts` は Rig のソース文字列と `thresholdWorld` を検査しており、このタスクでは触らない
- `threshold` は `thresholdWorld`(`MeshCompareRig.tsx:15-17`)が `baseSize * 1e-6` の下限を掛けて渡すので、
  基準サイズが 0 でなければ常に正
- 現在の `overlay.ts`(152 行)と `overlay-geometry.ts`(55 行)の構成:
  - `createCompareOverlayGeometry(mesh)` は position / skinIndex / skinWeight / morphAttributes.position を
    index 順に展開したコピーを作り、`color`(itemSize 4)を所有し、`userData[COMPARE_SOURCE_INDEX_KEY]` に元 index を持つ
  - `createCompareOverlayMaterial()` は `MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false })`
  - `createCompareOverlay(mesh)` は geometry と material から Mesh / SkinnedMesh を作り、
    SkinnedMesh なら `bindMode` を写して `bind(mesh.skeleton, mesh.bindMatrix)`、
    `morphTargetInfluences` / `morphTargetDictionary` を同じ参照で共有、`raycast = () => undefined`、
    `renderOrder = -1`、`userData[MESH_COMPARE_OVERLAY_KEY] = true`、`userData[VIEWER_OVERLAY_KEY] = true`。
    **この部分の振る舞いは変えない**
  - `disposeCompareOverlay` は material を dispose し、geometry の `color` 以外の属性を `deleteAttribute` してから
    `setIndex(null)`、`morphAttributes = {}`、`dispose()` する。共有した属性の GPU バッファを
    元 geometry から奪わないための手順で、**所有する属性名を `compareDistance` に変えて同じ手順を残す**
  - `colorizeDeviation`、`expandByIndex`、`compareSourceIndex`、`COMPARE_SOURCE_INDEX_KEY` は削除する
- `MeshBasicMaterial` への GLSL 注入の実績が `web/src/features/viewer/polygon-edge-material.ts:35-57` にある
  (`onBeforeCompile` で `#include <common>` / `#include <begin_vertex>` / `#include <clipping_planes_fragment>` を
  文字列置換し、`customProgramCacheKey` を固定文字列にする)。同じ手口を使う
- three 0.186 の `ShaderLib.basic` の fragment シェーダは `vec4 diffuseColor = vec4( diffuse, opacity );` の後に
  `#include <color_fragment>` を**ちょうど 1 回**含む。vertex / fragment とも `#include <common>` は 1 回、
  vertex の `#include <begin_vertex>` は 1 回(`node_modules/three/src/renderers/shaders/ShaderLib/meshbasic.glsl.js`)
- `onBeforeCompile(shader, renderer)` の `shader.uniforms` は `{ [name]: { value } }`。
  `material.userData` に置いた同じ uniform オブジェクトを `shader.uniforms[name]` へ代入すれば、
  以後 `.value` の書き換えが描画に反映される(three の `refreshUniformsCommon` は毎フレーム `.value` を読む)
- 三角形内の距離は線形補間なので、基準面が強く曲がる大きな三角形では交線の位置がずれる。
  また基準が薄く、隣接頂点の最近点が別の面に付いて符号が反転した場合は三角形の途中に透明の帯が出る。
  どちらも 152 以前の方式でも起きていた近似で、このタスクの範囲では許容し Summary に明記する
- `Color` は `setHex` で sRGB → 作業色空間(linear)へ変換し、`getHex()` で戻す。
  現在の頂点色も `Color.setHex` の r/g/b を書いていたので、uniform の `Color` は同じ見え方になる
- three の `BoxGeometry()`(引数なし)は頂点 24、index 36。振る舞い表の数値はこれで検算してある
- テスト側の識別子参照:
  - `web/tests/viewer-colors.test.ts:2` は `../src/features/compare/overlay` から
    `COMPARE_INSIDE_COLOR` / `COMPARE_OUTSIDE_COLOR` を import する。**この 2 名は overlay.ts から引き続き export する**
  - `web/tests/outliner-highlight.test.ts:230` は overlay.ts のソースに `SELECTION_OVERLAY_KEY` が**含まれない**ことを要求する
  - `web/tests/compare-overlay-faces.test.ts` は `expandByIndex` / `compareSourceIndex` / 面色を検査しており、
    このタスクで**ファイルごと削除**する。代わりに `web/tests/compare-overlay-shader.test.ts` を新規作成する
  - `web/tests/summary-coverage.test.ts` は `web/src` の全ソースが最寄り Summary に相対パスで載っていること、
    `web/tests/*.test.ts` の全ファイル名がどこかの Summary に載っていることを機械検証する。
    新規ファイル `overlay-material.ts` と `compare-overlay-shader.test.ts` を `compare_Summary.md` に追記し、
    `compare-overlay-faces.test.ts` の行を消す
- `web/tests/compare-overlay.test.ts` は現在 238 行。書き換えで展開まわりの検査が消えるので縮むが、
  新しい検査は `compare-overlay-shader.test.ts` に書き、こちらは 250 行を超えないようにする

## インターフェイス契約

### `web/src/features/compare/overlay-geometry.ts`(書き換え)

```ts
import { BufferGeometry, Mesh } from "three";

/** 頂点ごとの符号付き距離(ワールド単位)を持つ float 属性の名前。itemSize 1 */
export const COMPARE_DISTANCE_ATTRIBUTE = "compareDistance";

/**
 * 比較重ね描き専用の geometry を作る。
 * position / skinIndex / skinWeight / index / morphAttributes.position / morphTargetsRelative /
 * boundingBox / boundingSphere は mesh.geometry と同じ参照を共有する(コピーしない)。
 * 所有するのは compareDistance(Float32BufferAttribute、count = position.count、全 0)だけ。
 * normal / uv / color は持たない。
 */
export function createCompareOverlayGeometry(mesh: Mesh): BufferGeometry;

/**
 * signedDistance を compareDistance 属性へ書く。
 * 書く個数は min(属性の count, signedDistance.length)。非有限の値は 0 として書く。
 * 書かなかった残りの頂点は 0 に戻す(前回の値を残さない)。末尾で needsUpdate = true。
 * 属性が無い geometry では何もしない。
 */
export function writeCompareDistance(geometry: BufferGeometry, signedDistance: ArrayLike<number>): void;
```

### `web/src/features/compare/overlay-material.ts`(新規)

```ts
import { Color, Material, MeshBasicMaterial } from "three";

/** 飛び出し(正の距離)の既定色。VIEWER_COLOR_DEFAULTS.light.compareOutside */
export const COMPARE_OUTSIDE_COLOR: number;
/** へこみ(負の距離)の既定色。VIEWER_COLOR_DEFAULTS.light.compareInside */
export const COMPARE_INSIDE_COLOR: number;
/** 着色部分の不透明度 */
export const COMPARE_OVERLAY_OPACITY = 0.85;
/** uniform 群を置く material.userData のキー */
export const COMPARE_OVERLAY_UNIFORMS_KEY = "meshCompareUniforms";
/** customProgramCacheKey が返す固定文字列 */
export const COMPARE_PROGRAM_CACHE_KEY = "meshCompare";

/** 比較の色。値は 0xrrggbb */
export interface CompareColors {
  outside: number;
  inside: number;
}

/** onBeforeCompile で shader.uniforms へ同じ参照を渡す uniform 群 */
export interface CompareOverlayUniforms {
  compareThreshold: { value: number };
  compareOutside: { value: Color };
  compareInside: { value: Color };
}

/**
 * 符号付き距離を補間して赤・青・透明に判定する、共有しない MeshBasicMaterial を作る。
 * オプションは { color: 0xffffff, transparent: true, opacity: COMPARE_OVERLAY_OPACITY, depthWrite: false, toneMapped: false }。
 * vertexColors は使わない。
 * userData[COMPARE_OVERLAY_UNIFORMS_KEY] に CompareOverlayUniforms を置く
 * (初期値: threshold 0、outside = COMPARE_OUTSIDE_COLOR、inside = COMPARE_INSIDE_COLOR)。
 * customProgramCacheKey は () => COMPARE_PROGRAM_CACHE_KEY。
 * onBeforeCompile は下記 GLSL を注入し、shader.uniforms の compareThreshold / compareOutside / compareInside に
 * userData の同じオブジェクトを代入する。
 */
export function createCompareOverlayMaterial(): MeshBasicMaterial;

/** userData[COMPARE_OVERLAY_UNIFORMS_KEY] を返す。無ければ null */
export function compareOverlayUniforms(material: Material): CompareOverlayUniforms | null;

/**
 * しきい値と色を uniform に書く。material が比較用でなければ false を返して何もしない。
 * 色は Color.setHex で書く(新しい Color を作らない)。
 */
export function setCompareOverlayUniforms(material: Material, threshold: number, colors: CompareColors): boolean;
```

注入する GLSL(文字列置換。テストは次の断片を `toContain` で検査する)。

vertex: `#include <common>` の直後に追記
```glsl
attribute float compareDistance;
varying float vCompareDistance;
```
vertex: `#include <begin_vertex>` の直後に追記
```glsl
vCompareDistance = compareDistance;
```
fragment: `#include <common>` の直後に追記
```glsl
uniform float compareThreshold;
uniform vec3 compareOutside;
uniform vec3 compareInside;
varying float vCompareDistance;
```
fragment: `#include <color_fragment>` を**置き換える**(残さない)
```glsl
if (vCompareDistance >= compareThreshold) {
  diffuseColor.rgb = compareOutside;
} else if (vCompareDistance <= -compareThreshold) {
  diffuseColor.rgb = compareInside;
} else {
  discard;
}
```

### `web/src/features/compare/overlay.ts`(書き換え)

次の公開名を overlay.ts から import できること(定義は overlay-geometry.ts / overlay-material.ts に置いて
re-export してよい):
`MESH_COMPARE_OVERLAY_KEY`、`COMPARE_OUTSIDE_COLOR`、`COMPARE_INSIDE_COLOR`、`COMPARE_OVERLAY_OPACITY`、
`COMPARE_OVERLAY_UNIFORMS_KEY`、`COMPARE_PROGRAM_CACHE_KEY`、`COMPARE_DISTANCE_ATTRIBUTE`、
`CompareColors`、`CompareOverlayUniforms`、`isMeshCompareOverlay`、`createCompareOverlayGeometry`、
`writeCompareDistance`、`createCompareOverlayMaterial`、`compareOverlayUniforms`、`setCompareOverlayUniforms`、
`createCompareOverlay`、`applyCompareOverlay`、`clearCompareOverlays`。

```ts
/** mesh と同じ変形状態を使う比較重ね描き Mesh を作る(前提に書いた現在の振る舞いのまま)。 */
export function createCompareOverlay(mesh: Mesh): Mesh;

/**
 * 比較重ね描きを作成または再利用し、writeCompareDistance と setCompareOverlayUniforms を行う。
 * 戻り値は重ね描き Mesh。mesh.children に比較重ね描きは常に 1 つ。
 */
export function applyCompareOverlay(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
): Mesh;

/** root 配下の比較重ね描きを取り外して破棄する(compareDistance 以外の属性を deleteAttribute してから dispose)。 */
export function clearCompareOverlays(root: Object3D): void;
```

### `web/tests/compare-overlay-shader.test.ts`(新規)

`onBeforeCompile` は WebGL なしで次のように呼んで文字列と uniform の参照を検査する。

```ts
import { ShaderLib, UniformsUtils } from "three";
const shader = {
  vertexShader: ShaderLib.basic.vertexShader,
  fragmentShader: ShaderLib.basic.fragmentShader,
  uniforms: UniformsUtils.clone(ShaderLib.basic.uniforms),
};
material.onBeforeCompile(shader as never, {} as never);
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createCompareOverlayGeometry(Box の Mesh)` | 戻り値は別の geometry。`position` と `index` は元と**同一参照**。`compareDistance` は itemSize 1・count 24・全 0。`normal` / `uv` / `color` は無い |
| 元 geometry に index が無い(`toNonIndexed()` 済み) | `getIndex()` は null。`compareDistance.count` は position.count |
| 元が `color` 属性を持つ | 重ね描き側に `color` は無く、元の `color` 属性はそのまま残る |
| SkinnedMesh(skinIndex / skinWeight / morphAttributes.position あり) | 3 つとも元と同一参照。`morphTargetsRelative` が写されている |
| `writeCompareDistance(g, [0.2, -0.2, NaN, Infinity, -Infinity])`(count 24) | 頂点 0..4 が `0.2, -0.2, 0, 0, 0`、頂点 5..23 が 0。属性の `version` が増える |
| 先に全頂点へ 1 を書いた後、`writeCompareDistance(g, [0.5])` | 頂点 0 が 0.5、頂点 1..23 が 0 に戻る |
| `writeCompareDistance(g, new Float32Array(100).fill(-1))`(count 24) | 例外なし。頂点 0..23 が -1 |
| `compareDistance` を持たない geometry に `writeCompareDistance` | 例外なし。何も変わらない |
| `createCompareOverlayMaterial()` | `MeshBasicMaterial`。`vertexColors === false`、`color.getHex() === 0xffffff`、`transparent === true`、`opacity === 0.85`、`depthWrite === false`、`toneMapped === false`、`customProgramCacheKey() === "meshCompare"` |
| 同上の `compareOverlayUniforms(material)` | non-null。`compareThreshold.value === 0`、`compareOutside.value.getHex() === COMPARE_OUTSIDE_COLOR`、`compareInside.value.getHex() === COMPARE_INSIDE_COLOR` |
| `compareOverlayUniforms(new MeshBasicMaterial())` | null |
| `onBeforeCompile(shader)` 後の `shader.vertexShader` | `attribute float compareDistance;`、`varying float vCompareDistance;`、`vCompareDistance = compareDistance;` を含む。`#include <begin_vertex>` と `#include <skinning_vertex>` は残っている |
| 同上の `shader.fragmentShader` | `uniform float compareThreshold;`、`diffuseColor.rgb = compareOutside;`、`diffuseColor.rgb = compareInside;`、`discard;` を含み、`#include <color_fragment>` を**含まない**。`vec4 diffuseColor = vec4( diffuse, opacity );` は残っている |
| 同上の `shader.uniforms` | `compareThreshold` / `compareOutside` / `compareInside` が `compareOverlayUniforms(material)` の各プロパティと**同一参照**。`diffuse` / `opacity` は残っている |
| `setCompareOverlayUniforms(material, 0.5, { outside: 0xff0000, inside: 0x00ff00 })` | true。`compareThreshold.value === 0.5`、`compareOutside.value.getHex() === 0xff0000`、`compareInside.value.getHex() === 0x00ff00`。`compareOutside.value` の Color オブジェクトは呼び出し前と同一参照 |
| `setCompareOverlayUniforms(new MeshBasicMaterial(), 1, colors)` | false。例外なし |
| `createCompareOverlay(mesh)` | `userData[MESH_COMPARE_OVERLAY_KEY] === true`、`userData[VIEWER_OVERLAY_KEY] === true`、`MESH_DISPLAY_OVERLAY_KEY` は未設定、`renderOrder === -1`、`Raycaster.intersectObject` が空、`compareOverlayUniforms(material)` が non-null、`mesh.children` には追加されない |
| `createCompareOverlay(SkinnedMesh)` | `SkinnedMesh`。`skeleton` 同一、`bindMatrix` 等しい、`bindMode` 等しい、`morphTargetInfluences` 同一参照 |
| `applyCompareOverlay(mesh, fill(1), 0.5, colors)` を 2 回(2 回目は fill(-1) と別の色) | 同じ Mesh が返る。`mesh.children` の比較重ね描きは 1 つ。`compareDistance` の頂点 0 が -1。uniform の色が 2 回目の値。親の raycast ヒット数は適用前と同じ |
| `clearCompareOverlays(root)`(2 つの Mesh に重ね描き、1 つにワイヤフレーム重ね描き) | 比較重ね描きだけ外れる。各 material と geometry の `dispose` が 1 回ずつ。重ね描き geometry に `position` / `skinIndex` / index は残らず、元 geometry の `position` / index は残る |
| `clearCompareOverlays(new Group())` | 例外なし |
| `applyMeshDisplay(root, "solid-wireframe")` → `"solid"` | 比較重ね描きの material の `wireframe` は false のまま。比較重ね描きは外れない(現在の検査のまま) |
| `MeshCompareRig.tsx` のソース | `web/tests/compare-rig.test.ts` と `web/tests/compare-overlay-color.test.ts` の既存の文字列検査がそのまま通る(Rig は変更しないので当然通る) |

## やらないこと
- `deviation.ts` の距離計算、`MeshCompareRig.tsx`、`compare-visibility.ts`、`model-scenes.ts` は変更しない
- shared / server / display ストア / CompareControls は変更しない
- 距離の勾配表示(ヒートマップ)や、しきい値以内を別色で塗る拡張はしない。3 値化のみ
- 三角形内の非線形補正や、基準面の曲がりを考慮した交線の補正はしない
- `polygonOffset` や `side` の変更、描画順の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している(`compare-overlay-faces.test.ts` は削除)
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] compare_Summary.md の「ファイル一覧と役割」「公開インターフェイス」「他フォルダとの関係」「テスト」を更新し、線形補間の近似と符号反転の帯を限界として明記している
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
