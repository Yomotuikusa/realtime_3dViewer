---
id: 120
title: 選択オブジェクトとボーンの重ね描きの色を表示色設定から取る
feature: outliner
depends_on: [115]
owns: [web/src/features/outliner/selection-highlight.ts, web/src/features/outliner/SelectionRig.tsx, web/src/features/outliner/outliner_Summary.md, web/src/features/joint/joint-display.ts, web/src/features/joint/joint-highlight.ts, web/src/features/joint/JointRig.tsx, web/src/features/joint/joint_Summary.md, web/tests/outliner-highlight.test.ts, web/tests/outliner-highlight-color.test.ts, web/tests/joint-display.test.ts, web/tests/joint-highlight.test.ts, web/tests/joint-update.test.ts, web/tests/joint-pick.test.ts, web/tests/joint-rig.test.ts]
reads: [web/src/features/theme/viewer-colors.ts, web/src/store/theme.ts, web/src/store/display.ts, web/src/features/outliner/selection.ts, web/src/features/compare/model-scenes.ts, web/src/features/viewer/mesh-display.ts, web/src/features/joint/joint-pick.ts, web/src/features/trail/TrailRig.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
選択したオブジェクトのオレンジ、ボーンの関節と親子リンク、選択したボーンの色を、
115 で作った表示色設定から取るようにする。設定で色を変えたら 3D ビューの重ね描きが
その色で描き直されるところまでを作る。

## 前提
- 115 の `web/src/features/theme/viewer-colors.ts` に次がある。
  - `hexToNumber(hex): number`(`"#rrggbb"` → `0xrrggbb`)
  - `VIEWER_COLOR_DEFAULTS.light.selection === "#f97316"`、`.joint === "#22d3ee"`、
    `.jointLink === "#0e7490"`、`.jointSelected === "#f97316"`
- 115 の `web/src/store/theme.ts` に `useThemeStore` と
  `selectViewerColor(key): (state) => string` がある。**このタスクではストアを変更しない**
- 今の色は次の 4 つのモジュール定数で、**export したまま残す**(値も変えない)。
  他フォルダのテストが import しているため消してはならない。
  - `selection-highlight.ts:19` `SELECTION_COLOR = 0xf97316`
  - `joint-display.ts:22` `JOINT_COLOR = 0x22d3ee`
  - `joint-display.ts:24` `JOINT_LINK_COLOR = 0x0e7490`
  - `joint-highlight.ts:8` `SELECTED_JOINT_COLOR = 0xf97316`
- `web/tests/outliner-highlight.test.ts:53` に `expect(SELECTION_COLOR).toBe(0xf97316)` がある。
  定数を `hexToNumber(VIEWER_COLOR_DEFAULTS.light.selection)` から導出しても**この検査は通る**
- **`web/tests/outliner-highlight.test.ts` は現在 232 行で、上限 300 行に近い**。
  このファイルへは**既存の呼び出しへ色の引数を足す修正だけ**を行い、
  色に関する新しい検査は owns に用意した `web/tests/outliner-highlight-color.test.ts` へ書く
  (`joint-display.test.ts` は 161 行、`joint-highlight.test.ts` は 83 行なので、
  ジョイント側の新しい検査は既存ファイルへ足してよい)
- 色を受け取るようにする関数の呼び出し元は、grep で洗い出した次で全部である。
  **owns に挙げたテストがすべて引数を足す必要がある**。
  | 関数 | 呼び出し元(ソース) | 呼び出し元(テスト) |
  | --- | --- | --- |
  | `createSelectionOverlay` | `selection-highlight.ts` 内 | `outliner-highlight.test.ts` |
  | `applySelectionHighlight` | `SelectionRig.tsx` | `outliner-highlight.test.ts` |
  | `addJointOverlay` | `JointRig.tsx` | `joint-display.test.ts` / `joint-update.test.ts` / `joint-pick.test.ts` |
  | `addSelectedJointMarker` | `JointRig.tsx` | `joint-highlight.test.ts` |
- `web/tests/joint-rig.test.ts` は `JointRig.tsx` / `SelectionRig.tsx` などの**ソース文字列**を検査する。
  `expect(source).toContain("addJointOverlay(")` や、
  `mesh-display.ts` / `visibility.ts` が `addJointOverlay` を含まないことを確かめている。
  これらの検査は消さず緩めず、**色の引数が増えても通る形**にする
- **`web/tests/joint-rig.test.ts:28-29` は `useEffect` の依存配列を文字列そのままで検査している**。

  ```ts
  expect(source).toContain("}, [scenes, jointDisplay.visible]);");
  expect(source).toContain("}, [scenes, jointDisplay.visible, jointDisplay.xray]);");
  ```

  依存配列に色を足すとこの 2 行は**必ず落ちる**。`joint-rig.test.ts` を owns に入れてあるので、
  この 2 行を新しい依存配列の文字列へ書き換えること(検査そのものを消すのではなく、
  実装後の依存配列に合わせて更新する)。x-ray の `useEffect` は依存を変えないので
  2 行目はそのままでよい
- Rig は `useEffect` の依存配列で作り直す流儀になっている
  (`SelectionRig.tsx` は `[scene, selected]`、`JointRig.tsx` は `[scenes, jointDisplay.visible]` など)。
  **色を依存に足せば、色が変わったときにクリーンアップ → 再生成が走る**
- `joint-highlight.ts` の `addSelectedJointMarker(root, bone)` は
  「既にマーカーがあれば `userData.bone` を差し替えて**同じマーカーを返す**」ようになっている
  (`joint-highlight.test.ts:54` が `toBe(marker)` で確かめている)。この再利用は保つ

## インターフェイス契約

### `web/src/features/outliner/selection-highlight.ts`

定数の定義を既定値から導出する形に変える(値は変わらない)。

```ts
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 選択重ね描きの既定色。UI の accent(青)や比較の重ね描きと区別できるオレンジ */
export const SELECTION_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.selection);
```

色を引数で受け取るようにする。**既定引数にはしない**
(渡し忘れが既定値のまま動いてしまい、色が変わらない不具合に気づけなくなるため)。

```ts
/** object と同じ geometry を共有する選択重ね描きを作る。color は 0xrrggbb */
export function createSelectionOverlay(object: Object3D, color: number): Object3D | null;

/** target 配下の描画対象へ選択重ね描きを追加する。color は 0xrrggbb */
export function applySelectionHighlight(target: Object3D, color: number): void;
```

`color` は Mesh / Line / Points の 3 つの重ね描き材質すべてに使う。
`SELECTION_OVERLAY_KEY` / `SELECTION_MESH_OPACITY` / `isSelectionOverlay` /
`clearSelectionHighlight` は変えない。

### `web/src/features/outliner/SelectionRig.tsx`

```ts
export function SelectionRig(): null;
```

`useThemeStore` から選択色を購読して `applySelectionHighlight` へ渡す。

```ts
const color = useThemeStore(selectViewerColor("selection"));
// ...
useEffect(() => {
  if (scene === null || selected === null) return;
  const target = scene.getObjectByProperty("uuid", selected.objectId);
  if (target === undefined) return;
  applySelectionHighlight(target, hexToNumber(color));
  return () => clearSelectionHighlight(scene);
}, [scene, selected, color]);
```

`useEffect` の依存に `color` を足す。他の処理は変えない。

### `web/src/features/joint/joint-display.ts`

```ts
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

export const JOINT_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.joint);
export const JOINT_LINK_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.jointLink);

/** ジョイント可視化の色。値は 0xrrggbb */
export interface JointColors {
  /** 関節の球 */
  joint: number;
  /** 親子リンクの線 */
  link: number;
}

/** root 配下のボーンを可視化し、root へ追加する。 */
export function addJointOverlay(root: Object3D, colors: JointColors): JointOverlay | null;
```

- 球の `MeshBasicMaterial` に `colors.joint`、リンク線の `LineBasicMaterial` に `colors.link` を使う
- 既にオーバーレイがある場合の「そのまま返す」振る舞いは変えない
  (色の差し替えは Rig が作り直すことで行う)
- `collectJoints` / `jointLinks` / `jointOverlayOf` / `jointRadius` / `updateJointOverlay` /
  `setJointOverlayXray` / `removeJointOverlay` と各定数は変えない

### `web/src/features/joint/joint-highlight.ts`

```ts
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

export const SELECTED_JOINT_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.jointSelected);

/** root 直下へマーカーを追加して返す。color は 0xrrggbb */
export function addSelectedJointMarker(root: Object3D, bone: Bone, color: number): SelectedJointMarker;
```

既存マーカーを再利用する経路では、`userData.bone` の差し替えに加えて
**材質の色も `color` へ合わせる**(`material.color.setHex(color)`)。
マーカーの材質は `MeshBasicMaterial` で、`marker.material` が配列でないことは生成側で保証されている。
`selectedJointMarkerOf` / `updateSelectedJointMarker` / `removeSelectedJointMarker` と各定数は変えない。

### `web/src/features/joint/JointRig.tsx`

3 つの色を購読し、それぞれの `useEffect` の依存に足す。

```ts
const jointColor = useThemeStore(selectViewerColor("joint"));
const linkColor = useThemeStore(selectViewerColor("jointLink"));
const selectedColor = useThemeStore(selectViewerColor("jointSelected"));
```

- `addJointOverlay(scene, { joint: hexToNumber(jointColor), link: hexToNumber(linkColor) })` を呼ぶ
  `useEffect` の依存を `[scenes, jointDisplay.visible, jointColor, linkColor]` にする
- `addSelectedJointMarker(scene, target, hexToNumber(selectedColor))` を呼ぶ
  `useEffect` の依存を `[scenes, jointDisplay.visible, selected, selectedColor]` にする
- x-ray の `useEffect` と `useFrame` は変えない

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `SELECTION_COLOR` | `0xf97316`(既存検査がそのまま通る) |
| `JOINT_COLOR` / `JOINT_LINK_COLOR` / `SELECTED_JOINT_COLOR` | `0x22d3ee` / `0x0e7490` / `0xf97316` |
| `createSelectionOverlay(mesh, 0xff0000)` | Mesh の重ね描きの材質の色が `0xff0000` |
| `createSelectionOverlay(line, 0xff0000)` / `(points, 0xff0000)` | Line / Points の重ね描きの材質の色が `0xff0000` |
| `createSelectionOverlay` の他の振る舞い | 既存どおり(SkinnedMesh の bind、morph の共有、Group / Bone / Light / Camera で null、userData のキー) |
| `applySelectionHighlight(target, 0x00ff00)` | target 配下の全重ね描きの色が `0x00ff00` |
| `applySelectionHighlight` の重複呼び出し | 既存どおり重ね描きが増えない |
| `addJointOverlay(root, { joint: 0xff0000, link: 0x00ff00 })` | 球の材質の色が `0xff0000`、リンク線の材質の色が `0x00ff00` |
| `addJointOverlay` の他の振る舞い | 既存どおり(ボーン 0 個で null、2 回目は同じ overlay、userData、x-ray 既定、frustumCulled) |
| `addSelectedJointMarker(root, bone, 0xff0000)` | マーカーの材質の色が `0xff0000` |
| 同じ root で色を変えて `addSelectedJointMarker` を再呼び出し | **同じマーカーが返り**、`userData.bone` が新しいボーン、材質の色が新しい色に変わる |
| `addSelectedJointMarker` の他の振る舞い | 既存どおり(半径、renderOrder、raycast、frustumCulled、userData) |
| `SelectionRig` のソース | `applySelectionHighlight(` の呼び出しに色の引数があり、`useEffect` の依存配列に色が入っている |
| `SelectionRig` を描画し選択ありで theme の `selection` を変更 | 重ね描きが作り直され、新しい色になる(古い重ね描きが残らない) |
| `JointRig` のソース | `addJointOverlay(` を含む(既存検査)。依存配列に `joint` / `jointLink` の色が入っている |
| `JointRig` を描画し `joint` の色を変更 | 球の色が変わる(overlay が作り直される) |
| `JointRig` を描画し `jointSelected` の色を変更 | 選択マーカーの色が変わる |
| `JointRig` を描画し `jointDisplay.xray` を変更 | 既存どおり x-ray だけが変わり、overlay は作り直されない |
| `mesh-display.ts` / `outliner/visibility.ts` のソース | `addJointOverlay` を含まない(既存検査) |
| theme の色を既定値に戻す | 重ね描きの色が既定値に戻る |

## やらないこと
- **軌跡の色**(`trail/trail-overlay.ts`、`TrailRig.tsx`)。121 の担当
- **3D の背景色・ワイヤフレームの色・比較の色**(`viewer/`、`compare/`)。122 の担当
- `web/src/store/theme.ts` / `viewer-colors.ts` / `theme-mode.ts` / `theme-storage.ts` の変更。
  import して使うだけ(115 の成果物)
- 表示色の設定 UI。118 / 119 の担当
- `joint-pick.ts` / `pick-selection.ts` / `selection.ts` / `visibility.ts` / `outliner-tree.ts` の変更。
  ピックや可視性の仕組みには触らない(`joint-pick.test.ts` は `addJointOverlay` の
  引数を足すためだけに owns に入っている)
- `updateJointOverlay` / `updateSelectedJointMarker` / `setJointOverlayXray` の中身の変更
- 既存テストの `expect` の削除・緩和。引数の追加に伴う呼び出し側の修正だけを行い、
  検査項目は減らさない
- ルーム共有(`shared/` / `server/` / `realtime-dispatch.ts`)。色は端末ローカルである

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `outliner_Summary.md` と `joint_Summary.md` の公開インターフェイスを新しいシグネチャに更新し、
      色が theme ストア由来であることを「他フォルダとの関係」に書いている
- [ ] `outliner_Summary.md` の `## テスト` に `tests/outliner-highlight-color.test.ts` を追記している
      (`web/tests/summary-coverage.test.ts` が新しいテストの掲載を機械検証する)
- [ ] すべてのファイルが300行以内(`joint-display.ts` は現在 208 行、
      `selection-highlight.ts` は 120 行、`outliner_Summary.md` は 54 行)
- [ ] verify: に書いたコマンドが成功する
