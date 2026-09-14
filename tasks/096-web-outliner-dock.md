---
id: 096
title: web レビュー画面のビューア左にアウトライナのドックを配置し幅を保存する
feature: web
depends_on: [093, 095]
owns: [web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/app/review-stores.ts, web/src/app/app_Summary.md, web/src/styles/tokens.css, web/tests/layout-styles.test.ts, web/tests/review-stores.test.ts, web/tests/styles-rules.test.ts, web/tests/resize.test.ts]
reads: [web/src/features/outliner/Outliner.tsx, web/src/features/outliner/SelectionRig.tsx, web/src/features/outliner/selection.ts, web/src/features/outliner/outliner-labels.ts, web/src/features/outliner/outliner_Summary.md, web/src/features/layout/resize.ts, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/useLayoutSize.ts, web/src/features/layout/layout_Summary.md, web/src/features/layout/layout.css, web/src/features/viewer/ViewerCanvas.tsx, web/src/app/review-labels.ts, web/tests/review-styles.test.ts, web/tests/objects-styles.test.ts, web/tests/timeline-styles.test.ts, web/tests/comments-styles.test.ts, web/tests/pick.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
094 のアウトライナと 095 の選択ハイライト Rig をレビュー画面へ結線する。`.review-body` を
「アウトライナ | ビューア | 右パネル」の 3 列にし、左ドックの幅を右パネルと同じ仕組み
(`ResizeHandle` + `useLayoutSize`)でドラッグ / キーボード変更・localStorage 保存できるようにする。
画面離脱時には選択ストアも他のストアと一緒に初期化する。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 093 により resize.ts に `OUTLINER_WIDTH_MIN_PX`(200)、`OUTLINER_WIDTH_DEFAULT_PX`(256)、
  `LayoutSizeName` の `"outlinerWidth"`、`outlinerWidthMax(bodyWidthPx, reservedPx?)`、
  `panelWidthMax(bodyWidthPx, reservedPx?)`、`ResizeSide` がある。`ResizeHandle` は `side?: "start" | "end"` を受け取り、
  `"start"` で「ハンドルの左にあるパネル」の向き(右へドラッグで増、ArrowRight で増)になる。
  web/src/features/layout/resize.ts、ResizeHandle.tsx
- 094 により `Outliner()`(props なし)、`OUTLINER_HEADING`、`OUTLINER_RESIZE_LABEL`("アウトライナの幅")、
  `useSelectionStore`(`reset()` あり)がある。web/src/features/outliner/
- 095 により `SelectionRig()`(props なし、`null` を返す Canvas 用 Rig)がある。`ViewerCanvas` の `children` に置く
- 現在の `ReviewPage` は `.review-body` の幅を `useElementSize(bodyRef)` で測り、
  `panelWidthMax(bodySize.width)` → `clampSize(panelWidth, PANEL_WIDTH_MIN_PX, max)` で右パネル幅を決め、
  `style={{ "--panel-width": effectivePanelWidth + "px" }}` を `.review-body` に与える。web/src/app/ReviewPage.tsx:67-72, :140-144
- `.review-body` は `grid-template-columns: minmax(0, 1fr) var(--panel-width)`。ハンドル `.review-body__resize` は
  `right: calc(var(--panel-width) - 4px)` で右パネル境界に絶対配置。web/src/app/review.css:69-78
- `.resize-handle` は `position: absolute` で `[data-axis="x"]` は `top: 0; bottom: 0; width: 8px`。左右位置は
  利用側の CSS が決める。web/src/features/layout/layout.css
- `--panel-width` は tokens.css の `:root` に `22rem` で宣言されている(inline style で上書きされる)。
  `web/tests/styles-rules.test.ts` は「CSS 内の `var(--x)` 参照は、どこかの CSS で宣言されているかフォールバック付き」を
  検査し、`tokenNames` 配列の名前が `:root` に宣言されていることも検査する。web/src/styles/tokens.css:46、web/tests/styles-rules.test.ts:20-65
- `web/tests/layout-styles.test.ts` は `review.css` に `grid-template-columns: minmax(0, 1fr) var(--panel-width)` が
  含まれることを完全一致で検査している(:26)。3 列にするとこの it が落ちるので**期待値を更新する**
- `resetReviewStores()` は 9 ストアを reset する。`web/tests/review-stores.test.ts` は各ストアに値を入れてから
  reset 後の初期値を検証する。web/src/app/review-stores.ts
- 次のテストも ReviewPage / review.css をソース検査するが、本タスクの変更で落ちてはならない(変更しない):
  `objects-styles.test.ts`(`.review-panel` の `grid-template-rows: auto auto minmax(0, 1fr)`、
  PresenceList → ObjectList → `.review-panel__comments` の順)、`timeline-styles.test.ts`(`review-stage` → `review-hud` →
  `<PlaybackTimeline />` → `<JoinDialog` の出現順)、`review-styles.test.ts`(`review-stage__error` がちょうど 1 回、
  `<div className="review-stage__error">` 直後に `<ErrorCard`)、`comments-styles.test.ts`(`.review-panel` の背景)、
  `pick.test.ts`(`modelUrl` を含まない、`<ErrorBoundary ... key={projectId}`)
- `web/tests/resize.test.ts` の "wires the resize side through the shared handle" は、093 が「093 では既存利用者を
  変えない」ことを固定するために `expect(page).not.toContain('side="start"')`(page = `app/ReviewPage.tsx`)を
  置いている。本タスクは ReviewPage に `side="start"` を置くので、この断言は本タスクの要件と矛盾する。
  **このテストは owns に含まれており、期待値を更新する**(下記「振る舞い」参照)

## インターフェイス契約

### 変更 web/src/styles/tokens.css

`--panel-width: 22rem;` の直後に 1 行追加する。他は変更しない。

```css
  --outliner-width: 16rem;
```

### 変更 web/tests/styles-rules.test.ts

`tokenNames` 配列の `"--panel-width"` の直後に `"--outliner-width"` を追加する。他は変更しない。

### 変更 web/src/app/review.css

```css
.review-body {
  position: relative;
  display: grid;
  grid-template-columns: var(--outliner-width) minmax(0, 1fr) var(--panel-width);
  min-height: 0;
}

.review-body__resize {
  right: calc(var(--panel-width) - 4px);
}

/* 左ドック境界のハンドル。.review-body__resize と併用し right を打ち消す */
.review-body__resize--outliner {
  right: auto;
  left: calc(var(--outliner-width) - 4px);
}

.review-outliner {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}
```

`.review-panel` / `.review-viewer` / `.review-stage*` / `.review-hud` などの既存ルールは変更しない。

### 変更 web/src/app/ReviewPage.tsx

import を追加する(既存 import は残す):

```ts
import { Outliner } from "../features/outliner/Outliner";
import { SelectionRig } from "../features/outliner/SelectionRig";
import { OUTLINER_RESIZE_LABEL } from "../features/outliner/outliner-labels";
import {
  clampSize,
  OUTLINER_WIDTH_DEFAULT_PX,
  OUTLINER_WIDTH_MIN_PX,
  outlinerWidthMax,
  PANEL_WIDTH_DEFAULT_PX,
  PANEL_WIDTH_MIN_PX,
  panelWidthMax,
} from "../features/layout/resize";
```

幅の決め方(**この順序で計算する**。右パネルを先に確定し、左ドックはその残りで上限を決める):

```ts
const [panelWidth, setPanelWidth] = useLayoutSize("panelWidth");
const [outlinerWidth, setOutlinerWidth] = useLayoutSize("outlinerWidth");
const maxPanelWidth = panelWidthMax(bodySize.width, OUTLINER_WIDTH_MIN_PX);
const effectivePanelWidth = clampSize(panelWidth, PANEL_WIDTH_MIN_PX, maxPanelWidth);
const maxOutlinerWidth = outlinerWidthMax(bodySize.width, effectivePanelWidth);
const effectiveOutlinerWidth = clampSize(outlinerWidth, OUTLINER_WIDTH_MIN_PX, maxOutlinerWidth);
```

`.review-body` の style を `{ "--outliner-width": effectiveOutlinerWidth + "px", "--panel-width": effectivePanelWidth + "px" }` にする。

`.review-body` の子の並び(**この順**):

```tsx
<aside className="review-outliner" aria-label="アウトライナドック">
  <Outliner />
</aside>
<ResizeHandle
  axis="x"
  side="start"
  className="review-body__resize review-body__resize--outliner"
  value={effectiveOutlinerWidth}
  min={OUTLINER_WIDTH_MIN_PX}
  max={maxOutlinerWidth}
  defaultValue={OUTLINER_WIDTH_DEFAULT_PX}
  label={OUTLINER_RESIZE_LABEL}
  onChange={setOutlinerWidth}
/>
<section className="review-viewer" aria-label="3D ビューア">…既存のまま…</section>
<ResizeHandle axis="x" className="review-body__resize" … 既存のまま(side は付けない) … />
<aside className="review-panel" aria-label="サイドパネル">…既存のまま…</aside>
```

`ViewerCanvas` の children の末尾(`<CommentPins />` の直後)に `<SelectionRig />` を追加する。
それ以外の JSX(`review-stage` / `review-hud` / `ErrorBoundary` / `PlaybackTimeline` / `JoinDialog` / 右パネルの中身)は変更しない。

### 変更 web/src/app/review-stores.ts

`import { useSelectionStore } from "../features/outliner/selection";` を追加し、`resetReviewStores` の末尾で
`useSelectionStore.getState().reset();` を呼ぶ。doc コメントの「9つ」を「10個」に直す。

## 振る舞い

### review-stores(web/tests/review-stores.test.ts を更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `useSelectionStore.getState().toggleSelection({ versionId: "v1", objectId: "o1" })` の後 `resetReviewStores()` | `useSelectionStore.getState().selected` が `null`。既存 9 ストアの検証はそのまま通る |

### layout / review のソース検査(web/tests/layout-styles.test.ts を更新)

既存の "places the handle on the review body boundary" の `grid-template-columns` の期待値を
`grid-template-columns: var(--outliner-width) minmax(0, 1fr) var(--panel-width)` に変える。他の既存 expect は残す。
次を追加する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `app/review.css` | `.review-body__resize--outliner` の本文に `right: auto` と `left: calc(var(--outliner-width) - 4px)` を含む(review-styles.test.ts の `ruleBody` と同じ方法で切り出す) |
| `app/review.css` | `.review-outliner` の本文に `overflow: auto`、`border-right: 1px solid var(--color-border)`、`background: var(--color-surface-subtle)` を含む |
| `styles/tokens.css` | `--outliner-width:` を含む |
| `app/ReviewPage.tsx` | `useLayoutSize("outlinerWidth")`、`useLayoutSize("panelWidth")`、`"--outliner-width"`、`"--panel-width"` を含む |
| `app/ReviewPage.tsx` | `side="start"` がちょうど 1 回。`className="review-body__resize review-body__resize--outliner"` を含む。`label={OUTLINER_RESIZE_LABEL}` を含む |
| `app/ReviewPage.tsx` | `<ResizeHandle` がちょうど 2 回 |
| `app/ReviewPage.tsx` | `panelWidthMax(bodySize.width, OUTLINER_WIDTH_MIN_PX)` と `outlinerWidthMax(bodySize.width, effectivePanelWidth)` を含む(右パネル優先の計算順) |
| `app/ReviewPage.tsx` | 出現順が `className="review-outliner"` < `side="start"` < `className="review-viewer"` < `className="review-panel"` |
| `app/ReviewPage.tsx` | `<Outliner />` がちょうど 1 回、`<SelectionRig />` がちょうど 1 回。`<SelectionRig />` の位置が `<CommentPins />` より後で `</ViewerCanvas>` より前 |
| `features/viewer/ViewerCanvas.tsx` | `SelectionRig` を含まない(Rig は ReviewPage が差し込む) |

### resize のソース検査(web/tests/resize.test.ts を更新)

既存の "wires the resize side through the shared handle" の中で、次の 1 行だけを変える。

| 変更前 | 変更後 |
| --- | --- |
| `expect(page).not.toContain('side="start"');` | `expect(page).toContain('side="start"');` |

`expect(timeline).not.toContain('side="start"');`(PlaybackTimeline 側)と、`handle` に対する 4 つの expect は
そのまま残す。この it 以外の resize.test.ts の内容は変更しない。

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| レビュー画面を開く | ビューアの左に幅 256px のアウトライナ、右に従来のサイドパネル。ビューアは中央 |
| 左ドックの右端をつかんで右へドラッグ | アウトライナが広がり、ビューアが狭まる。右パネルは動かない |
| 左ドックを広げ続ける | ビューアが 320px を切る手前で止まる |
| 右パネルを最大まで広げる | アウトライナは 200px まで縮められるが、それ未満にはならない。ビューアは 320px 以上を保つ |
| 左ドックのハンドルにフォーカスして ArrowRight / ArrowLeft | 16px ずつ広がる / 狭まる。Home で 200px、End で最大 |
| ハンドルをダブルクリック | 256px に戻る |
| 幅を変えてリロード | 左右それぞれの幅が保存されている(localStorage の `3dreviewer:layout` に `outlinerWidth` が入る) |
| ウィンドウを狭くする | 右パネル → 左ドックの順に縮み、ビューアの最小幅が保たれる |
| アウトライナで行を選択 | 3D ビューで対象が青く覆われる(095 の Rig が動いている) |
| 別のプロジェクトへ遷移する | 選択が解除され、重ね描きが残らない |
| 右パネル(参加者 / オブジェクト / コメント)、HUD、タイムライン、入室ダイアログ | 従来どおり |

## 実装メモ
- 幅の計算順は契約のとおり右パネル優先で固定する。逆順や相互参照にしない(循環する)
- 左ドックのハンドルは `.review-body__resize` と `.review-body__resize--outliner` の**両方**のクラスを付ける。
  `layout.css` の `.resize-handle` が `position: absolute` を持つので、左右位置だけを review.css で決める
- `aside.review-outliner` は `overflow: auto` で縦スクロールする。中の `.outliner` は 094 が `min-height: 0` を持つ
- `SelectionRig` は `ViewerCanvas` の children として置く(`MeshCompareRig` のように `ViewerCanvas.tsx` 内部へ置かない。
  `ViewerCanvas.tsx` は本タスクの owns に無い)
- `review-labels.ts` は変更しない。ハンドルのラベルは outliner-labels の `OUTLINER_RESIZE_LABEL` を使う

## やらないこと
- アウトライナ本体・ハイライト(094 / 095)や layout 部品(093)の変更
- `ViewerCanvas.tsx` / `review-labels.ts` / `layout.css` / `PlaybackTimeline.tsx` の変更
- 左ドックの折りたたみ(非表示)ボタン、タブ化、ドックの並べ替え
- `.review-panel`(右パネル)のレイアウト変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの計算順・JSX の並び・CSS で実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る。既存の objects-styles / timeline-styles /
      review-styles / comments-styles / pick の各テストが変更なしで通る。resize.test.ts は上記の 1 行だけを変えて通る
- [ ] app_Summary.md を更新している。具体的には `ReviewPage.tsx` の説明に「左ドック `.review-outliner` に
      `Outliner`、`outlinerWidth` の保存、右パネル優先の幅計算、Canvas に `SelectionRig`」を足し、
      `review-stores.ts` を 10 ストアに直し、`review.css` の説明に 3 列 grid と左ドックを足す
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
