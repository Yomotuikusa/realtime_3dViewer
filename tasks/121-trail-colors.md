---
id: 121
title: モーション軌跡の線・フレーム点・現在位置の色を表示色設定から取る
feature: trail
depends_on: [115]
owns: [web/src/features/trail/trail-overlay.ts, web/src/features/trail/TrailRig.tsx, web/src/features/trail/trail_Summary.md, web/tests/trail-overlay.test.ts, web/tests/trail-rig.test.ts]
reads: [web/src/features/theme/viewer-colors.ts, web/src/store/theme.ts, web/src/store/display.ts, web/src/store/playback.ts, web/src/features/trail/trail-sample.ts, web/src/features/trail/trail-target.ts, web/src/features/trail/model-clips.ts, web/src/features/joint/joint-display.ts, web/src/features/compare/model-scenes.ts, web/src/features/viewer/playback-frames.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
モーション軌跡の 3 色(折れ線・各フレームの点・現在位置のマーカー)を、
115 で作った表示色設定から取るようにする。設定で色を変えたら軌跡が描き直される。

## 前提
- 115 の `web/src/features/theme/viewer-colors.ts` に `hexToNumber(hex): number` と
  `VIEWER_COLOR_DEFAULTS` がある。`.light.trailLine === "#facc15"`、
  `.light.trailPoint === "#fef3c7"`、`.light.trailCurrent === "#f97316"`
- 115 の `web/src/store/theme.ts` に `useThemeStore` と `selectViewerColor(key)` がある。
  **このタスクではストアを変更しない**
- 今の色は `trail-overlay.ts:20,22,24` の 3 つのモジュール定数。
  `web/tests/trail-overlay.test.ts:63` が `TRAIL_LINE_COLOR` を import して材質の色と比較しているので、
  **定数は export したまま残す**(値も変えない)
- `addTrailOverlay` の呼び出し元は grep で洗い出した次で全部である。
  - ソース: `web/src/features/trail/TrailRig.tsx`(1 箇所)
  - テスト: `web/tests/trail-overlay.test.ts`
  - `web/tests/trail-rig.test.ts` は `trailOverlayOf` だけを import し、`addTrailOverlay` は呼ばない
- **`web/tests/trail-rig.test.ts:177` は `TrailRig.tsx` の `useEffect` の依存配列を
  文字列そのままで検査している**。

  ```ts
  expect(source).toContain("}, [scenes, clips, motionTrail, clipIndex, fps]);");
  ```

  依存配列に色を足すとこの行は**必ず落ちる**。`trail-rig.test.ts` を owns に入れてあるので、
  この行を実装後の依存配列の文字列へ書き換えること(検査を消すのではなく更新する)。
  同ファイルの他の検査(`export function TrailRig(): null`、各ストアの購読、`useFrame(`、
  `ReviewPage` からの import)は**消さず緩めず**そのまま通す
- 軌跡のオーバーレイは `Group` の子を **[0] 折れ線 / [1] 点 / [2] 現在位置マーカー** の
  固定順で持つ(`setTrailCurrentFrame` が `children[2]` を直接触る)。この順序は変えない
- `TrailRig` の `useEffect` は毎回 `removeTrailOverlay` → `addTrailOverlay` で作り直す形になっている。
  **色を依存に足せば、色が変わったときに作り直される**

## インターフェイス契約

### `web/src/features/trail/trail-overlay.ts`

定数の定義を既定値から導出する形に変える(値は変わらない)。

```ts
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 軌跡の折れ線の既定色 */
export const TRAIL_LINE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.trailLine);
/** 各フレームの点の既定色 */
export const TRAIL_POINT_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.trailPoint);
/** 現在フレームのマーカーの既定色 */
export const TRAIL_CURRENT_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.trailCurrent);
```

色を引数で受け取る。**既定引数にはしない**(渡し忘れが既定色のまま動いてしまうため)。

```ts
/** 軌跡の色。値は 0xrrggbb */
export interface TrailColors {
  /** 折れ線 */
  line: number;
  /** 各フレームの点 */
  point: number;
  /** 現在フレームのマーカー */
  current: number;
}

export function addTrailOverlay(
  root: Object3D,
  sample: TrailSample,
  markerRadius: number,
  colors: TrailColors,
): TrailOverlay;
```

- `LineBasicMaterial` に `colors.line`、`PointsMaterial` に `colors.point`、
  マーカーの `MeshBasicMaterial` に `colors.current` を使う
- 材質のその他の設定(`depthTest: false`、`depthWrite: false`、`toneMapped: false`、
  点の `size`、マーカーの半径、`renderOrder`、`frustumCulled`、`userData`)は変えない
- 先頭の `removeTrailOverlay(root)`、子の追加順、最後の `setTrailCurrentFrame(overlay, 0)` も変えない
- `TRAIL_OVERLAY_KEY` / `TRAIL_POINT_SIZE_SCALE` / `TRAIL_CURRENT_RADIUS_SCALE` /
  `TRAIL_RENDER_ORDER` / `TrailOverlay` / `trailOverlayOf` / `setTrailCurrentFrame` /
  `removeTrailOverlay` は変えない

### `web/src/features/trail/TrailRig.tsx`

3 色を購読して `addTrailOverlay` へ渡し、`useEffect` の依存に足す。

```ts
const lineColor = useThemeStore(selectViewerColor("trailLine"));
const pointColor = useThemeStore(selectViewerColor("trailPoint"));
const currentColor = useThemeStore(selectViewerColor("trailCurrent"));
```

```ts
addTrailOverlay(target.root, sample, jointRadius(target.root), {
  line: hexToNumber(lineColor),
  point: hexToNumber(pointColor),
  current: hexToNumber(currentColor),
});
```

`useEffect` の依存配列を
`[scenes, clips, motionTrail, clipIndex, fps, lineColor, pointColor, currentColor]` にする。
`useFrame` の中身、`resolveTrailTarget` / `selectModelClips` / `sampleTrail` の使い方は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `TRAIL_LINE_COLOR` / `TRAIL_POINT_COLOR` / `TRAIL_CURRENT_COLOR` | `0xfacc15` / `0xfef3c7` / `0xf97316`(既存検査がそのまま通る) |
| `addTrailOverlay(root, sample, r, { line: 0xff0000, point: 0x00ff00, current: 0x0000ff })` | 子[0] の材質の色が `0xff0000`、子[1] が `0x00ff00`、子[2] が `0x0000ff` |
| 同上 | 子の数が 3、順序が 折れ線 / 点 / マーカー のまま |
| 同上 | `userData` の `frameCount` / `positions` / 各キーが既存どおり |
| 同上 | 点の `size` が `markerRadius * TRAIL_POINT_SIZE_SCALE` のまま |
| 同上 | マーカーが 0 フレーム目の位置に置かれている(`setTrailCurrentFrame(overlay, 0)` 相当) |
| 既に軌跡がある root へ色を変えて `addTrailOverlay` | 古い軌跡が外されて破棄され、新しい色の軌跡が 1 つだけ残る |
| `setTrailCurrentFrame` | 既存どおり(フレームのクランプ、NaN で 0、位置の反映) |
| `removeTrailOverlay` | 既存どおり(geometry と material の破棄) |
| `TrailRig` のソース | `}, [scenes, clips, motionTrail, clipIndex, fps, lineColor, pointColor, currentColor]);` を含む |
| `TrailRig` のソース | `export function TrailRig(): null` / `useDisplayStore(` / `useModelScenesStore(` / `useModelClipsStore(` / `usePlaybackStore(` / `useFrame(` を含む(既存検査) |
| `TrailRig` のソース | `useThemeStore(` を含む |
| `TrailRig` を描画して軌跡を表示中に `trailLine` の色を変更 | 軌跡が作り直され、折れ線が新しい色になる |
| `TrailRig` を描画して軌跡を表示中に `trailCurrent` の色を変更 | マーカーが新しい色になる |
| 色を変えても軌跡が非表示のとき | 軌跡が作られない(`motionTrail.visible` が false のままなら何も描かない) |
| `TrailRig` の他の振る舞い | 既存どおり(対象が解決できないとき何もしない、クリップが無いとき何もしない、アンマウントで外す) |

## やらないこと
- **選択・ボーンの色**(`outliner/`、`joint/`)。120 の担当。
  `joint-display.ts` の `jointRadius` は import して使うだけで変更しない
- **背景・ワイヤフレーム・比較の色**(`viewer/`、`compare/`)。122 の担当
- `web/src/store/theme.ts` / `viewer-colors.ts` の変更(115 の成果物)
- 表示色の設定 UI(118 / 119 の担当)と、HUD の軌跡バー(`TrailBar.tsx`)の変更
- `trail-sample.ts` / `trail-target.ts` / `model-clips.ts` の変更。軌跡の計算には触らない
- 前後フレーム数や線の太さの設定。色だけを設定可能にする
- 既存テストの `expect` の削除・緩和。`trail-rig.test.ts:177` は依存配列の**文字列を更新**するだけで、
  検査自体は残す
- ルーム共有(`shared/` / `server/` / `realtime-dispatch.ts`)。色は端末ローカルである

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `trail_Summary.md` の公開インターフェイスを新しいシグネチャに更新し、
      色が theme ストア由来であることを「他フォルダとの関係」に書いている
- [ ] すべてのファイルが300行以内(`trail-overlay.ts` は現在 141 行、`trail_Summary.md` は 41 行)
- [ ] verify: に書いたコマンドが成功する
