---
id: 162
title: web ドック開閉ボタンをヘッダから各ドック上部へ移し、閉じている間はビュー HUD の角に出る矢印で戻せるようにする
feature: layout
depends_on: []
owns: [web/src/app/ReviewPage.tsx, web/src/app/ReviewHeader.tsx, web/src/app/ReviewDock.tsx, web/src/app/review-icons.tsx, web/src/app/review-labels.ts, web/src/app/review.css, web/src/app/app_Summary.md, web/tests/dock-toggle.test.ts]
reads: [web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/viewer.css, web/src/features/viewer/light-gizmo.css, web/src/features/layout/useLayoutFlag.ts, web/src/features/layout/layout-storage.ts, web/src/features/outliner/Outliner.tsx, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/layout-styles.test.ts, web/tests/objects-styles.test.ts, web/tests/comments-styles.test.ts, web/tests/review-styles.test.ts, web/tests/timeline-styles.test.ts, web/tests/settings-dialog.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

161 で入れた左右ドックの開閉トグルはヘッダの左端と右端にあり、どちらのドックに効くのかが分かりにくい。
トグルを各ドックの上部へ移し、閉じている間はビューア HUD の角に出る矢印で戻せるようにする。
開閉状態の保存(`useLayoutFlag`)と列幅の計算はこのタスクでは変えない。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### 現在の DOM(変更前)

- `ReviewHeader` はヘッダの先頭と `.review-header__actions` の末尾に
  `.btn.btn--quiet.review-header__dock` のトグルを 2 個持ち、`aria-pressed` で開閉を示す。
  `web/src/app/ReviewHeader.tsx:44-52, 77-85`。props は `outlinerOpen` / `panelOpen` /
  `onToggleOutliner` / `onTogglePanel` の 4 つ。
- `ReviewPage` は開いている側だけ `<aside>` と対応する `ResizeHandle` を描画し、
  閉じている側は inline style の `--outliner-width` / `--panel-width` を `"0px"` にする。
  `web/src/app/ReviewPage.tsx:168-253`。この方式は変えない。
- 幅の上限計算は `panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0)` と
  `outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0)`。`ReviewPage.tsx:85-92`。
  **この 2 つの式は変えない**(`web/tests/layout-styles.test.ts:60-61` が文字列一致で要求する)。

### HUD の重なりとフロー

- `.review-hud` は `.review-stage` を覆う flex コンテナである。`web/src/app/review.css:135-148`。

  ```css
  .review-hud {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
    pointer-events: none;
  }

  .review-hud :is(.btn, [role="toolbar"], [role="group"], [role="status"], [role="alert"]) {
    pointer-events: auto;
  }
  ```

  **`pointer-events` が戻るのは `.btn` などに限られる。HUD に足すボタンには `.btn` を付けること。**
- `ViewerHud` のルート `.hud` は `display: contents`(`web/src/features/viewer/viewer.css:1-3`)なので、
  その子が `.review-hud` の flex 子になる。通常フローに並ぶのは `.hud__row`(左)と
  `.hud-menus`(`margin-left: auto` で右寄せ。`viewer.css:33-38`)の 2 つだけである。
  `.hud-following` は `display: contents` でその子が `position: absolute`、`.hud-hint` も
  `position: absolute`(`viewer.css:179-231`)、`.light-gizmo` も `position: absolute`
  (`web/src/features/viewer/light-gizmo.css:1-8`)で、いずれもフローを占めない。
  したがって **`<ViewerHud />` の前に置いた要素は左上の角、後ろに置いた要素は右上の角に出る**。
- `.btn` は `background: var(--color-surface)` と枠を持つ。`.btn--quiet` は枠と背景を透明にする。
  `web/src/styles/controls.css:1-32`。`.btn[aria-pressed="true"]` にアクセント色が付く(`:39-43`)ため、
  **開いている状態の表示に `aria-pressed` は使わない**(常時押下されているように見えるため)。`aria-expanded` を使う。
- `--color-surface-translucent`(`web/src/styles/tokens.css:41`)と `--shadow-overlay`(`:43`)は宣言済みで、
  HUD に浮かせるボタンの背景に使える。

### 変えてはいけない既存のスタイル検査(いずれも reads。このタスクでは変更しない)

- `web/tests/layout-styles.test.ts:43-45`: `.review-outliner` のルール本文に `overflow: auto` /
  `border-right: 1px solid var(--color-border)` / `background: var(--color-surface-subtle)` を要求する。
  **`.review-outliner` は今のまま**にし、内側に置くバーを `position: sticky` で固定する。
- `web/tests/layout-styles.test.ts:56-61`: `ReviewPage.tsx` に `side="start"` 1 件、
  `<ResizeHandle` 2 件、上記の幅上限 2 式を要求する。
  **この 1 件は `ResizeHandle` のものである。ドック側の prop に `side="start"` と書くと 2 件になって落ちるため、
  `DockSide` の値は `"outliner"` / `"panel"` にしてある。**
- `web/tests/layout-styles.test.ts:66-68`: `ReviewPage.tsx` 内の出現順
  `className="review-outliner"` < `side="start"` < `className="review-viewer"` < `className="review-panel"`。
- `web/tests/objects-styles.test.ts:57-59`: **`review.css` 全体**に文字列
  `grid-template-rows: auto auto minmax(0, 1fr)` があること(セレクタは問わない)。
- `web/tests/objects-styles.test.ts:62-68`: `ReviewPage.tsx` 内の出現順
  `<PresenceList />` < `<ObjectList` < `review-panel__comments`。
- `web/tests/comments-styles.test.ts:181-188`: `.review-panel` のルール本文に
  `background: var(--color-surface-subtle)` があること。
- `web/tests/timeline-styles.test.ts:38-47`: `ReviewPage.tsx` 内で
  `className="review-stage"` < `className="review-hud"`、`<PlaybackTimeline send={realtime.send} />` < `<JoinDialog`。
- `web/tests/review-styles.test.ts:31-38`: `.review-hud` のルール本文に `z-index` があり、
  `.review-stage__error` の `z-index` より小さいこと。
- `web/tests/settings-dialog.test.ts:153`: `ReviewHeader.tsx` が
  `/SETTINGS_OPEN_LABEL,\s*type CopyState,\s*\} from "\.\/review-labels"/s` に一致すること。
  トグル用ラベルの import を消しても、この 2 行の並びを残せば通る。
- `web/tests/styles-rules.test.ts`: `src` 配下の CSS で生の色(`#rgb` / `rgb()` / `hsl()`)、未宣言の CSS 変数参照、
  `!important`、`@import` を禁じる。属性セレクタ(`[data-side="outliner"]`)は問題ない。
- `web/tests/summary-coverage.test.ts`: `src` 配下の全ファイルが最寄りの `<フォルダ名>_Summary.md` に
  相対パス文字列で載っていること。**新規の `ReviewDock.tsx` は `app_Summary.md` への追記が必要**。

### 現在の行数(上限 300 行)

`ReviewPage.tsx` 256、`ReviewHeader.tsx` 98、`review.css` 240、`review-icons.tsx` 43、
`review-labels.ts` 78、`app_Summary.md` 71、`dock-toggle.test.ts` 180。
`ReviewPage.tsx` の増分は下の契約どおりで +24 行(280 行)に収まる見込みで、上限に最も近い。
これ以上の行を足す必要が出たら、足す前に構造を見直すこと。

## インターフェイス契約

### web/src/app/review-icons.tsx(全面差し替え)

左右ドックアイコン(`DOCK_ICON_VIEW_BOX` / `DOCK_FRAME_PATH` / `DOCK_LEFT_FILL_PATH` /
`DOCK_RIGHT_FILL_PATH` / `OutlinerDockIcon` / `PanelDockIcon`)は**すべて削除**し、次に置き換える。
削除後にこれらを参照する箇所は残らない(`app_Summary.md` の記述は下の完了条件で更新する)。

```tsx
import type { ReactElement } from "react";

export const CHEVRON_ICON_VIEW_BOX = "0 0 16 16";
/** 左向きのシェブロン。 */
export const CHEVRON_LEFT_PATH = "M10 3.5 5.5 8l4.5 4.5";
/** 右向きのシェブロン。 */
export const CHEVRON_RIGHT_PATH = "M6 3.5 10.5 8 6 12.5";

export type ChevronDirection = "left" | "right";

/** class="review-chevron-icon"、aria-hidden="true"、focusable="false"、stroke="currentColor" の SVG を返す。 */
export function ChevronIcon({ direction }: { direction: ChevronDirection }): ReactElement;
```

### web/src/app/ReviewDock.tsx(新規)

```tsx
import type { ReactElement } from "react";
import { ChevronIcon } from "./review-icons";

/**
 * どちらのドックか。outliner = 左、panel = 右。
 * 値に "start" / "end" を使わないのは、`ReviewPage.tsx` の `side="start"` を
 * 1 件だけ要求する既存検査(前提に記載)を壊さないためである。
 */
export type DockSide = "outliner" | "panel";

/**
 * ドック上部に置く折りたたみバー。ボタンはビューア側の端に寄せる(CSS 側で制御)。
 * シェブロンは畳む向き: outliner は左、panel は右。
 */
export function DockCollapseBar({ side, label, onCollapse }: {
  side: DockSide;
  label: string;
  onCollapse: () => void;
}): ReactElement;

/**
 * 閉じている間だけ HUD に出す再表示ボタン。シェブロンは開く向き: outliner は右、panel は左。
 */
export function DockExpandButton({ side, label, onExpand }: {
  side: DockSide;
  label: string;
  onExpand: () => void;
}): ReactElement;
```

返す DOM は次のとおり(属性の綴りまでこのとおりにする)。

```tsx
// DockCollapseBar
<div className="review-dock-bar" data-side={side}>
  <button
    className="btn btn--quiet review-dock-bar__button"
    type="button"
    aria-expanded={true}
    aria-label={label}
    onClick={onCollapse}
  >
    <ChevronIcon direction={side === "outliner" ? "left" : "right"} />
  </button>
</div>

// DockExpandButton
<button
  className="btn review-dock-expand"
  type="button"
  data-side={side}
  aria-expanded={false}
  aria-label={label}
  onClick={onExpand}
>
  <ChevronIcon direction={side === "outliner" ? "right" : "left"} />
</button>
```

### web/src/app/review-labels.ts(コメントのみ変更)

`OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL` は**名前も値も変えない**。
直前の doc コメントだけを次に差し替える。他の定数・型・関数は一切変更しない。

```ts
/** ドック上部の折りたたみボタンと、閉じている間 HUD に出す再表示ボタンが共有する aria-label。開閉状態によらず同じ。 */
```

### web/src/app/ReviewHeader.tsx(トグルの削除)

props を 161 以前の 3 つに戻す。

```tsx
export function ReviewHeader({ projectName, joined, onOpenSettings }: {
  projectName: string;
  joined: boolean;
  onOpenSettings: () => void;
}): ReactElement;
```

- 2 つの `<button className="btn btn--quiet review-header__dock">` を削除する。
  ヘッダの先頭要素は `<h1 className="review-header__title">` に戻る。
- `./review-icons` からの import と、`OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL` の import を削除する。
  `review-labels` からの import は `SETTINGS_OPEN_LABEL,` の次行に `type CopyState,` を置く並びを保つ。
- それ以外(接続バッジ、自分の表示名、コピー、設定ボタン、失敗時の URL 入力欄)は変更しない。

### web/src/app/ReviewPage.tsx(結線)

`./ReviewDock` から `DockCollapseBar` と `DockExpandButton` を import し、`./review-labels` の
import ブロックへ `OUTLINER_TOGGLE_LABEL`(`MODEL_LOAD_FAILED` の次)と
`PANEL_TOGGLE_LABEL`(`PANEL_RESIZE_LABEL` の次)を加える。

```tsx
<ReviewHeader
  projectName={state.project.name}
  joined={joinName !== null}
  onOpenSettings={() => setSettingsOpen(true)}
/>
```

```tsx
{outlinerOpen && (
  <aside className="review-outliner" aria-label="アウトライナドック">
    <DockCollapseBar
      side="outliner"
      label={OUTLINER_TOGGLE_LABEL}
      onCollapse={() => setOutlinerOpen(false)}
    />
    <Outliner send={realtime.send} />
  </aside>
)}
```

```tsx
<div className="review-hud">
  {!outlinerOpen && (
    <DockExpandButton
      side="outliner"
      label={OUTLINER_TOGGLE_LABEL}
      onExpand={() => setOutlinerOpen(true)}
    />
  )}
  <ViewerHud send={realtime.send} />
  {!panelOpen && (
    <DockExpandButton
      side="panel"
      label={PANEL_TOGGLE_LABEL}
      onExpand={() => setPanelOpen(true)}
    />
  )}
</div>
```

```tsx
{panelOpen && (
  <aside className="review-panel" aria-label="サイドパネル">
    <DockCollapseBar
      side="panel"
      label={PANEL_TOGGLE_LABEL}
      onCollapse={() => setPanelOpen(false)}
    />
    <div className="review-panel__body">
      <PresenceList />
      <ObjectList projectId={projectId} send={realtime.send} />
      <section className="review-panel__comments" aria-label="コメント">
        {/* 中身は現状のまま */}
      </section>
    </div>
  </aside>
)}
```

`{outlinerOpen && (` と `{panelOpen && (` は引き続き各 2 件(`<aside>` と `ResizeHandle`)、
`{!outlinerOpen && (` と `{!panelOpen && (` が各 1 件になる。
`ResizeHandle` 2 件、`side="start"` 1 件、幅上限の 2 式、`.review-outliner` → `side="start"` →
`.review-viewer` → `.review-panel` の出現順は変えない。

### web/src/app/review.css

削除するルール: `.review-header__dock`、`.review-header__dock-icon`(`:47-59`)。

`.review-panel` を次のとおり 2 行 grid に変え、`gap` / `padding` / スクロールを新設の
`.review-panel__body` へ移す。`grid-column: 3` と `background` は `.review-panel` に残す
(`dock-toggle` と `comments-styles` の検査が要求する)。

```css
.review-panel {
  grid-column: 3;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.review-panel__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 0;
  overflow: auto;
  padding: var(--space-4);
}
```

追加するルール(`.review-panel__comments` は現状のまま残す)。

```css
.review-dock-bar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.review-dock-bar[data-side="outliner"] {
  justify-content: flex-end;
}

.review-dock-bar[data-side="panel"] {
  justify-content: flex-start;
}

.review-dock-bar__button,
.review-hud .review-dock-expand {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: var(--space-1);
}

.review-hud .review-dock-expand {
  background: var(--color-surface-translucent);
  box-shadow: var(--shadow-overlay);
}

.review-chevron-icon {
  width: 1rem;
  height: 1rem;
}
```

`.review-dock-expand` を `.review-hud` 子孫セレクタで書くのは、`.btn`(`controls.css`)より
詳細度を高くして背景の上書きを CSS の読み込み順に依存させないためである。

## 振る舞い

`ReviewPage` 全体の描画は `ViewerCanvas`(three)を含んで重いため、既存の `dock-toggle.test.ts` と同じく
**`ReviewDock` / `ReviewHeader` は DOM テスト、`ReviewPage` と CSS はソース検査**で確かめる。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `DockCollapseBar side="outliner"` を描画 | ルートが `div.review-dock-bar[data-side="outliner"]`。中の `button` は `type="button"`、`aria-expanded="true"`、`aria-label` が渡した文字列、`class` に `btn` `btn--quiet` `review-dock-bar__button` を含む |
| 同上の `svg path` の `d` | `CHEVRON_LEFT_PATH` と等しい |
| `DockCollapseBar side="panel"` の `svg path` の `d` | `CHEVRON_RIGHT_PATH` と等しい |
| `DockCollapseBar` のボタンを click | `onCollapse` がちょうど 1 回呼ばれる |
| `DockExpandButton side="outliner"` を描画 | ルートが `button.review-dock-expand[data-side="outliner"]`、`aria-expanded="false"`、`class` に `btn` を含み `btn--quiet` を含まない。`svg path` の `d` は `CHEVRON_RIGHT_PATH` |
| `DockExpandButton side="panel"` の `svg path` の `d` | `CHEVRON_LEFT_PATH` |
| `DockExpandButton` を click | `onExpand` がちょうど 1 回呼ばれる |
| `ChevronIcon` を描画 | `svg` に `aria-hidden="true"` と `focusable="false"` が付き、`class` が `review-chevron-icon`。`path` は 1 本 |
| `ReviewHeader` を `{projectName, joined: true, onOpenSettings}` で描画 | `button[aria-label="<OUTLINER_TOGGLE_LABEL>"]` と `button[aria-label="<PANEL_TOGGLE_LABEL>"]` がどちらも `null`。`header` の最初の要素の子は `h1.review-header__title` |
| 同上 | `SETTINGS_OPEN_LABEL` のボタンと、コピーのボタンは従来どおり存在する |
| `ReviewHeader` を `joined: false` で描画 | `SETTINGS_OPEN_LABEL` のボタンが無い(従来どおり) |
| `ReviewPage.tsx` のソース | `{!outlinerOpen && (` が 1 件、`{!panelOpen && (` が 1 件、`{outlinerOpen && (` が 2 件、`{panelOpen && (` が 2 件 |
| `ReviewPage.tsx` のソース | `<DockExpandButton` の 1 件目が `<ViewerHud send={realtime.send} />` より前、2 件目が後。`<DockCollapseBar` は 2 件で、1 件目が `<Outliner send={realtime.send} />` より前、2 件目が `<PresenceList />` より前 |
| `ReviewPage.tsx` のソース | `className="review-panel__body"` の位置が `className="review-panel"` より後、`<PresenceList />` より前。`onToggleOutliner` / `onTogglePanel` / `outlinerOpen={` / `panelOpen={` を含まない |
| `ReviewPage.tsx` のソース | `useLayoutFlag("outlinerOpen")` / `useLayoutFlag("panelOpen")` と、幅上限の 2 式(前提に記載)を引き続き含む |
| `ReviewHeader.tsx` のソース | `review-header__dock` と `review-icons` を含まない |
| `review.css` のソース | `.review-header__dock` のルールが無い。`.review-dock-bar` に `position: sticky`、`.review-dock-bar[data-side="outliner"]` に `justify-content: flex-end`、`.review-dock-bar[data-side="panel"]` に `justify-content: flex-start` |
| `review.css` のソース | `.review-panel` に `grid-column: 3` と `background: var(--color-surface-subtle)`、`.review-panel__body` に `grid-template-rows: auto auto minmax(0, 1fr)` と `overflow: auto` |
| `review.css` のソース | `.review-chevron-icon` に `width: 1rem` |
| 既存の開閉保存 | `useLayoutFlag` の DOM テスト(既定で開く / 保存済みの false を読む / 変更が `3dreviewer:layout` に載る)は現行のまま通る |

## やらないこと

- `useLayoutFlag` / `layout-storage.ts` / `useLayoutSize.ts` / `resize.ts` の変更。保存キーも既定値も現行のまま。
- `panelWidthMax` / `outlinerWidthMax` の呼び出し式の変更。列幅を `0px` にする方式の変更。
- 閉じた直後・開いた直後のフォーカス移動(押したボタンが消えるが、フォーカス復帰は実装しない)。
  開閉アニメーション、ドラッグでの折りたたみ、キーボードショートカットからの開閉も対象外。
- `ViewerHud.tsx` / `viewer.css` / `light-gizmo.css` の変更。矢印は `.review-hud` の flex に
  差し込むだけで、HUD 側は触らない。
- `OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL` の名前・値の変更、および reads に挙げた
  既存テストファイルの変更。

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM・CSS で実装されている
- [ ] 振る舞い表の全行に対応するテストが `web/tests/dock-toggle.test.ts` にあり、通る
- [ ] `web/src/app/app_Summary.md` を更新している。ファイル一覧に `ReviewDock.tsx` を追加し、
      `review-icons.tsx`(シェブロン)・`ReviewHeader.tsx`(トグル削除)・`ReviewPage.tsx`
      (ドック上部のバーと HUD の再表示ボタン、`.review-panel__body`)・`review.css`・
      `review-labels.ts` の記述を実装に合わせる。公開インターフェイス節の
      `ReviewHeader.tsx` の props を 3 つに直し、`review-icons.tsx` の一覧を
      `CHEVRON_ICON_VIEW_BOX` / `CHEVRON_LEFT_PATH` / `CHEVRON_RIGHT_PATH` /
      `ChevronDirection` / `ChevronIcon` に差し替え、`ReviewDock.tsx` の行
      (`DockSide`、`DockCollapseBar`、`DockExpandButton`)を足す。
      テスト節の `tests/dock-toggle.test.ts` の説明も実装に合わせる
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
