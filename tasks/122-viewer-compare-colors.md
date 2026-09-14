---
id: 122
title: 3D ビューの背景・ワイヤフレーム・メッシュ比較の色を表示色設定から取る
feature: viewer
depends_on: [115]
owns: [web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/useModelScene.ts, web/src/features/viewer/viewer_Summary.md, web/src/features/compare/overlay.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/mesh-display.test.ts, web/tests/mesh-display-color.test.ts, web/tests/compare-overlay.test.ts, web/tests/compare-overlay-color.test.ts, web/tests/compare-rig.test.ts, web/tests/model-scene.test.ts]
reads: [web/src/features/theme/viewer-colors.ts, web/src/store/theme.ts, web/src/store/display.ts, web/src/store/objects.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/compare/deviation.ts, web/src/features/compare/model-scenes.ts, web/tests/pick.test.ts, web/tests/outliner-highlight.test.ts, web/tests/timeline-styles.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
3D ビューの背景色、ワイヤフレーム重ね描きの線の色、メッシュ比較の
外側(赤)・内側(青)の色を、115 で作った表示色設定から取るようにする。
これで 11 色すべてが設定から変えられる状態になる。

## 前提
- 115 の `web/src/features/theme/viewer-colors.ts` に `hexToNumber(hex): number` と
  `VIEWER_COLOR_DEFAULTS` がある。`.light.background === "#f5f7fa"`、
  `.light.wireframe === "#1f2937"`、`.light.compareOutside === "#dc2626"`、
  `.light.compareInside === "#2563eb"`
- 115 の `web/src/store/theme.ts` に `useThemeStore` と `selectViewerColor(key)` がある。
  **このタスクではストアを変更しない**
- 背景色は定数ではなく `ViewerCanvas.tsx:32` の JSX に直値で書かれている。

  ```tsx
  <color attach="background" args={["#f5f7fa"]} />
  ```

  three の `Color` は `"#rrggbb"` の文字列をそのまま受けるので、**背景だけは数値へ変換せず
  hex 文字列のまま渡す**
- `WIREFRAME_OVERLAY_COLOR`(`mesh-display.ts:9`)、`COMPARE_OUTSIDE_COLOR` /
  `COMPARE_INSIDE_COLOR`(`compare/overlay.ts:15,17`)は、既存テストが import しているので
  **export したまま残す**(値も変えない)
- **ワイヤフレーム側の 3 関数は色を省略可能にする**。これは呼び出し元が 7 ファイルに散っており、
  そのうち `web/tests/outliner-highlight.test.ts:205,206` は**並列で走る 120 が owns するため
  このタスクから触れない**ためである。省略可能にすれば既存の呼び出しが無修正で通る。
  | 関数 | 呼び出し元 |
  | --- | --- |
  | `applyMeshDisplay` | `useModelScene.ts:46,59` / `mesh-display.test.ts`(多数) / `compare-overlay.test.ts:217,221` / `outliner-highlight.test.ts:205,206`(**120 の owns**) |
  | `createWireframeOverlay` | `mesh-display.ts:92` / `mesh-display.test.ts` / `compare-overlay.test.ts:28` |
  | `createWireframeOverlayMaterial` | `mesh-display.ts:44` / `mesh-display.test.ts` |
- **比較側の 2 関数は色を必須にする**。呼び出し元が `MeshCompareRig.tsx` と
  `compare-overlay.test.ts` だけで、どちらもこのタスクの owns に収まるため。
- **`web/tests/mesh-display.test.ts` は現在 240 行、`web/tests/compare-overlay.test.ts` は 224 行で、
  どちらも上限 300 行に近い**。この 2 ファイルへは**既存の呼び出しへ引数を足す修正と、
  下に挙げるソース文字列検査の更新だけ**を行い、色に関する新しい検査は owns に用意した
  `web/tests/mesh-display-color.test.ts` と `web/tests/compare-overlay-color.test.ts` へ書く
  (`compare-rig.test.ts` は 44 行、`model-scene.test.ts` は 164 行なので、
  そちらの新しい検査は既存ファイルへ足してよい)
- **依存配列とソース文字列を検査する既存テストが 3 箇所ある**。どれも owns に入れてあるので、
  検査を消さず**実装後の文字列へ更新**すること。
  - `web/tests/compare-rig.test.ts:42` の `expect(source).toContain("}, [result, compare.thresholdPermille]);")`
    → 色を依存に足すので更新する。同ファイル `:41` の `}, [base, target]);` と
    `:40` の `expect(calculationEffect?.[1]).not.toContain("thresholdPermille")` は**そのまま通す**
    (距離の計算は色に依存しない)
  - `web/tests/mesh-display.test.ts:235` の `expect(modelMesh).toContain("applyMeshDisplay(scene, meshDisplay)")`
    → 第 3 引数が増えるので更新する。`:236` の `applyMeshDisplay(scene, "solid")` も同様
  - `web/tests/model-scene.test.ts:73-74` の同じ 2 つの文字列 → 同様に更新する
- `web/tests/model-scene.test.ts:86` は
  `expect(sceneSource).toContain("const { versionId, primary, meshDisplay } = options;")` を検査する。
  **`ModelSceneOptions` に色を足してはならない**。色は `useModelScene` の中で
  theme ストアから直接購読する(この検査がそのまま通る)
- `web/tests/pick.test.ts:170` は
  `expect(canvas).toContain("export function ViewerCanvas({ children }: { children?: ReactNode })")`
  を検査する。**`ViewerCanvas` の引数の形を変えてはならない**(色はストアから購読する)
- `compare/overlay.ts:76-77` はモジュールスコープで
  `const outsideColor = new Color(COMPARE_OUTSIDE_COLOR);` / `insideColor` を作り、
  `colorizeDeviation` の中で `.r` / `.g` / `.b` を頂点色へ書いている。
  この 2 つの `Color` インスタンスは**再利用したまま**、`colorizeDeviation` の先頭で
  `setHex` して値を差し替える(頂点ループの外で 1 回だけ呼ぶ)

## インターフェイス契約

### `web/src/features/viewer/ViewerCanvas.tsx`

```ts
export function ViewerCanvas({ children }: { children?: ReactNode }): ReactElement;
```

引数の形は変えない。theme ストアから背景色を購読して `<color>` へ渡す。

```tsx
const background = useThemeStore(selectViewerColor("background"));
// ...
<color attach="background" args={[background]} />
```

他の要素(`SceneLights` / `FocalLengthRig` / `Bounds` / `CameraRig` / `ModelMesh` /
`PlaybackClock` / `MeshCompareRig` / `children` の並びと props)は変えない。
`meshDisplay={meshDisplay}` と `useDisplayStore` の購読も残す(既存検査)。

### `web/src/features/viewer/mesh-display.ts`

```ts
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 重ね描きの線の既定色(濃いグレー) */
export const WIREFRAME_OVERLAY_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.wireframe);

/** 重ね描きの線を描くための共有しない材質を作る。color は 0xrrggbb */
export function createWireframeOverlayMaterial(color?: number): MeshBasicMaterial;

/** mesh と同じ geometry を使う重ね描き用 Mesh を作る。color は 0xrrggbb */
export function createWireframeOverlay(mesh: Mesh, color?: number): Mesh;

/** root 配下へ表示方法を適用する。wireframeColor は 0xrrggbb */
export function applyMeshDisplay(root: Object3D, mode: MeshDisplayMode, wireframeColor?: number): void;
```

- 3 つとも色を省略したときは `WIREFRAME_OVERLAY_COLOR` を使う
- `applyMeshDisplay` は受け取った色を `createWireframeOverlay` へ渡す
- `mode` が `"solid"` のときは重ね描きを作らないので色は使われない
- `MESH_DISPLAY_OVERLAY_KEY` / `VIEWER_OVERLAY_KEY` / `WIREFRAME_OVERLAY_OPACITY` /
  `isMeshDisplayOverlay` / `isViewerOverlay` と、材質のその他の設定は変えない

### `web/src/features/viewer/useModelScene.ts`

`ModelSceneOptions` は**変えない**。フックの中で色を購読する。

```ts
const wireframeColor = useThemeStore(selectViewerColor("wireframe"));

useEffect(() => {
  applyMeshDisplay(scene, meshDisplay, hexToNumber(wireframeColor));
}, [meshDisplay, scene, wireframeColor]);

// 最後の後片付けも同じ色を渡す("solid" では使われない)
useEffect(() => () => applyMeshDisplay(scene, "solid", hexToNumber(wireframeColor)), [scene, wireframeColor]);
```

他の 4 つの `useEffect`(Fit / clips / scenes 登録 / clips 登録)は変えない。

### `web/src/features/compare/overlay.ts`

```ts
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 飛び出し(正の距離)の既定色。赤 */
export const COMPARE_OUTSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside);
/** へこみ(負の距離)の既定色。青 */
export const COMPARE_INSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside);

/** 比較の色。値は 0xrrggbb */
export interface CompareColors {
  /** 飛び出し(正の距離) */
  outside: number;
  /** へこみ(負の距離) */
  inside: number;
}

/** 符号付き距離に応じて color 属性を書き直す。 */
export function colorizeDeviation(
  geometry: BufferGeometry,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
): void;

/** 比較重ね描きを作成または再利用し、距離で色を塗る。 */
export function applyCompareOverlay(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
): Mesh;
```

- `colorizeDeviation` は頂点ループの**前**に
  `outsideColor.setHex(colors.outside)` / `insideColor.setHex(colors.inside)` を 1 回呼ぶ
- `color` 属性が無い / `itemSize !== 4` のときの早期 return、全頂点の 0 クリア、
  `distance` が非有限 / 0 のときのスキップ、`threshold` の比較、`COMPARE_OVERLAY_OPACITY`、
  `needsUpdate` は変えない
- `applyCompareOverlay` は受け取った `colors` を `colorizeDeviation` へ渡す。
  重ね描きの再利用・生成の判定は変えない
- `createCompareOverlayMaterial`(頂点色を使うので `color: 0xffffff` のまま)、
  `createCompareOverlayGeometry`、`createCompareOverlay`、`clearCompareOverlays`、
  `isMeshCompareOverlay`、`MESH_COMPARE_OVERLAY_KEY`、`COMPARE_OVERLAY_OPACITY` は変えない

### `web/src/features/compare/MeshCompareRig.tsx`

2 色を購読し、塗る側の `useEffect` の依存に足す。

```ts
const outsideColor = useThemeStore(selectViewerColor("compareOutside"));
const insideColor = useThemeStore(selectViewerColor("compareInside"));

useEffect(() => {
  if (result === null) return;
  const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
  const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) };
  for (const { mesh, signedDistance } of result.meshes) applyCompareOverlay(mesh, signedDistance, threshold, colors);
}, [result, compare.thresholdPermille, outsideColor, insideColor]);
```

距離を計算する `useEffect`(依存 `[base, target]`)と `thresholdWorld` は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `WIREFRAME_OVERLAY_COLOR` | `0x1f2937`(既存検査がそのまま通る) |
| `COMPARE_OUTSIDE_COLOR` / `COMPARE_INSIDE_COLOR` | `0xdc2626` / `0x2563eb` |
| `createWireframeOverlayMaterial()` | 色が `WIREFRAME_OVERLAY_COLOR`、他の設定は既存どおり |
| `createWireframeOverlayMaterial(0xff0000)` | 色が `0xff0000` |
| `createWireframeOverlay(mesh)` / `(mesh, 0xff0000)` | 重ね描きの材質の色が既定色 / `0xff0000` |
| `createWireframeOverlay` の他の振る舞い | 既存どおり(SkinnedMesh の bind、morph、userData のキー、raycast) |
| `applyMeshDisplay(root, "solid-wireframe", 0xff0000)` | 追加された重ね描きの色が `0xff0000` |
| `applyMeshDisplay(root, "wireframe", 0xff0000)` | 既存どおり元の材質が wireframe になり、重ね描きは作られない |
| `applyMeshDisplay(root, "solid-wireframe")`(色を省略) | 重ね描きの色が `WIREFRAME_OVERLAY_COLOR` |
| `applyMeshDisplay(root, "solid", 0xff0000)` | 既存どおり重ね描きが外される |
| `applyMeshDisplay` の他の振る舞い | 既存どおり(重複呼び出しで増えない、InstancedMesh の扱い、材質が配列のとき、polygonOffset の復元) |
| `useModelScene.ts` のソース | `applyMeshDisplay(scene, meshDisplay, ` と `applyMeshDisplay(scene, "solid", ` を含み、`useThemeStore(` を含む |
| `useModelScene.ts` のソース | `const { versionId, primary, meshDisplay } = options;` を含む(既存検査。`ModelSceneOptions` を変えていない) |
| `ViewerCanvas.tsx` のソース | `export function ViewerCanvas({ children }: { children?: ReactNode })` を含む(既存検査) |
| `ViewerCanvas.tsx` のソース | `<color attach="background" args={[` に続けてストア由来の変数を渡しており、`"#f5f7fa"` の直値を含まない |
| `ViewerCanvas.tsx` のソース | `useDisplayStore` と `meshDisplay={meshDisplay}` を含む(既存検査) |
| `colorizeDeviation(geometry, d, t, { outside: 0xff0000, inside: 0x00ff00 })` | しきい値以上の頂点が `0xff0000` 相当、しきい値以下が `0x00ff00` 相当の頂点色になる |
| 同上 | alpha が `COMPARE_OVERLAY_OPACITY`、範囲内の頂点は全成分 0 |
| `colorizeDeviation` を別の色で 2 回呼ぶ | 2 回目の色が反映される(モジュールの `Color` を再利用しても前回の値が残らない) |
| `colorizeDeviation` の他の振る舞い | 既存どおり(color 属性なし / itemSize が 4 でない / 非有限 / 距離 0 / 長さ不一致で例外にならない) |
| `applyCompareOverlay(mesh, d, t, colors)` | 重ね描きが作られ、渡した色で塗られる |
| 同じ mesh へ色を変えて `applyCompareOverlay` | 重ね描きが増えず、色が新しい値になる |
| `MeshCompareRig` のソース | `}, [result, compare.thresholdPermille, outsideColor, insideColor]);` を含む |
| `MeshCompareRig` のソース | `}, [base, target]);` を含み、距離計算の effect が `thresholdPermille` を含まない(既存検査) |
| `MeshCompareRig` のソース | `useDisplayStore` / `useModelScenesStore` / `isMeshCompareActive(` / `computeDeviation(` / `clearCompareOverlays(` / `applyCompareOverlay(` を含み、`useFrame` を含まない(既存検査) |
| `MeshCompareRig` を描画して比較中に `compareOutside` の色を変更 | 距離の再計算は走らず、塗り直しだけが走る |
| 背景色を変更 | `ViewerCanvas` の `<color>` に新しい値が渡る |
| ワイヤフレーム色を変更(`solid-wireframe` 表示中) | 重ね描きが作り直され、新しい色になる |

## やらないこと
- **選択・ボーンの色**(`outliner/`、`joint/`)。120 の担当。
  `web/tests/outliner-highlight.test.ts` は 120 が owns するので**触らない**
  (だからワイヤフレーム側の色引数を省略可能にしている)
- **軌跡の色**(`trail/`)。121 の担当
- `web/src/store/theme.ts` / `viewer-colors.ts` の変更(115 の成果物)
- 表示色の設定 UI(118 / 119 の担当)
- `ModelSceneOptions` への色の追加。`model-scene.test.ts:86` の検査を壊すので、
  色は `useModelScene` の中でストアから購読する
- `ViewerCanvas` の props の変更。`pick.test.ts:170` の検査を壊す
- `ModelMesh.tsx` / `deviation.ts` / `model-scenes.ts` / `SceneLights.tsx` / `viewer.css` の変更。
  照明の色・ライトギズモの色(`LightGizmo.tsx` の `#d0d5dd` / `#f59e0b`)は今回の 11 色に含まれない
- 既存テストの `expect` の削除・緩和。依存配列とソース文字列の検査は**文字列を更新**するだけで、
  検査自体は残す
- ルーム共有(`shared/` / `server/` / `realtime-dispatch.ts`)。色は端末ローカルである

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `viewer_Summary.md` と `compare_Summary.md` の公開インターフェイスを新しいシグネチャに更新し、
      色が theme ストア由来であることを「他フォルダとの関係」に書いている
- [ ] `viewer_Summary.md` の `## テスト` に `tests/mesh-display-color.test.ts`、
      `compare_Summary.md` の `## テスト` に `tests/compare-overlay-color.test.ts` を追記している
      (`web/tests/summary-coverage.test.ts` が新しいテストの掲載を機械検証する)
- [ ] すべてのファイルが300行以内(`compare/overlay.ts` は現在 142 行、
      `viewer_Summary.md` は 159 行、`mesh-display.ts` は 110 行台)
- [ ] verify: に書いたコマンドが成功する
