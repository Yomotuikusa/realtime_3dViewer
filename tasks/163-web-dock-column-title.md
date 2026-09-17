---
id: 163
title: web ドックの DOM を DockColumn に集約し、上部バーにタイトルと矢印を並べる
feature: layout
depends_on: []
owns: [web/src/app/ReviewPage.tsx, web/src/app/ReviewDock.tsx, web/src/app/review-dock.css, web/src/app/review.css, web/src/app/review-labels.ts, web/src/app/app_Summary.md, web/src/features/outliner/Outliner.tsx, web/src/features/outliner/outliner.css, web/src/features/outliner/outliner_Summary.md, web/src/features/layout/layout_Summary.md, web/tests/dock-toggle.test.ts, web/tests/dock-structure.test.ts, web/tests/layout-styles.test.ts, web/tests/outliner-styles.test.ts]
reads: [web/src/app/review-icons.tsx, web/src/app/ReviewHeader.tsx, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/useLayoutFlag.ts, web/src/features/layout/resize.ts, web/src/features/outliner/outliner-labels.ts, web/src/features/viewer/ViewerHud.tsx, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/layout-tokens.test.ts, web/tests/objects-styles.test.ts, web/tests/comments-styles.test.ts, web/tests/review-styles.test.ts, web/tests/timeline-styles.test.ts, web/tests/outliner-labels.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, web/tests/settings-dialog.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

162 で入れたドック上部の折りたたみボタンは矢印だけで、どのドックのものか読み取れない。
`アウトライナ ←` のようにタイトルと矢印を並べる。あわせて、164 で入れる開閉アニメーションの
土台として、閉じたドックを**アンマウントせずに列幅 0 へ畳む**構造へ変え、ドックの DOM を
`ReviewPage.tsx` から `ReviewDock.tsx` の `DockColumn` へ集約する。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### 現在の構造

- `.review-body` は 3 列 grid で、列幅は `ReviewPage.tsx:168-173` の inline style が px で与える
  CSS 変数 `--outliner-width` / `--panel-width` で決まる。閉じている側は `"0px"`。
  `web/src/app/review.css:74-79`。列は `grid-column: 1 / 2 / 3` で明示されているので、
  DOM の並び順ではなく CSS で配置が決まる。
- 現在は開いている側だけ `<aside>` と対応する `ResizeHandle` を描画している
  (`ReviewPage.tsx:175-199, 247-272`)。**このうち `<aside>` を常時描画へ変えるのがこのタスクの中心**で、
  `ResizeHandle` は従来どおり開いている側だけ描画する。
- `.review-outliner` は `overflow: auto` でスクロールし、`.review-panel` は `overflow: hidden` +
  2 行 grid (`auto minmax(0, 1fr)`) でバーと `.review-panel__body` を並べている。
  `review.css:91-99, 188-197`。
- `DockCollapseBar` / `DockExpandButton` / `ChevronIcon` の現在の DOM は
  `web/src/app/ReviewDock.tsx` と `web/src/app/review-icons.tsx` にある。
  `ChevronIcon` と `review-icons.tsx` は**このタスクでは変更しない**。
- `useLayoutFlag(name)` は `[boolean, (value: boolean) => void]` を返す
  (`web/src/features/layout/useLayoutFlag.ts:4`)。セッタはそのまま `onToggle` へ渡せる。

### 見出しの重複

- `Outliner.tsx:60-65` が既に `<h2 className="outliner__heading">アウトライナ</h2>` を描画している。
  ドックバーにタイトルを出すと同じ語が縦に 2 つ並ぶため、**h2 を削って
  `.outliner__head` は表示列の目アイコンだけにする**(下の契約)。
  `OUTLINER_HEADING`(= `"アウトライナ"`, `web/src/features/outliner/outliner-labels.ts:3`)は
  `<section>` と `<ul role="tree">` の `aria-label` で使い続けるので、
  `outliner-labels.ts` と `web/tests/outliner-labels.test.ts:17` は変更しない。
- 右ドックの中身の見出しは「参加者」「オブジェクト」「コメント」なので、
  バーのタイトルとは重複しない。

### React / 型

- React 19.2.8、`@types/react` 19.2.18。`inert?: boolean` が型定義にある
  (`node_modules/@types/react/index.d.ts:2863`)ので `inert={!open}` がそのまま書ける。
  `inert={false}` は属性を出力しない。

### 変えてはいけない既存の検査(いずれも reads。このタスクでは変更しない)

- `web/tests/layout-tokens.test.ts:29-30`: `ReviewPage.tsx` が
  `'"--outliner-width": outlinerOpen ? effectiveOutlinerWidth + "px" : "0px"'` と
  `'"--panel-width": panelOpen ? effectivePanelWidth + "px" : "0px"'` を含むこと。
  **この 2 行は一字も変えない**。新しい変数は行を足す形で加える。
- `web/tests/objects-styles.test.ts:57-59`: `review.css` 全体に文字列
  `grid-template-rows: auto auto minmax(0, 1fr)` があること。`.review-panel__body` は
  `review.css` に残すのでこれは保たれる。
- `web/tests/objects-styles.test.ts:62-68`: `ReviewPage.tsx` 内の出現順
  `<PresenceList />` < `<ObjectList` < `review-panel__comments`。
- `web/tests/comments-styles.test.ts:181-188`: `.review-panel` のルール本文に
  `background: var(--color-surface-subtle)` があること。
- `web/tests/review-styles.test.ts:31-38`: `.review-hud` に `z-index` があり
  `.review-stage__error` の `z-index` より小さいこと。
- `web/tests/timeline-styles.test.ts:38-47`: `ReviewPage.tsx` 内で
  `className="review-stage"` < `className="review-hud"`、
  `<PlaybackTimeline send={realtime.send} />` < `<JoinDialog`。
- `web/tests/settings-dialog.test.ts:153`: `ReviewHeader.tsx` の import の並び。ヘッダは触らない。
- `web/tests/styles-rules.test.ts`: `src` 配下の CSS で生の色・未宣言の CSS 変数参照・
  `!important`・`@import` を禁じる。`--outliner-open-width` / `--panel-open-width` は
  **CSS のどこにも宣言が無いと落ちる**ため、`review.css` の `.review-body` ルールに
  フォールバック用の宣言を置く(下の契約)。
- `web/tests/summary-coverage.test.ts`: `src` 配下の全ファイルが最寄りの `<フォルダ名>_Summary.md` に
  相対パスで載っていること、`tests/` の全テストファイル名がいずれかの Summary に載っていること。
  **新規の `review-dock.css` は `app_Summary.md` に、`dock-structure.test.ts` は
  `layout_Summary.md` に追記が必要**。

### 現在の行数(上限 300 行)

`ReviewPage.tsx` 281、`ReviewDock.tsx` 53、`review.css` 271、`review-labels.ts` 78、
`app_Summary.md` 73、`Outliner.tsx` 115、`outliner.css` 151、`outliner_Summary.md` 55、
`layout_Summary.md` 36、`dock-toggle.test.ts` 283、`layout-styles.test.ts` 88、
`outliner-styles.test.ts` 114。

`ReviewPage.tsx` / `review.css` / `dock-toggle.test.ts` はいずれも上限に近い。
このタスクは**いずれも純増させない**設計になっている(ドック CSS は `review-dock.css` へ、
`dock-toggle.test.ts` のソース検査は `dock-structure.test.ts` へ移す)。
見積もりは `ReviewPage.tsx` 約 280、`review.css` 約 233、`review-dock.css` 約 60、
`ReviewDock.tsx` 約 90、`dock-toggle.test.ts` 約 226、`dock-structure.test.ts` 約 130。
これを超えそうになったら、行を足す前に分け方を見直すこと。

## インターフェイス契約

### web/src/app/ReviewDock.tsx

`DockSide` / `DockExpandButton` は現行のまま。`DockCollapseBar` にタイトルを足し、
`DockColumn` を新設する。ファイル先頭で `import "./review-dock.css";` する
(`ResizeHandle.tsx:3` が `layout.css` を import しているのと同じ形)。

```tsx
import type { ReactElement, ReactNode } from "react";
import { ChevronIcon } from "./review-icons";
import "./review-dock.css";

/** どちらのドックか。outliner = 左、panel = 右。 */
export type DockSide = "outliner" | "panel";

/**
 * ドック 1 列。閉じている間もアンマウントせず、列幅 0 と inert で畳む。
 * 内側の `.review-dock__inner` が開いていたときの幅を保つので、
 * 幅が 0 へ縮んでも中身は潰れずスライドして見える(アニメーションは 164)。
 */
export function DockColumn({ side, open, title, label, onToggle, children }: {
  side: DockSide;
  open: boolean;
  /** バーに出す可視タイトル。`<aside>` の aria-label にも使う。 */
  title: string;
  /** 折りたたみボタンの aria-label。 */
  label: string;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}): ReactElement;

/** ドック上部の折りたたみバー。矢印はビューア側の端に置き、畳む向きを指す。 */
export function DockCollapseBar({ side, title, label, onCollapse }: {
  side: DockSide;
  title: string;
  label: string;
  onCollapse: () => void;
}): ReactElement;

/** 閉じている間だけ HUD に出す再表示ボタン。現行のまま変更しない。 */
export function DockExpandButton({ side, label, onExpand }: {
  side: DockSide;
  label: string;
  onExpand: () => void;
}): ReactElement;
```

返す DOM は次のとおり(属性の綴りまでこのとおりにする)。

```tsx
// DockColumn
<aside
  className={side === "outliner" ? "review-outliner" : "review-panel"}
  data-open={open}
  aria-label={dockRegionLabel(title)}
  inert={!open}
>
  <div className="review-dock__inner">
    <DockCollapseBar side={side} title={title} label={label} onCollapse={() => onToggle(false)} />
    {children}
  </div>
</aside>

// DockCollapseBar
<div className="review-dock-bar" data-side={side}>
  <button
    className="btn btn--quiet review-dock-bar__button"
    type="button"
    aria-expanded={true}
    aria-label={label}
    onClick={onCollapse}
  >
    <span className="review-dock-bar__title">{title}</span>
    <ChevronIcon direction={side === "outliner" ? "left" : "right"} />
  </button>
</div>
```

`data-open={open}` は `data-open="true"` / `data-open="false"` になる。
矢印の左右入れ替えは **DOM 順ではなく CSS の `flex-direction: row-reverse`** で行う
(読み上げ順をタイトル先に保つため)。

### web/src/app/review-labels.ts

`OUTLINER_TOGGLE_LABEL` は名前も値も変えない。次の 2 つを加え、`PANEL_TOGGLE_LABEL` の
値だけ差し替える(名前は変えない)。左ドックのタイトルは
`outliner-labels.ts` の `OUTLINER_HEADING` を使うのでここには置かない。

```ts
/** 左ドックの開閉ボタンの aria-label。 */
export const OUTLINER_TOGGLE_LABEL = "アウトライナドックの表示";
/** 右ドックの開閉ボタンの aria-label。可視タイトル PANEL_DOCK_TITLE を含めること。 */
export const PANEL_TOGGLE_LABEL = "インスペクタの表示";
/** 右ドック上部バーの可視タイトル。左ドックは outliner-labels.ts の OUTLINER_HEADING を使う。 */
export const PANEL_DOCK_TITLE = "インスペクタ";

/** ドック領域(`<aside>`)の aria-label。 */
export function dockRegionLabel(title: string): string {
  return title + "ドック";
}
```

### web/src/app/ReviewPage.tsx

- import: `./ReviewDock` から `DockCollapseBar` を外し `DockColumn` を入れる
  (`DockExpandButton` はそのまま)。`./review-labels` の import ブロックへ
  `PANEL_DOCK_TITLE` を `OUTLINER_TOGGLE_LABEL` の次の行に加える。
  `../features/outliner/outliner-labels` の import を
  `import { OUTLINER_HEADING, OUTLINER_RESIZE_LABEL } from "../features/outliner/outliner-labels";` にする。
- `.review-body` の inline style に 2 行足す。**既存の 2 行は一字も変えない**。

```tsx
<div
  ref={bodyRef}
  className="review-body"
  style={{
    "--outliner-width": outlinerOpen ? effectiveOutlinerWidth + "px" : "0px",
    "--panel-width": panelOpen ? effectivePanelWidth + "px" : "0px",
    "--outliner-open-width": effectiveOutlinerWidth + "px",
    "--panel-open-width": effectivePanelWidth + "px",
  } as CSSProperties}
>
```

- 左ドック(`{outlinerOpen && (<aside …>)}` を置き換える)。

```tsx
<DockColumn
  side="outliner"
  open={outlinerOpen}
  title={OUTLINER_HEADING}
  label={OUTLINER_TOGGLE_LABEL}
  onToggle={setOutlinerOpen}
>
  <Outliner send={realtime.send} />
</DockColumn>
```

- 右ドック(`{panelOpen && (<aside …>)}` を置き換える。`.review-panel__body` 以下は現状のまま)。

```tsx
<DockColumn
  side="panel"
  open={panelOpen}
  title={PANEL_DOCK_TITLE}
  label={PANEL_TOGGLE_LABEL}
  onToggle={setPanelOpen}
>
  <div className="review-panel__body">
    <PresenceList />
    <ObjectList projectId={projectId} send={realtime.send} />
    <section className="review-panel__comments" aria-label="コメント">
      {/* 中身は現状のまま */}
    </section>
  </div>
</DockColumn>
```

- `ResizeHandle` 2 件、`.review-hud` の `DockExpandButton` 2 件、幅上限の 2 式、
  `<ViewerCanvas>` 以下は変更しない。結果として
  `{outlinerOpen && (` と `{panelOpen && (` は**各 1 件**(`ResizeHandle` のみ)、
  `{!outlinerOpen && (` と `{!panelOpen && (` は各 1 件のままになる。

### web/src/app/review.css

- **`.review-dock-bar` から `.review-chevron-icon` までの 5 ルール(`:211-247`)を丸ごと削除**し、
  `review-dock.css` へ移す(下記)。`.review-panel__comments`(`:207-209`)と
  `.review-stage__error` 以降は残す。
- `.review-body` に 2 変数のフォールバック宣言を足す(`styles-rules` の未宣言参照検査のため。
  実効値は `ReviewPage` の inline style が上書きする)。
- `.review-outliner` に `overflow-x: hidden` を足す(列幅 0 のとき内側の固定幅で横スクロールしないように)。
  `overflow: auto` の行は `layout-styles.test.ts:43` が要求するので残し、その次の行に置く。
- `.review-panel` から `display: grid` と `grid-template-rows: auto minmax(0, 1fr)` を削除する
  (`review-dock.css` の `.review-panel .review-dock__inner` へ移る)。`grid-column: 3` と
  `background` は残す。

```css
.review-body {
  position: relative;
  display: grid;
  grid-template-columns: var(--outliner-width) minmax(0, 1fr) var(--panel-width);
  min-height: 0;
  /* 実効値は ReviewPage の inline style が与える。ここは宣言と既定値だけ持つ */
  --outliner-open-width: var(--outliner-width);
  --panel-open-width: var(--panel-width);
}

.review-outliner {
  grid-column: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.review-panel {
  grid-column: 3;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}
```

### web/src/app/review-dock.css(新規)

`review.css` から移した 5 ルールを、次のとおり書き換えて置く。他のルールは足さない。

```css
/* 列幅が 0 に縮んでも中身が潰れないよう、開いていたときの幅を内側で保つ。 */
.review-outliner .review-dock__inner {
  width: var(--outliner-open-width);
}

/* 右ドックは 162 までの .review-panel が持っていた 2 行 grid をここで持つ。 */
.review-panel .review-dock__inner {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: var(--panel-open-width);
  height: 100%;
}

.review-dock-bar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.review-dock-bar__button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-1) var(--space-2);
}

/* 右ドックは矢印をビューア側(左端)に置く。DOM 順はタイトルが先のまま保つ。 */
.review-dock-bar[data-side="panel"] .review-dock-bar__button {
  flex-direction: row-reverse;
}

.review-dock-bar__title {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-hud .review-dock-expand {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: var(--space-1);
  background: var(--color-surface-translucent);
  box-shadow: var(--shadow-overlay);
}

.review-chevron-icon {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
}
```

`.review-dock-expand` を `.review-hud` 子孫セレクタで書くのは、`.btn`(`controls.css`)より
詳細度を高くして背景の上書きを読み込み順に依存させないためである(162 から引き継ぐ)。

### web/src/features/outliner/Outliner.tsx と outliner.css

`<h2 className="outliner__heading">{OUTLINER_HEADING}</h2>` の 1 行を削除する。
`.outliner__head` は目アイコンだけになるので右寄せにし、`.outliner__heading` のルールを削除する。
`<section className="outliner" aria-label={OUTLINER_HEADING}>` と
`<ul role="tree" aria-label={OUTLINER_HEADING}>` は**変更しない**(`OUTLINER_HEADING` の import は残る)。

```tsx
<div className="outliner__head">
  <span className="outliner__eye" role="img" aria-label={OUTLINER_VISIBILITY_HEADING} title={OUTLINER_VISIBILITY_HEADING}>
    <EyeIcon />
  </span>
</div>
```

```css
.outliner__head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-right: var(--space-1);
}
```

### web/tests の分け方

- `web/tests/dock-toggle.test.ts`: **末尾の `function ruleBody`(`:223`)と
  `describe("dock source contracts")`(`:229`) を丸ごと削除**し、`dock-structure.test.ts` へ移す。
  残る DOM テスト(`DockCollapseBar` / `DockExpandButton` / `ChevronIcon` / `ReviewHeader` /
  `useLayoutFlag`)は、`DockCollapseBar` に `title` を渡すよう直し、タイトルの検査を足す。
  `readFileSync` / `join` の import は不要になるので消す。
- `web/tests/dock-structure.test.ts`(新規): `DockColumn` の DOM テストと、
  `ReviewPage.tsx` / `review.css` / `review-dock.css` / `ReviewDock.tsx` のソース検査を置く。
  `ruleBody` ヘルパは移した実装をそのまま使う。
- `web/tests/layout-styles.test.ts:66-68` の出現順検査を、`ReviewPage.tsx` から
  `className="review-outliner"` / `className="review-panel"` が消えるのに合わせて書き換える。
  それ以外の `it` は変更しない。

```ts
expect(page.indexOf('side="outliner"')).toBeLessThan(page.indexOf('side="start"'));
expect(page.indexOf('side="start"')).toBeLessThan(page.indexOf('className="review-viewer"'));
expect(page.indexOf('className="review-viewer"')).toBeLessThan(page.lastIndexOf('side="panel"'));
```

`side="panel"` は HUD の `DockExpandButton` にもあるため `lastIndexOf` を使う。
`side="outliner"` は左 `DockColumn` が最初に現れるので `indexOf` でよい。

- `web/tests/outliner-styles.test.ts:60` の
  `expect(ruleBody(cssText, ".outliner__head")).toContain("justify-content: space-between")` を
  `"justify-content: flex-end"` に変える。同ファイルの他の `it` は変更しない。

## 振る舞い

`ReviewPage` 全体の描画は `ViewerCanvas`(three)を含んで重いため、162 と同じく
**コンポーネントは DOM テスト、`ReviewPage` と CSS はソース検査**で確かめる。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `DockColumn side="outliner" open={true}` を描画 | ルートが `aside.review-outliner[data-open="true"]`、`aria-label` が `"アウトライナドック"`、`inert` 属性を**持たない**。直下に `div.review-dock__inner` があり、その中に `.review-dock-bar` と渡した children がこの順で入る |
| 同上を `open={false}` で描画 | `aside` に `inert` 属性が付き、`data-open="false"` になる。children は引き続き DOM にある |
| `DockColumn side="panel" open={true}` を描画 | ルートが `aside.review-panel[data-open="true"]`、`aria-label` が `"インスペクタドック"` |
| `DockColumn` のバーのボタンを click | `onToggle` が `false` を引数にちょうど 1 回呼ばれる |
| `dockRegionLabel("インスペクタ")` | `"インスペクタドック"` |
| `DockCollapseBar side="outliner" title="アウトライナ"` を描画 | ルートが `div.review-dock-bar[data-side="outliner"]`。中の `button` は `type="button"`、`aria-expanded="true"`、`aria-label` が渡した `label`、`class` に `btn` `btn--quiet` `review-dock-bar__button` を含む |
| 同上 | `button` の中に `span.review-dock-bar__title` があり、テキストが `"アウトライナ"`。`svg path` の `d` が `CHEVRON_LEFT_PATH` |
| `DockCollapseBar side="panel" title="インスペクタ"` を描画 | `span.review-dock-bar__title` のテキストが `"インスペクタ"`。`svg path` の `d` が `CHEVRON_RIGHT_PATH` |
| `DockCollapseBar` のボタンを click | `onCollapse` がちょうど 1 回呼ばれる |
| `DockExpandButton side="outliner"` を描画 | 162 のまま: `button.review-dock-expand[data-side="outliner"]`、`aria-expanded="false"`、`class` に `btn` を含み `btn--quiet` を含まない、`svg path` の `d` が `CHEVRON_RIGHT_PATH` |
| `DockExpandButton side="panel"` を描画 / click | 162 のまま: `d` が `CHEVRON_LEFT_PATH`、`onExpand` がちょうど 1 回 |
| `ChevronIcon` を描画 | 162 のまま: `aria-hidden="true"`、`focusable="false"`、`class` が `review-chevron-icon`、`path` は 1 本 |
| `ReviewHeader` の 3 つの `it` | 162 のまま通る(ヘッダは変更しない) |
| `useLayoutFlag` の 2 つの `it` | 162 のまま通る |
| `ReviewPage.tsx` のソース | `<DockColumn` が 2 件。`side="outliner"` と `side="panel"` を含み、`<DockCollapseBar` を含まない |
| `ReviewPage.tsx` のソース | `{outlinerOpen && (` が 1 件、`{panelOpen && (` が 1 件、`{!outlinerOpen && (` が 1 件、`{!panelOpen && (` が 1 件 |
| `ReviewPage.tsx` のソース | `"--outliner-open-width": effectiveOutlinerWidth + "px"` と `"--panel-open-width": effectivePanelWidth + "px"` を含み、`layout-tokens` が要求する既存 2 行も含む |
| `ReviewPage.tsx` のソース | `title={OUTLINER_HEADING}` と `title={PANEL_DOCK_TITLE}` を含む |
| `ReviewPage.tsx` のソース | 出現順が `side="outliner"` < `side="start"` < `className="review-viewer"` < `side="panel"`(最後の出現)。`<PresenceList />` < `<ObjectList` < `review-panel__comments` は従来どおり |
| `ReviewDock.tsx` のソース | `import "./review-dock.css"` を含む |
| `review.css` のソース | `.review-dock-bar` / `.review-chevron-icon` / `.review-dock-expand` を含まない。`.review-body` に `--outliner-open-width:` と `--panel-open-width:` の宣言がある |
| `review.css` のソース | `.review-outliner` に `overflow: auto` と `overflow-x: hidden`、`.review-panel` に `grid-column: 3` と `background: var(--color-surface-subtle)` があり、`.review-panel` に `display: grid` が**無い** |
| `review-dock.css` のソース | `.review-outliner .review-dock__inner` に `width: var(--outliner-open-width)`、`.review-panel .review-dock__inner` に `width: var(--panel-open-width)` と `grid-template-rows: auto minmax(0, 1fr)` |
| `review-dock.css` のソース | `.review-dock-bar` に `position: sticky`、`.review-dock-bar__button` に `flex: 1` と `justify-content: space-between`、`.review-dock-bar[data-side="panel"] .review-dock-bar__button` に `flex-direction: row-reverse`、`.review-chevron-icon` に `width: 1rem` |
| `Outliner` を描画(既存の outliner テスト) | `h2.outliner__heading` が無い。`section.outliner` と `ul[role="tree"]` の `aria-label` は `"アウトライナ"` のまま |
| `outliner.css` のソース | `.outliner__head` に `justify-content: flex-end`。`.outliner__heading` のルールが無い |

## やらないこと

- 開閉アニメーション(transition / `@property` / `--duration-medium` / `useDockAnimation`)は 164 で行う。
  このタスクでは `tokens.css` を変更せず、`review.css` / `review-dock.css` に
  `transition` も `@keyframes` も書かない。
- `useLayoutFlag` / `layout-storage.ts` / `useLayoutSize.ts` / `resize.ts` の変更。
  保存キーも既定値も現行のまま。`panelWidthMax` / `outlinerWidthMax` の呼び出し式も変えない。
- `ReviewHeader.tsx` / `review-icons.tsx` / `ViewerHud.tsx` / `viewer.css` の変更。
- `outliner-labels.ts` の変更、`OUTLINER_HEADING` / `OUTLINER_TOGGLE_LABEL` の値の変更、
  `.outliner__tree` 以下のアウトライナ本体の変更。
- 閉じたドックへのフォーカス移動制御(`inert` を付ける以外の処理)、開閉ショートカット、
  ドラッグでの折りたたみ。
- reads に挙げたテストファイルの変更。

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM・CSS で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `app_Summary.md` に `review-dock.css` を、`layout_Summary.md` に
      `tests/dock-structure.test.ts` を追記し、`ReviewPage.tsx` / `ReviewDock.tsx` /
      `review.css` / `review-labels.ts` / `Outliner.tsx` / `outliner.css` の説明を
      新しい構造に合わせて直している
- [ ] すべてのファイルが 300 行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
