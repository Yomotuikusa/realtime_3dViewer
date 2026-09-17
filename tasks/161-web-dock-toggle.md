---
id: 161
title: web レビュー画面の左ドック(アウトライナ)と右ドック(参加者・コメント)をヘッダのボタンで開閉できるようにする
feature: layout
depends_on: []
owns: [web/src/app/ReviewPage.tsx, web/src/app/ReviewHeader.tsx, web/src/app/review-labels.ts, web/src/app/review-icons.tsx, web/src/app/review.css, web/src/app/app_Summary.md, web/src/features/layout/layout-storage.ts, web/src/features/layout/useLayoutFlag.ts, web/src/features/layout/layout_Summary.md, web/tests/dock-toggle.test.ts, web/tests/layout-storage.test.ts, web/tests/layout-tokens.test.ts, web/tests/layout-styles.test.ts, web/tests/settings-dialog.test.ts]
reads: [web/src/features/layout/resize.ts, web/src/features/layout/useLayoutSize.ts, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/layout.css, web/src/features/outliner/outliner-icons.tsx, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/resize.test.ts, web/tests/review-styles.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

レビュー画面の左ドック(アウトライナ)と右ドック(参加者・オブジェクト・コメント)は幅を変えられるが閉じられない。狭い画面や 3D ビューアを広く使いたい場面で邪魔になる。ヘッダの左右端に置いたトグルボタンで各ドックを開閉できるようにし、開閉状態を既存のレイアウト保存(localStorage)へ永続化する。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `.review-body` は 3 列 grid で、列幅は CSS カスタムプロパティで決まる。`web/src/app/review.css:74-79`。

  ```css
  .review-body {
    position: relative;
    display: grid;
    grid-template-columns: var(--outliner-width) minmax(0, 1fr) var(--panel-width);
    min-height: 0;
  }
  ```

- `--outliner-width` / `--panel-width` は `ReviewPage.tsx:164-167` の inline style が px 値で上書きする。`web/src/styles/tokens.css:48-49` の `22rem` / `16rem` はフォールバック。**inline style は CSS ルールより強いので、クラスや属性セレクタで列幅を 0 にすることはできない**。列を潰すには inline style で渡す値そのものを変える。
- `.review-body` の grid の子は `.review-outliner`(`:169`)、`.review-viewer`(`:183`)、`.review-panel`(`:228`)の 3 つだけである。2 つの `ResizeHandle` は `.resize-handle { position: absolute }`(`web/src/features/layout/layout.css:1-5`)で通常フローから外れており、grid の自動配置に参加しない。したがって `.review-outliner` を描画しないと `.review-viewer` が 1 列目へ繰り上がる。現在 3 要素はどれも `grid-column` を持っていない。
- 幅の上限は右パネル優先で決まる。`ReviewPage.tsx:82-90`。

  ```ts
  const maxPanelWidth = panelWidthMax(bodySize.width, OUTLINER_WIDTH_MIN_PX);
  const effectivePanelWidth = clampSize(panelWidth, PANEL_WIDTH_MIN_PX, maxPanelWidth);
  const maxOutlinerWidth = outlinerWidthMax(bodySize.width, effectivePanelWidth);
  ```

  `panelWidthMax` / `outlinerWidthMax` は `web/src/features/layout/resize.ts:70-81` にあり、いずれも第 2 引数 `reservedPx` を引いた `max(最小幅, floor(bodyWidthPx) - VIEWER_MIN_WIDTH_PX - reservedPx)` を返す。`reservedPx` を省略・負値・非有限にすると 0 として扱われる。定数は `PANEL_WIDTH_MIN_PX = 256`、`PANEL_WIDTH_DEFAULT_PX = 352`、`OUTLINER_WIDTH_MIN_PX = 200`、`OUTLINER_WIDTH_DEFAULT_PX = 256`、`VIEWER_MIN_WIDTH_PX = 320`。
- レイアウト寸法は `web/src/features/layout/layout-storage.ts` が `LAYOUT_STORAGE_KEY = "3dreviewer:layout"` の 1 つの JSON オブジェクトへ名前付きで書き込む。`saveLayoutSize` は既存の他キーを保持したままマージし、`localStorage` の例外を握り潰す。現在の値は数値のみ(`panelWidth` / `timelineHeight` / `outlinerWidth`)。
- `web/src/features/layout/useLayoutSize.ts` は 12 行で、初期値を `loadLayoutSize(name) ?? LAYOUT_SIZE_SPECS[name].defaultValue` とし、setter で state 更新と保存を同時に行う。今回の hook はこれと同じ形にする。
- `.btn[aria-pressed="true"]` のスタイルは `web/src/styles/controls.css:40-44` に既にあり、`border-color: var(--color-accent)` / `background: var(--color-accent-subtle)` / `color: var(--color-accent)` が付く。トグルの「開」表示はこれに任せる。`.btn--quiet`(`:26-33`)は枠と背景を透明にする。
- アイコンは SVG を返す関数コンポーネントで書く流儀。`web/src/features/outliner/outliner-icons.tsx:1-14` が参考。viewBox 定数を export し、`aria-hidden="true" focusable="false"` を付ける。
- `web/tests/styles-rules.test.ts` は `src` 配下の CSS について、生の色(`#rgb` / `rgb()` / `hsl()`)を `styles/tokens.css` 以外で禁じ、未宣言の CSS 変数参照を禁じ、`!important` と `@import` を禁じる。`rem` / `px` のリテラルは許される。このテストは変更しない。
- `web/tests/summary-coverage.test.ts` は (1) `src` 配下の全 `.ts` / `.tsx` / `.css` が最寄りの `<フォルダ名>_Summary.md` に相対パス文字列で載っていること、(2) `web/tests` の全テストファイル名がいずれかの Summary に載っていること、(3) 全フォルダ Summary が `web/web_Summary.md` から参照されていること、を検査する。**新規の `review-icons.tsx` / `useLayoutFlag.ts` / `dock-toggle.test.ts` は Summary への追記が必要**。新しい機能フォルダは作らないので `web/web_Summary.md` は変更不要。このテストは変更しない。
- `web/tests/settings-dialog.test.ts:153` が `ReviewHeader.tsx` の import 形を正規表現で縛っている。

  ```ts
  expect(reviewHeader).toMatch(/SETTINGS_OPEN_LABEL,\s*type CopyState,\s*\} from "\.\/review-labels"/s);
  ```

  下の契約どおり新しいラベルを `SETTINGS_OPEN_LABEL` より前の行に入れれば、この正規表現は通る。
- `web/tests/layout-styles.test.ts:44-76` が `ReviewPage.tsx` をソース検査しており、`page.match(/<ResizeHandle/g)` が 2 件、`page.match(/side="start"/g)` が 1 件、`.review-outliner` → `side="start"` → `.review-viewer` → `.review-panel` の出現順、`panelWidthMax(bodySize.width, OUTLINER_WIDTH_MIN_PX)` と `outlinerWidthMax(bodySize.width, effectivePanelWidth)` の 2 つの文字列を要求する。**後者 2 つはこのタスクで式が変わるので更新が必要**。件数と出現順は下の契約どおり `{outlinerOpen && (...)}` で包むだけなら保たれる。
- `web/tests/layout-tokens.test.ts:29-32` が `'"--outliner-width": effectiveOutlinerWidth + "px"'` と `'"--panel-width": effectivePanelWidth + "px"'` を厳密一致で要求する。**このタスクで式が変わるので更新が必要**。
- 現在の行数(上限 300 行)。`ReviewPage.tsx` 241、`ReviewHeader.tsx` 74、`review.css` 223、`review-labels.ts` 75、`layout-storage.ts` 41、`layout-styles.test.ts` 88、`layout-tokens.test.ts` 33、`layout-storage.test.ts` 52。増分を見込んでも全て 300 行以内に収まる。

## インターフェイス契約

### web/src/features/layout/layout-storage.ts(追記)

```ts
/** 開閉状態として保存するフラグ名。 */
export type LayoutFlagName = "outlinerOpen" | "panelOpen";

/** 保存値が無い / 不正なときに使う既定値。どちらも開。 */
export const LAYOUT_FLAG_DEFAULTS: Readonly<Record<LayoutFlagName, boolean>> = {
  outlinerOpen: true,
  panelOpen: true,
};

/** 保存値。未保存・boolean 以外・JSON 破損・localStorage 例外はすべて null。 */
export function loadLayoutFlag(name: LayoutFlagName): boolean | null;

/** 他のキー(幅・高さ・もう一方のフラグ)を保持したまま name だけ書き換える。例外は握り潰す。 */
export function saveLayoutFlag(name: LayoutFlagName, value: boolean): void;
```

読み書き先は既存の `LAYOUT_STORAGE_KEY` と同じ 1 つの JSON オブジェクトとする。`LAYOUT_STORAGE_KEY`、`loadLayoutSize`、`saveLayoutSize` はシグネチャも挙動も変えない。実装の重複を減らすためにファイル内の非公開ヘルパーへ括り出してよいが、公開シンボルをこれ以上増やさないこと。

### web/src/features/layout/useLayoutFlag.ts(新規)

`useLayoutSize.ts` と同型。全文を次のとおりにする。

```ts
import { useState } from "react";
import { LAYOUT_FLAG_DEFAULTS, loadLayoutFlag, saveLayoutFlag, type LayoutFlagName } from "./layout-storage";

export function useLayoutFlag(name: LayoutFlagName): [value: boolean, setValue: (value: boolean) => void] {
  const [value, setState] = useState(() => loadLayoutFlag(name) ?? LAYOUT_FLAG_DEFAULTS[name]);
  const setValue = (nextValue: boolean): void => {
    setState(nextValue);
    saveLayoutFlag(name, nextValue);
  };
  return [value, setValue];
}
```

`useLayoutSize.ts` は変更しない。

### web/src/app/review-labels.ts(追記)

```ts
/** ヘッダのドック開閉ボタン。aria-label は開閉状態によらず同じ。 */
export const OUTLINER_TOGGLE_LABEL = "アウトライナドックの表示";
export const PANEL_TOGGLE_LABEL = "サイドパネルの表示";
```

既存の定数・型・関数は変更しない。

### web/src/app/review-icons.tsx(新規)

```tsx
import type { ReactElement } from "react";

export const DOCK_ICON_VIEW_BOX = "0 0 16 16";
/** アイコン外周の枠。 */
export const DOCK_FRAME_PATH = "M2.5 3.5h11v9h-11Z";
/** 左ドックを表す塗り。 */
export const DOCK_LEFT_FILL_PATH = "M2.5 3.5h3.5v9H2.5Z";
/** 右ドックを表す塗り。 */
export const DOCK_RIGHT_FILL_PATH = "M10 3.5h3.5v9H10Z";

export function OutlinerDockIcon(): ReactElement;
export function PanelDockIcon(): ReactElement;
```

両コンポーネントの中身は次の形。`PanelDockIcon` は 2 つめの `path` の `d` が `DOCK_RIGHT_FILL_PATH` になるだけで、他は同じ。

```tsx
<svg
  className="review-header__dock-icon"
  viewBox={DOCK_ICON_VIEW_BOX}
  aria-hidden="true"
  focusable="false"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.25"
>
  <path d={DOCK_FRAME_PATH} />
  <path d={DOCK_LEFT_FILL_PATH} fill="currentColor" stroke="none" />
</svg>
```

### web/src/app/ReviewHeader.tsx

```tsx
export function ReviewHeader({
  projectName,
  joined,
  onOpenSettings,
  outlinerOpen,
  panelOpen,
  onToggleOutliner,
  onTogglePanel,
}: {
  projectName: string;
  joined: boolean;
  onOpenSettings: () => void;
  outlinerOpen: boolean;
  panelOpen: boolean;
  onToggleOutliner: () => void;
  onTogglePanel: () => void;
}): ReactElement
```

- 左トグルは `<header className="review-header">` の**最初の子**(`<h1 className="review-header__title">` の直前)に置く。
- 右トグルは `.review-header__actions` の中、設定ボタン(`{joined && (<button ... onOpenSettings ...>)}`)の**直後**・`review-header__url` の入力欄の**直前**に置く。
- 両ボタンとも `joined` の値によらず常に描画する(入室前も押せる)。
- ボタンの中身はアイコンだけで、テキストは入れない。名前は `aria-label` で与える。

```tsx
<button
  className="btn btn--quiet review-header__dock"
  type="button"
  aria-pressed={outlinerOpen}
  aria-label={OUTLINER_TOGGLE_LABEL}
  onClick={onToggleOutliner}
>
  <OutlinerDockIcon />
</button>
```

右トグルは同じ形で `aria-pressed={panelOpen}` / `aria-label={PANEL_TOGGLE_LABEL}` / `onClick={onTogglePanel}` / `<PanelDockIcon />`。

`aria-pressed` は **true が「開いている」**を表す。

`review-labels` からの import は次の並びにする(前提に挙げた正規表現を満たすため、新しい 2 つは `SETTINGS_OPEN_LABEL` より前の行に置く)。

```ts
import {
  connectionLabel,
  connectionTone,
  copyLabel,
  copyText,
  OUTLINER_TOGGLE_LABEL,
  PANEL_TOGGLE_LABEL,
  SETTINGS_OPEN_LABEL,
  type CopyState,
} from "./review-labels";
```

### web/src/app/ReviewPage.tsx

開閉 state を追加し、幅の計算・inline style・子要素の描画を開閉に連動させる。

```ts
const [outlinerOpen, setOutlinerOpen] = useLayoutFlag("outlinerOpen");
const [panelOpen, setPanelOpen] = useLayoutFlag("panelOpen");
const maxPanelWidth = panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0);
const effectivePanelWidth = clampSize(panelWidth, PANEL_WIDTH_MIN_PX, maxPanelWidth);
const maxOutlinerWidth = outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0);
const effectiveOutlinerWidth = clampSize(outlinerWidth, OUTLINER_WIDTH_MIN_PX, maxOutlinerWidth);
```

`useLayoutSize("panelWidth")` / `useLayoutSize("outlinerWidth")` の 2 行はそのまま残す(幅の保存は従来どおり)。`effectiveOutlinerWidth` は現在 4 行に折り返されているが、1 行でも折り返しでもよい。

`<ReviewHeader>` へ 4 つの props を渡す。

```tsx
<ReviewHeader
  projectName={state.project.name}
  joined={joinName !== null}
  onOpenSettings={() => setSettingsOpen(true)}
  outlinerOpen={outlinerOpen}
  panelOpen={panelOpen}
  onToggleOutliner={() => setOutlinerOpen(!outlinerOpen)}
  onTogglePanel={() => setPanelOpen(!panelOpen)}
/>
```

`.review-body` の inline style は閉じている側を `"0px"` にする。

```tsx
style={{
  "--outliner-width": outlinerOpen ? effectiveOutlinerWidth + "px" : "0px",
  "--panel-width": panelOpen ? effectivePanelWidth + "px" : "0px",
} as CSSProperties}
```

閉じている側は `<aside>` と対応する `ResizeHandle` を**どちらも描画しない**。既存の JSX を次のように包むだけで、属性は一切変えない。

```tsx
{outlinerOpen && (
  <aside className="review-outliner" aria-label="アウトライナドック">
    <Outliner send={realtime.send} />
  </aside>
)}
{outlinerOpen && (
  <ResizeHandle
    axis="x"
    side="start"
    className="review-body__resize review-body__resize--outliner"
    ...既存のまま...
  />
)}
```

右側も同様に、`ResizeHandle`(`className="review-body__resize"`)と `<aside className="review-panel" aria-label="サイドパネル">` を `{panelOpen && (...)}` で包む。`.review-viewer` の `<section>` とその中身は包まない。

`.review-outliner` → `side="start"` の `ResizeHandle` → `.review-viewer` → `.review-body__resize` → `.review-panel` という JSX の出現順は変えない。

### web/src/app/review.css

`.review-body` の `grid-template-columns` は変更しない。3 つの grid の子に列番号を明示して、片方を描画しなくても残りの列位置が動かないようにする。既存の各ルールへ 1 宣言ずつ足す。

```css
.review-outliner { grid-column: 1; /* 既存の宣言はそのまま */ }
.review-viewer { grid-column: 2; /* 既存の宣言はそのまま */ }
.review-panel { grid-column: 3; /* 既存の宣言はそのまま */ }
```

ヘッダのトグルボタン用に 2 ルールを足す。生の色は使わない(`styles-rules.test.ts`)。

```css
.review-header__dock {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: var(--space-1);
}

.review-header__dock-icon {
  width: 1rem;
  height: 1rem;
}
```

`.review-body__resize` / `.review-body__resize--outliner` は変更しない。

## 振る舞い

`bodySize.width` を使う行は 1200px を例とする。定数は `PANEL_WIDTH_MIN_PX = 256`、`OUTLINER_WIDTH_MIN_PX = 200`、`VIEWER_MIN_WIDTH_PX = 320`、`PANEL_WIDTH_DEFAULT_PX = 352`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 保存値なしで初回描画 | 両ドックとも開。`loadLayoutFlag("outlinerOpen")` が `null` を返し、`LAYOUT_FLAG_DEFAULTS.outlinerOpen`(`true`)が使われる。ヘッダの両ボタンが `aria-pressed="true"` |
| 左トグルを押す | `.review-outliner` と `side="start"` の `ResizeHandle` が描画されなくなり、`--outliner-width` が `"0px"`、左ボタンが `aria-pressed="false"` になる |
| 左トグルを押した直後の localStorage | `3dreviewer:layout` の JSON に `outlinerOpen: false` が入り、`panelWidth` / `outlinerWidth` / `timelineHeight` の既存値は消えない |
| 右トグルを押す | `.review-panel` と `className="review-body__resize"` の `ResizeHandle` が描画されなくなり、`--panel-width` が `"0px"`、右ボタンが `aria-pressed="false"`、保存値に `panelOpen: false` が入る |
| 両方閉じる | grid の列幅は `0px minmax(0, 1fr) 0px` になり、`.review-viewer` が `.review-body` の全幅を占める。`grid-column: 2` を明示しているので 1 列目へは繰り上がらない |
| 閉じてから同じボタンをもう一度押す | ドックが再び描画され、幅は閉じる前の `panelWidth` / `outlinerWidth` の保存値のまま。幅の state は開閉で書き換えない |
| `{"outlinerOpen":false}` が保存された状態で再読み込み | 左ドックは閉じたまま描画される。右ドックは保存値が無いので開 |
| `{"outlinerOpen":"no"}` / `{"outlinerOpen":null}` / `{"outlinerOpen":1}` が保存されている | `loadLayoutFlag("outlinerOpen")` は `null` を返し、既定の開で描画される |
| `LAYOUT_STORAGE_KEY` の値が `"{"` など壊れた JSON | `loadLayoutFlag` は `null`。その後 `saveLayoutFlag("panelOpen", false)` すると壊れた値は `{"panelOpen":false}` で置き換わる |
| `localStorage.setItem` が例外を投げる | `saveLayoutFlag` は throw しない。state だけが変わる |
| `saveLayoutFlag("outlinerOpen", false)` の後に `saveLayoutSize("panelWidth", 400)` | JSON は `{"outlinerOpen":false,"panelWidth":400}`。互いのキーを消さない |
| `loadLayoutSize("outlinerOpen" 相当の位置)` との混線 | 起きない。`loadLayoutSize` は数値以外を `null` にし、`loadLayoutFlag` は boolean 以外を `null` にする |
| 両ドックが開いているときのパネル幅上限(body 1200px) | `panelWidthMax(1200, 200)` = `max(256, 1200 - 320 - 200)` = **680** |
| 左を閉じたときのパネル幅上限(body 1200px) | `panelWidthMax(1200, 0)` = `max(256, 1200 - 320)` = **880**。左ドック分 200px の予約が外れる |
| 両ドックが開き、パネル幅が既定 352px のときのアウトライナ幅上限(body 1200px) | `outlinerWidthMax(1200, 352)` = `max(200, 1200 - 320 - 352)` = **528** |
| 右を閉じたときのアウトライナ幅上限(body 1200px) | `outlinerWidthMax(1200, 0)` = `max(200, 1200 - 320)` = **880** |
| 入室前(`JoinDialog` 表示中)にトグルを押す | 押せる。`joined` の値はトグルの描画条件に使わない |
| トグルボタンのアクセシブルな名前 | 開閉状態によらず `OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL`。状態は `aria-pressed` だけで表す |
| 開いているトグルの見た目 | `.btn[aria-pressed="true"]` の既存スタイル(アクセント色の枠・背景・文字色)が付く。`review.css` で色は指定しない |

## テスト

### web/tests/dock-toggle.test.ts(新規)

`web/tests/settings-dialog.test.ts:20-30` の `render` ヘルパー(`createRoot` + `act`、`IS_REACT_ACT_ENVIRONMENT`)と同じ流儀で書く。`beforeEach` で `localStorage.clear()` する。

1. `ReviewHeader` を `outlinerOpen: true, panelOpen: true` で描画し、`aria-label` が `OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL` のボタンが 1 つずつあり、どちらも `aria-pressed="true"` かつ `type="button"`、`.review-header__dock` クラスを持つことを検査する。
2. 同じく `outlinerOpen: false, panelOpen: false` で描画し、両ボタンが `aria-pressed="false"` になることを検査する。
3. 各ボタンの `click` で `onToggleOutliner` / `onTogglePanel` がそれぞれ 1 回ずつ呼ばれ、もう一方が呼ばれないことを検査する(`vi.fn()`)。
4. `joined: false` で描画しても両ボタンが存在すること(設定ボタンは出ないこと)を検査する。
5. 左トグルが `<header>` の最初の要素の子であること、右トグルが設定ボタンより後ろにあることを DOM 順で検査する。
6. `useLayoutFlag` を使う小さなテスト用コンポーネントを描画し、(a) 保存値なしで `true` になること、(b) setter 呼び出しで表示が変わり `localStorage` の `3dreviewer:layout` に `{"outlinerOpen":false}` が書かれること、(c) `{"panelOpen":false}` を事前に入れておくと初期値が `false` になることを検査する。
7. `ReviewPage.tsx` のソース検査。

   ```ts
   expect(page).toContain('useLayoutFlag("outlinerOpen")');
   expect(page).toContain('useLayoutFlag("panelOpen")');
   expect(page).toContain("panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0)");
   expect(page).toContain("outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0)");
   expect(page.match(/\{outlinerOpen && \(/g)).toHaveLength(2);
   expect(page.match(/\{panelOpen && \(/g)).toHaveLength(2);
   expect(page).toContain("onToggleOutliner=");
   expect(page).toContain("onTogglePanel=");
   ```

8. `review.css` のソース検査。`.review-outliner` / `.review-viewer` / `.review-panel` の各ルール本文に `grid-column: 1` / `grid-column: 2` / `grid-column: 3` があること、`.review-header__dock-icon` に `width: 1rem` があることを検査する。ルール本文の取り出しは `web/tests/layout-styles.test.ts:14-19` の `ruleBody` と同じ実装を使ってよい。
9. `review-icons.tsx` のソース検査。`OutlinerDockIcon` が `DOCK_LEFT_FILL_PATH`、`PanelDockIcon` が `DOCK_RIGHT_FILL_PATH` を使い、どちらも `aria-hidden="true"` を持つこと。

### web/tests/layout-storage.test.ts(更新)

既存の 6 テストは 1 つも変更しない。次を追記する。

- `loadLayoutFlag` は未保存・`{"outlinerOpen":"no"}` / `{"outlinerOpen":null}` / `{"outlinerOpen":1}` / 壊れた JSON のいずれでも `null` を返す
- `{"outlinerOpen":false}` を保存した状態で `loadLayoutFlag("outlinerOpen")` が `false`、`loadLayoutFlag("panelOpen")` が `null`
- `saveLayoutFlag("outlinerOpen", false)` と `saveLayoutSize("panelWidth", 400)` を続けると JSON が `{ outlinerOpen: false, panelWidth: 400 }` になる(順不同、`toEqual` で検査)
- `saveLayoutFlag` は `setItem` が throw しても throw しない
- `LAYOUT_FLAG_DEFAULTS` が `{ outlinerOpen: true, panelOpen: true }`

### web/tests/layout-tokens.test.ts(更新)

`:29-32` の 2 行を新しい式に合わせる。他の検査(`--panel-width` / `--outliner-width` の rem フォールバックと `resize.ts` の既定値の一致)は変更しない。

```ts
expect(reviewPage).toContain('"--outliner-width": outlinerOpen ? effectiveOutlinerWidth + "px" : "0px"');
expect(reviewPage).toContain('"--panel-width": panelOpen ? effectivePanelWidth + "px" : "0px"');
```

### web/tests/layout-styles.test.ts(更新)

`:63-64` の 2 行だけを新しい式に置き換える。

```ts
expect(page).toContain("panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0)");
expect(page).toContain("outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0)");
```

同ファイルの他の検査(ハンドルの CSS、`grid-template-columns`、`<ResizeHandle` が 2 件、`side="start"` が 1 件、3 列の出現順、`useLayoutSize` の 2 行、`ResizeHandle.tsx` の `role="separator"`)はすべて残し、通るようにする。

### web/tests/settings-dialog.test.ts

**原則として変更しない**。`:153` の import 正規表現は、契約どおりの並びで書けば通る。もし通らない場合は import の並びを契約に合わせて直すことで解決し、テスト側の期待値を緩めないこと。

## Summary の更新

### web/src/app/app_Summary.md

- 「ファイル一覧と役割」に `review-icons.tsx` の行を追加する(ヘッダのドック開閉ボタンに使う左右ドックアイコンの SVG。path 定数と 2 つのコンポーネントを公開する、の旨)
- `ReviewPage.tsx` の説明に、左ドックと右ドックの開閉状態を `useLayoutFlag` で保持・保存し、閉じている側は `<aside>` と対応する `ResizeHandle` を描画せず列幅を `0px` にする旨、幅の上限計算で閉じている側の予約幅を 0 にする旨を追記する
- `ReviewHeader.tsx` の説明に、左右ドックの開閉トグル 2 つを `aria-pressed` 付きで常時表示する旨を追記し、「公開インターフェイス」節のシグネチャを新しい 7 props へ更新する
- `review.css` の説明に、3 列の `grid-column` 明示とヘッダのドックトグルの寸法を追記する
- `review-labels.ts` の説明と「公開インターフェイス」節に `OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL` を追記する
- 「テスト」節に `tests/dock-toggle.test.ts` の行を追加する

### web/src/features/layout/layout_Summary.md

- `layout-storage.ts` の役割を「レイアウト寸法と開閉フラグの localStorage 読み書きと不正値・例外の処理」へ更新する
- 「ファイル一覧と役割」と「公開インターフェイス」に `useLayoutFlag.ts` の行(`useLayoutFlag(name)`)と、`layout-storage.ts` の `LayoutFlagName` / `LAYOUT_FLAG_DEFAULTS` / `loadLayoutFlag` / `saveLayoutFlag` を追記する
- 「他機能との関係」に、`ReviewPage` が左右ドックの開閉を `useLayoutFlag` で保持し、閉じている側はハンドルごと描画しない旨を追記する
- 「テスト」節に `tests/dock-toggle.test.ts` の行を追加し、`tests/layout-storage.test.ts` の説明に開閉フラグを含める

## やらないこと

- キーボードショートカットは追加しない。`web/src/features/shortcuts/` 配下(`keymap.ts` の `ShortcutAction` を含む)と設定ダイアログのキー操作タブは変更しない
- 開閉のアニメーション・トランジションは付けない
- 閉じたドックを呼び出す代替の導線(ビューア端のタブ、HUD ボタン、リサイズハンドル上の矢印、ダブルクリックでの折りたたみ)は作らない。入口はヘッダの 2 ボタンだけ
- `ResizeHandle.tsx`、`resize.ts`、`layout.css`、`useLayoutSize.ts` は変更しない。寸法定数(`PANEL_WIDTH_*` / `OUTLINER_WIDTH_*` / `VIEWER_MIN_WIDTH_PX`)も変えない
- 開閉に伴って `panelWidth` / `outlinerWidth` の保存値を書き換えない(閉じるときに 0 を保存しない)
- 画面幅に応じて自動で閉じる、といったレスポンシブ挙動は入れない
- 開閉状態をサーバーや他の参加者へ共有しない。`shared` / `server` は変更しない
- `.review-body` の `grid-template-columns` 自体を書き換えたり、列数を増減したりしない
- `web/web_Summary.md` と、owns に挙げていないテスト(特に `summary-coverage.test.ts`、`styles-rules.test.ts`、`review-styles.test.ts`、`resize.test.ts`)は変更しない

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの型・シグネチャ・クラス名・DOM 構造になっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] app_Summary.md と layout_Summary.md を更新している(新規 3 ファイルが `summary-coverage.test.ts` を通る)
- [ ] すべてのファイルが 300 行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
