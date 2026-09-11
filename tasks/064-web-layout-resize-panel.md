---
id: 064
title: web 境界ドラッグの共通部品(ResizeHandle・純粋関数・localStorage 保存)を作り、右サイドパネルの幅を左辺の境界で変えられるようにする
feature: web
depends_on: []
owns: [web/src/features/layout/resize.ts, web/src/features/layout/layout-storage.ts, web/src/features/layout/useLayoutSize.ts, web/src/features/layout/useElementSize.ts, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/layout.css, web/src/features/layout/layout_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/app/review-labels.ts, web/src/app/app_Summary.md, web/web_Summary.md, web/tests/resize.test.ts, web/tests/layout-storage.test.ts, web/tests/layout-styles.test.ts, web/tests/review-labels.test.ts]
reads: [web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/light-gizmo.ts, web/src/features/timeline/TimelineRuler.tsx, web/src/features/shortcuts/keymap-storage.ts, web/src/app/display-name.ts, web/src/styles/tokens.css, web/src/styles/base.css, web/src/features/comments/comments.css, web/tests/keymap-storage.test.ts, web/tests/timeline-styles.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
レビュー画面の右サイドパネル(参加者 + コメント)は幅がトークン `--panel-width: 22rem` で固定されている。
パネル左辺の境界をつかんでドラッグし、幅を変えられるようにする。あわせて、境界ドラッグの共通部品
(ハンドル要素・範囲丸め・localStorage 保存)を新フォルダ `features/layout/` に置く。
この部品はタスク 065(タイムラインの高さ)でも使うため、縦横どちらの境界にも使える形で作る。
サイズは localStorage に保存し、再読み込み後も維持する。ハンドルのダブルクリックで既定値に戻す。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### レイアウトの現状
- `.review-body` は 2 カラム grid `grid-template-columns: minmax(0, 1fr) var(--panel-width)`。
  web/src/app/review.css:74-78。`--panel-width: 22rem` は web/src/styles/tokens.css:45 で `:root` に宣言されている。
  **tokens.css は変更しない**(`--panel-width` の宣言はそのまま残し、値を inline style で上書きする)
- `.review-body` の DOM は `<div className="review-body">` > `<section className="review-viewer">` + `<aside className="review-panel">`。
  web/src/app/ReviewPage.tsx:118-153。`.review-page` は `overflow: hidden`(review.css:1-7)
- `.review-panel` は review.css:140-148 で `overflow: auto`、さらに web/src/features/comments/comments.css:1-3 で
  `overflow: hidden` に上書きされている。**そのため、パネルの外へはみ出す要素をパネルの子として置くと切れる**。
  ハンドルは `.review-body` の直下に絶対配置で置く(後述)
- `.review-viewer` は `position: relative` だが `z-index` を持たない(review.css:84-92)。入室ダイアログ等の
  `.review-backdrop` は `z-index: 2`(review.css:107-114)、HUD の `.review-hud` は `z-index: 1`(:94-105)。
  どちらも `.review-viewer` の中にあり、パネルの境界には重ならない
- `web/tests/timeline-styles.test.ts:34-43` は ReviewPage.tsx のソース内で `className="review-stage"` →
  `className="review-hud"` → `<PlaybackTimeline />` → `<JoinDialog` の順に現れることを検査する。
  この順序を崩さない(ハンドルは `</section>` の後、`<aside` の前に置くので影響しない)

### 既存の書き方(倣うもの)
- pointer capture でドラッグする書き方は web/src/features/viewer/LightGizmo.tsx:53-79
  (`button !== 0` は無視、`setPointerCapture` / `releasePointerCapture`、`dragRef` に pointerId を保持)と
  純粋関数 `gizmoDragStep` web/src/features/viewer/light-gizmo.ts:24-40 に倣う
- `role` + `tabIndex={0}` + `aria-value*` + `onKeyDown` の書き方は LightGizmo.tsx:92-104 に倣う
- ResizeObserver で要素サイズを測る書き方は web/src/features/timeline/TimelineRuler.tsx:16-30 に倣う。
  jsdom に ResizeObserver は無いので `typeof ResizeObserver === "undefined"` のガードを入れる。
  **コンポーネントとフックはテストしない**(純粋関数・storage・CSS のソース検査だけテストする)
- localStorage の読み書きは web/src/features/shortcuts/keymap-storage.ts(44 行)に倣う。try/catch で
  例外を握り、不正値は既定へ落とす。テストは web/tests/keymap-storage.test.ts(`beforeEach(() => localStorage.clear())`)に倣う。
  既存のキーは `"3dreviewer:keymap"`、表示名は web/src/app/display-name.ts 参照
- `useShortcuts` の keydown は `isTypingTarget`(INPUT / TEXTAREA / SELECT / contenteditable)以外を拾うが、
  既定 keymap に矢印キー・Home・End は無い(タスク 063 と同じ)。ハンドルの `onKeyDown` は
  `preventDefault` するので競合しない

### スタイル・Summary の規約
- `web/tests/styles-rules.test.ts` は `src/**/*.css` を全部走査する。tokens.css 以外の生色禁止、
  `var(--x)` は tokens.css の宣言かフォールバックが必要、`!important` / `@import` 禁止。新規 `layout.css` も対象
- 状態はクラスの付け替えではなく `aria-*` / `data-*` 属性で表す(web/web_Summary.md「スタイル規約(D35)」)
- `web/tests/summary-coverage.test.ts`: src の全 .ts/.tsx/.css が最寄りの `_Summary.md` に相対パスで載り、
  `tests/*.test.ts` の全ファイル名がいずれかの Summary に載り、各フォルダ Summary が `web/web_Summary.md` に
  パスで索引されていること(:86-91)を検査する。新フォルダ `features/layout/` を作るので `layout_Summary.md` を書き、
  `web/web_Summary.md` の一覧(:17-24)に `src/features/layout/layout_Summary.md` を足す。
  Summary の節構成は `web/web_Summary.md:13-15` のとおり
- `tsconfig.base.json` は `noUncheckedIndexedAccess: true`
- 現在の行数: ReviewPage.tsx 157、review.css 160、review-labels.ts 61、app_Summary.md 62

## インターフェイス契約

### 新規 web/src/features/layout/resize.ts(純粋関数。React / DOM に依存しない)

```ts
/** "x": 横にドラッグして幅を変える(ハンドルはペインの左辺) / "y": 縦にドラッグして高さを変える(ハンドルはペインの上辺) */
export type ResizeAxis = "x" | "y";

/** 矢印キー 1 回ぶんの増減(px) */
export const RESIZE_KEY_STEP_PX = 16;
/** 右パネル幅。既定は tokens.css の --panel-width: 22rem を px にした値 */
export const PANEL_WIDTH_MIN_PX = 256;
export const PANEL_WIDTH_DEFAULT_PX = 352;
/** パネルを広げてもビューアに残す最小幅(20rem) */
export const VIEWER_MIN_WIDTH_PX = 320;
/** タイムラインのルーラー帯の高さ(タスク 065 が使う。ここでは定義だけ) */
export const TIMELINE_TRACK_MIN_PX = 32;
export const TIMELINE_TRACK_MAX_PX = 240;
export const TIMELINE_TRACK_DEFAULT_PX = 32;

export type LayoutSizeName = "panelWidth" | "timelineHeight";

export interface SizeSpec {
  min: number;
  max: number;
  defaultValue: number;
}

/** 名前ごとの既定範囲。panelWidth の max は静的な上限が無いので Number.POSITIVE_INFINITY(実際の上限は panelWidthMax で決める) */
export const LAYOUT_SIZE_SPECS: Readonly<Record<LayoutSizeName, SizeSpec>>;

/** value を [min, max] に丸めて整数(Math.round)にする。value が非有限なら min。max < min なら min */
export function clampSize(value: number, min: number, max: number): number;

/** .review-body の幅から決まるパネル幅の上限。Math.max(PANEL_WIDTH_MIN_PX, Math.floor(bodyWidthPx) - VIEWER_MIN_WIDTH_PX)。bodyWidthPx が非有限なら PANEL_WIDTH_MIN_PX */
export function panelWidthMax(bodyWidthPx: number): number;

/** ドラッグ開始時の状態。client は axis "x" なら clientX、"y" なら clientY */
export interface ResizeDrag {
  pointerId: number;
  startClient: number;
  startValue: number;
}

/**
 * pointermove 1 回ぶんの値。drag が null か pointerId が違えば null。
 * それ以外は clampSize(drag.startValue + (drag.startClient - client), min, max)
 * (ハンドルはペインの左辺／上辺にあるので、ポインタが負方向へ動くほどペインが大きくなる)
 */
export function resizeDragValue(drag: ResizeDrag | null, pointerId: number, client: number, min: number, max: number): number | null;

/**
 * キー操作後の値。対象外のキーは null。結果は clampSize で丸める。
 * axis "x": ArrowLeft → value + STEP、ArrowRight → value - STEP
 * axis "y": ArrowUp → value + STEP、ArrowDown → value - STEP
 * 両軸共通: Home → min、End → max
 */
export function resizeKeyValue(key: string, axis: ResizeAxis, value: number, min: number, max: number): number | null;
```

### 新規 web/src/features/layout/layout-storage.ts

```ts
import type { LayoutSizeName } from "./resize";

export const LAYOUT_STORAGE_KEY = "3dreviewer:layout";

/**
 * localStorage の LAYOUT_STORAGE_KEY に入っている JSON オブジェクトから name の値を返す。
 * キーが無い / JSON として壊れている / オブジェクトでない / その名前が無い / 有限な数でない /
 * localStorage が例外を投げる、のいずれでも null
 */
export function loadLayoutSize(name: LayoutSizeName): number | null;

/**
 * name の値を保存する。他の名前の値は残す(読み出せない既存値はオブジェクトごと捨ててよい)。
 * localStorage が例外を投げても握りつぶす(keymap-storage.ts:38-44 と同じ)
 */
export function saveLayoutSize(name: LayoutSizeName, value: number): void;
```

### 新規 web/src/features/layout/useLayoutSize.ts

```ts
import type { LayoutSizeName } from "./resize";

/**
 * 初期値は loadLayoutSize(name) ?? LAYOUT_SIZE_SPECS[name].defaultValue。
 * setValue は state を更新し、同時に saveLayoutSize(name, value) する。丸めはしない(呼び出し側が clampSize する)
 */
export function useLayoutSize(name: LayoutSizeName): [value: number, setValue: (value: number) => void];
```

### 新規 web/src/features/layout/useElementSize.ts

```ts
import type { RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * ref の要素の contentRect を ResizeObserver で追従する。測定前と ref が null の間は { width: 0, height: 0 }。
 * ResizeObserver が無い環境では useLayoutEffect 内で getBoundingClientRect を一度だけ読む。
 * 非有限は 0、負は 0 に丸める(TimelineRuler.tsx:16-30 と同じ扱い)
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize;
```

### 新規 web/src/features/layout/ResizeHandle.tsx

```tsx
import type { ResizeAxis } from "./resize";

export interface ResizeHandleProps {
  axis: ResizeAxis;
  /** 現在のペインのサイズ(px)。aria-valuenow に出す */
  value: number;
  min: number;
  max: number;
  /** ダブルクリックで戻す値 */
  defaultValue: number;
  /** aria-label */
  label: string;
  /** "resize-handle" の後ろに空白区切りで足すクラス(配置は呼び出し側の CSS が決める) */
  className?: string;
  onChange(value: number): void;
}

export function ResizeHandle(props: ResizeHandleProps): ReactElement;
```

描画する要素は次の 1 つ(子要素なし)。

```tsx
<div
  role="separator"
  tabIndex={0}
  className={"resize-handle" + (className ? " " + className : "")}
  data-axis={axis}
  data-dragging={dragging}           // ドラッグ中だけ true
  aria-orientation={axis === "x" ? "vertical" : "horizontal"}
  aria-label={label}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  onPointerDown / onPointerMove / onPointerUp / onPointerCancel / onDoubleClick / onKeyDown
/>
```

- `onPointerDown`: `button !== 0` は無視。`setPointerCapture` し `dragRef = { pointerId, startClient, startValue: value }`。
  `startClient` は axis "x" なら `clientX`、"y" なら `clientY`
- `onPointerMove`: `resizeDragValue(dragRef, pointerId, client, min, max)` が null でなければ `onChange`
- `onPointerUp` / `onPointerCancel`: 自分の pointerId なら `releasePointerCapture` し dragRef を null にする
- `onDoubleClick`: `onChange(defaultValue)`
- `onKeyDown`: `resizeKeyValue(...)` が null でなければ `event.preventDefault()` して `onChange`
- `import "./layout.css"` をこのファイルで行う

### 新規 web/src/features/layout/layout.css

`.resize-handle` の共通見た目だけを書く。**位置(right / top のオフセット)は呼び出し側の CSS が決める**。

```css
.resize-handle {
  position: absolute;
  z-index: 1;
  touch-action: none;
  user-select: none;
}
.resize-handle[data-axis="x"] { top: 0; bottom: 0; width: 8px; cursor: col-resize; }
.resize-handle[data-axis="y"] { left: 0; right: 0; height: 8px; cursor: row-resize; }
```

- ホバー・`:focus-visible`・`[data-dragging="true"]` のときだけ、境界の中央に `--color-accent` の 2px の線を
  `::after` で表示する(通常は透明)。線の位置は "x" なら幅 2px を水平中央、"y" なら高さ 2px を垂直中央
- フォーカスリングは base.css の既定に任せる(独自の `outline` を書かない)

### 変更 web/src/app/review-labels.ts

```ts
export const PANEL_RESIZE_LABEL = "サイドパネルの幅";
```

### 変更 web/src/app/ReviewPage.tsx

- `bodyRef = useRef<HTMLDivElement>(null)` を `.review-body` に付け、`useElementSize(bodyRef)` で幅を測る
- `const [panelWidth, setPanelWidth] = useLayoutSize("panelWidth")`
- `max = panelWidthMax(bodyWidth)`、`effective = clampSize(panelWidth, PANEL_WIDTH_MIN_PX, max)`
- `.review-body` に `style={{ "--panel-width": effective + "px" } as CSSProperties}` を付ける
- `</section>` の直後、`<aside` の直前に
  `<ResizeHandle axis="x" className="review-body__resize" value={effective} min={PANEL_WIDTH_MIN_PX} max={max} defaultValue={PANEL_WIDTH_DEFAULT_PX} label={PANEL_RESIZE_LABEL} onChange={setPanelWidth} />`
- これらのフックは早期 return(loading / error)より**前**に呼ぶ(フックの順序を守る)

### 変更 web/src/app/review.css

- `.review-body` に `position: relative;` を足す(grid の宣言はそのまま)
- 追加: `.review-body__resize { right: calc(var(--panel-width) - 4px); }`
  (幅 8px のハンドルの中心がパネルの左辺 = `--panel-width` の位置に来る)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `clampSize(300, 256, 400)` | 300 |
| `clampSize(100, 256, 400)` / `clampSize(900, 256, 400)` | 256 / 400 |
| `clampSize(300.4, 256, 400)` / `clampSize(300.6, 256, 400)` | 300 / 301 |
| `clampSize(NaN, 256, 400)` / `clampSize(Infinity, 256, 400)` | 256 / 400 |
| `clampSize(300, 256, 100)`(max < min) | 256 |
| `panelWidthMax(1280)` | 960 |
| `panelWidthMax(500)` / `panelWidthMax(0)` / `panelWidthMax(NaN)` | 256 / 256 / 256 |
| `panelWidthMax(1000.9)` | 680(floor してから引く) |
| `LAYOUT_SIZE_SPECS.panelWidth` | `{ min: 256, max: Infinity, defaultValue: 352 }` |
| `LAYOUT_SIZE_SPECS.timelineHeight` | `{ min: 32, max: 240, defaultValue: 32 }` |
| `resizeDragValue(null, 1, 100, 256, 960)` | null |
| `resizeDragValue({ pointerId: 1, startClient: 800, startValue: 352 }, 2, 700, 256, 960)` | null(pointerId 不一致) |
| `resizeDragValue({ pointerId: 1, startClient: 800, startValue: 352 }, 1, 700, 256, 960)` | 452(左へ 100px → 100 広がる) |
| `resizeDragValue({ pointerId: 1, startClient: 800, startValue: 352 }, 1, 950, 256, 960)` | 256(min に当たる) |
| `resizeDragValue({ pointerId: 1, startClient: 800, startValue: 352 }, 1, 0, 256, 960)` | 960(max に当たる) |
| `resizeKeyValue("ArrowLeft", "x", 352, 256, 960)` / `("ArrowRight", "x", 352, …)` | 368 / 336 |
| `resizeKeyValue("ArrowUp", "y", 32, 32, 240)` / `("ArrowDown", "y", 32, 32, 240)` | 48 / 32(min で止まる) |
| `resizeKeyValue("ArrowUp", "x", 352, 256, 960)` / `("ArrowLeft", "y", 32, 32, 240)` | null / null(軸違いのキーは無視) |
| `resizeKeyValue("Home", "x", 352, 256, 960)` / `("End", "x", 352, 256, 960)` | 256 / 960 |
| `resizeKeyValue("Enter", "x", 352, 256, 960)` | null |
| `PANEL_RESIZE_LABEL`(review-labels.test.ts) | `"サイドパネルの幅"` |
| `loadLayoutSize("panelWidth")`、localStorage が空 | null |
| localStorage に `{"panelWidth":400}` | `loadLayoutSize("panelWidth")` → 400、`loadLayoutSize("timelineHeight")` → null |
| localStorage に `{`、`null`、`[]`、`5`、`"x"`、`{"panelWidth":"400"}`、`{"panelWidth":null}`、`{"panelWidth":1e999}` のいずれか | `loadLayoutSize("panelWidth")` → null |
| `saveLayoutSize("panelWidth", 400)` → `saveLayoutSize("timelineHeight", 64)` | localStorage の値は `{"panelWidth":400,"timelineHeight":64}` と JSON として等しく、両方読める |
| localStorage に壊れた値がある状態で `saveLayoutSize("panelWidth", 400)` | 例外を投げず、以後 `loadLayoutSize("panelWidth")` → 400 |
| `localStorage.setItem` が例外を投げる | `saveLayoutSize` は例外を投げない |
| CSS(layout-styles.test.ts で検査) | `.resize-handle` が `position: absolute` と `touch-action: none` を含む。`.resize-handle[data-axis="x"]` が `cursor: col-resize`、`[data-axis="y"]` が `cursor: row-resize` を含む。`.review-body` が `position: relative` と `grid-template-columns: minmax(0, 1fr) var(--panel-width)` を含む。`.review-body__resize` が `calc(var(--panel-width) - 4px)` を含む |
| ソース(layout-styles.test.ts で検査) | ReviewPage.tsx が `<ResizeHandle` と `axis="x"` と `"--panel-width"` を含む。ResizeHandle.tsx が `role="separator"` と `import "./layout.css"` を含む |
| 画面(手動確認) | パネル左辺の境界にカーソルを置くと `col-resize` になり、左へドラッグするとパネルが広がる。ダブルクリックで 22rem 相当へ戻る。再読み込み後も幅が保たれる |

## やらないこと
- タイムラインの高さの変更(タスク 065)。`features/timeline/` は触らない
- パネル内の参加者 / コメントの境界は動かせるようにしない
- tokens.css に新しいトークンを足さない。`--panel-width` の宣言・値は変えない
- ResizeHandle / useLayoutSize / useElementSize のコンポーネントテスト(jsdom に ResizeObserver が無い)
- パネルの折りたたみ・非表示、ウィンドウ幅に応じた自動レイアウト変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行(手動確認の行を除く)に対応するテストがあり、通る
- [ ] layout_Summary.md を新規作成し、app_Summary.md(ReviewPage / review.css / review-labels の説明)と web_Summary.md(索引)を更新している
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
