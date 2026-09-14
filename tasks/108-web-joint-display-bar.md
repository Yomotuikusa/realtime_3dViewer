---
id: 108
title: web HUD にジョイント表示と x-ray の切り替えを置く
feature: web
depends_on: [106, 107]
owns: [web/src/features/joint/JointDisplayBar.tsx, web/src/features/joint/joint-icons.tsx, web/src/features/joint/joint-labels.ts, web/src/features/joint/joint_Summary.md, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/joint-display-bar.test.ts]
reads: [web/src/features/viewer/DisplayModeBar.tsx, web/src/features/viewer/display-icons.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/styles/controls.css, web/src/store/display.ts, web/src/features/joint/joint-display.ts, web/src/features/joint/JointRig.tsx, web/tests/display-mode-bar.test.ts, web/tests/viewer-styles.test.ts, web/tests/summary-coverage.test.ts, shared/src/joint.ts, shared/src/protocol.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
ジョイントの可視化(107)を HUD から切り替えられるようにする。
「ジョイントを表示するか」と「x-ray にするか」の2つのトグルを、既存のメッシュ表示モードバーの隣に常設し、
押したらローカルのストアを更新してから `joint:display` をルームへ送る。

## 前提
- display ストアに `jointDisplay: { visible, xray }` と `setJointDisplay` がある(106)。web/src/store/display.ts
- 送信するメッセージは `{ type: "joint:display", display }`。値全体を送る(`mesh:compare` と同じ流儀)。
  同値判定は `jointDisplayEquals`(`@shared/joint`。`@shared/types` ではない)
- `visible` が false のときジョイントは描かれないので、x-ray の切り替えは意味を持たない
- 同種の常設バーの前例は `DisplayModeBar`。`div.hud-display[role=group][aria-label]` の中に
  `button.btn.hud-display__btn[aria-pressed][aria-label][title]` を並べ、中身はインライン SVG アイコンだけを置く。
  web/src/features/viewer/DisplayModeBar.tsx
- 使うクラス `.hud-display` / `.hud-display__btn` / `.hud-display__icon` は viewer.css:100-129 に、
  `.btn[disabled]`(`opacity: 0.5` / `cursor: not-allowed`)は styles/controls.css:35-38 にすでにある。
  **CSS の追加は不要**
- アイコンは「パス定数を export し、コンポーネントは属性だけを持つ」流儀。`web/tests/display-mode-bar.test.ts` が
  その断言の書き方の見本(要素関数を直接呼んで `props` を検査する。DOM へはレンダリングしない)
- `ViewerHud.tsx` は現在 86行、`viewer_Summary.md` は 159行。どちらも追記だけで収まる

## インターフェイス契約

### 新規 web/src/features/joint/joint-labels.ts

```ts
/** ジョイント表示バーの role="group" の aria-label */
export const JOINT_DISPLAY_LABEL = "ジョイントの表示";
/** 表示トグルのボタン名(aria-label / title) */
export const JOINT_VISIBLE_LABEL = "ジョイント";
/** x-ray トグルのボタン名(aria-label / title) */
export const JOINT_XRAY_LABEL = "ジョイントの透過表示(x-ray)";
```

### 新規 web/src/features/joint/joint-icons.tsx

```tsx
import type { ReactElement } from "react";

export const JOINT_VIEW_BOX = "0 0 16 16";
/** ジョイント球の中心 [cx, cy]。親から子へ並べる */
export const JOINT_POINTS: readonly (readonly [number, number])[] = [[5, 12], [8, 8], [11, 4]];
/** ジョイント球の半径 */
export const JOINT_DOT_RADIUS = 1.6;
/** JOINT_POINTS を順に結ぶ親子リンクの折れ線 */
export const JOINT_LINK_PATH = "M5 12 8 8 11 4";
/** x-ray アイコンでジョイントの手前に重なるメッシュ面 */
export const JOINT_XRAY_SURFACE = "M2.5 2.5h11v11h-11Z";

/** 骨だけ。リンクは線、ジョイントは塗りつぶした円 */
export function JointIcon(): ReactElement;
/** 骨の手前に半透明の面を重ね、面越しに骨が見えることを表す */
export function JointXrayIcon(): ReactElement;
```

- 両方の `svg` のルート属性は `className="hud-display__icon"`、`viewBox={JOINT_VIEW_BOX}`、
  `aria-hidden="true"`、`focusable="false"`、`fill="none"`、`stroke="currentColor"`、`strokeWidth="1"`。
  `width` / `height` は持たせない
- リンクは `<path d={JOINT_LINK_PATH} />`、ジョイントは `JOINT_POINTS.map` で
  `<circle cx cy r={JOINT_DOT_RADIUS} fill="currentColor" stroke="none" />`
- `JointXrayIcon` は上記に加えて、骨より**後ろに**(= JSX の末尾に)
  `<path d={JOINT_XRAY_SURFACE} fill="currentColor" fillOpacity={0.25} stroke="none" />` を置く

### 新規 web/src/features/joint/JointDisplayBar.tsx

```tsx
export function JointDisplayBar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

- `jointDisplay = useDisplayStore((state) => state.jointDisplay)`、
  `setJointDisplay = useDisplayStore((state) => state.setJointDisplay)`
- 共通の適用関数を1つ持つ。`jointDisplayEquals(jointDisplay, next)` なら何もせず、
  そうでなければ `setJointDisplay(next)` の後に `send({ type: "joint:display", display: next })`
- 外枠は `<div className="hud-display" role="group" aria-label={JOINT_DISPLAY_LABEL}>`
- 1つ目のボタン: `aria-pressed={jointDisplay.visible}`、`aria-label` / `title` は `JOINT_VISIBLE_LABEL`、
  押すと `{ ...jointDisplay, visible: !jointDisplay.visible }`、中身は `<JointIcon />`
- 2つ目のボタン: `aria-pressed={jointDisplay.xray}`、`aria-label` / `title` は `JOINT_XRAY_LABEL`、
  `disabled={!jointDisplay.visible}`、押すと `{ ...jointDisplay, xray: !jointDisplay.xray }`、
  中身は `<JointXrayIcon />`
- 両ボタンとも `className="btn hud-display__btn"`、`type="button"`
- ラベル文字列を DOM の子として出さない(アイコンのみ)

### 変更 web/src/features/viewer/ViewerHud.tsx

`import { JointDisplayBar } from "../joint/JointDisplayBar";` を足し、`div.hud-menus` の中の
`<DisplayModeBar send={send} />` の**直後**に `<JointDisplayBar send={send} />` を置く。他は変更しない。

## 振る舞い

### web/tests/joint-display-bar.test.ts(新規)

`web/tests/display-mode-bar.test.ts` と同じ流儀で、アイコンは要素関数を直接呼んで `props` を検査し、
バーと HUD はソースの文字列検査で確かめる。

#### アイコン

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `JOINT_VIEW_BOX` | `"0 0 16 16"` |
| `JOINT_POINTS` | 長さ3。各要素が `[number, number]` で、すべて 0〜16 の範囲 |
| `JOINT_LINK_PATH` | `M` をちょうど1つ含み、`Z` を含まない。`JOINT_POINTS` の各座標が文字列として現れる |
| `JOINT_XRAY_SURFACE` | `Z` で終わる閉じたパス |
| `JointIcon()` | `type === "svg"`。`viewBox`・`className="hud-display__icon"`・`aria-hidden="true"`・`focusable="false"`・`fill="none"`・`stroke="currentColor"`・`strokeWidth="1"`。`width` / `height` が `undefined` |
| `JointIcon()` の子 | `JOINT_LINK_PATH` の `path` を1つと、`circle` を `JOINT_POINTS` と同数持つ |
| `JointIcon()` の各 `circle` | `fill="currentColor"`、`stroke="none"`、`r === JOINT_DOT_RADIUS`、`cx` / `cy` が `JOINT_POINTS` と一致 |
| `JointXrayIcon()` | ルート属性は `JointIcon()` と同じ |
| `JointXrayIcon()` の子 | `JointIcon()` の子に加えて `d === JOINT_XRAY_SURFACE` の `path` を1つ持ち、それが**最後**の子である |
| その面の属性 | `fill="currentColor"`、`fillOpacity === 0.25`、`stroke="none"` |

#### バーと HUD のソース検査

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `features/joint/JointDisplayBar.tsx` | `className="btn hud-display__btn"` をちょうど2回含む |
| 同上 | `aria-label={JOINT_DISPLAY_LABEL}`、`role="group"`、`className="hud-display"` を含む |
| 同上 | `type: "joint:display"` と `jointDisplayEquals(` を含む |
| 同上 | `disabled={!jointDisplay.visible}` を含む |
| 同上 | `<JointIcon />` と `<JointXrayIcon />` をそれぞれ1回含む |
| 同上 | `btn--quiet`、`onClose`、`MESH_DISPLAY` を含まない。ラベルを子として出す `>{JOINT_` を含まない |
| 同上 | `jointDisplayEquals` を `@shared/joint` か `@shared/types` からではなく **`@shared/joint`** から import している |
| `features/joint/joint-labels.ts` | 3つの定数がすべて日本語を含む空でない文字列 |
| `features/viewer/ViewerHud.tsx` | `<JointDisplayBar send={send} />` をちょうど1回含み、その位置が `<DisplayModeBar send={send} />` より後、`</div>`(hud-menus の閉じ)より前 |
| 同上 | `useDisplayStore` を含まない(表示状態はバー側だけが購読する) |
| `features/viewer/viewer.css` | `.hud-display` と `.hud-display__btn` と `.hud-display__icon` の定義を含む(既存の再利用。追記していないこと) |

## やらないこと
- `viewer.css` / `styles/controls.css` / 新規 CSS の追加・変更(既存クラスをそのまま使う)
- `DisplayModeBar.tsx` / `display-icons.tsx` / `hud-labels.ts` の変更(ジョイントの文言は joint 側に置く)
- `web/src/store/display.ts` / `shared` / `server` の変更(106 で済んでいる)
- `joint-display.ts` / `JointRig.tsx` の変更(107 で済んでいる)
- キーボードショートカットの割り当て(`features/shortcuts` は触らない)
- ジョイントの色・大きさ・ラベル表示の UI

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・属性・定数名で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存テスト(特に `display-mode-bar.test.ts` と
      `viewer-styles.test.ts`)も通る
- [ ] joint_Summary.md を更新している。`JointDisplayBar.tsx` / `joint-icons.tsx` / `joint-labels.ts` を
      ファイル一覧と公開インターフェイスに追加し、他フォルダとの関係に
      「HUD への設置は `features/viewer/ViewerHud.tsx`。スタイルは viewer.css の `.hud-display` を再利用する」と書き、
      テスト節に `joint-display-bar.test.ts` を載せる
- [ ] viewer_Summary.md の `ViewerHud.tsx` の説明(ファイル一覧・公開インターフェイス・他フォルダとの関係)に
      ジョイント表示バーを追記している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
