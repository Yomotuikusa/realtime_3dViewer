---
id: 093
title: layout 左ドック用の寸法 outlinerWidth とハンドルの向き side を追加する
feature: web
depends_on: []
owns: [web/src/features/layout/resize.ts, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/layout_Summary.md, web/tests/resize.test.ts, web/tests/layout-storage.test.ts]
reads: [web/src/features/layout/layout-storage.ts, web/src/features/layout/useLayoutSize.ts, web/src/features/layout/layout.css, web/src/app/ReviewPage.tsx, web/src/features/timeline/PlaybackTimeline.tsx, web/tests/layout-styles.test.ts, web/tests/timeline-styles.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
ビューアの**左**にアウトライナのドック(タスク 094〜096)を置くため、レイアウト共通部品に
「左ドックの幅」の寸法名と、「ハンドルの左側/上側にあるパネル」を伸縮できる向きの指定を足す。
現在の `ResizeHandle` は右パネル・下タイムライン(ハンドルの右/下にあるパネル)専用で、
左へドラッグすると値が増える固定の向きになっている。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `LayoutSizeName` は現在 `"panelWidth" | "timelineHeight"`。`LAYOUT_SIZE_SPECS` はこの型を
  キーにした `Record` なので、名前を足すと仕様も必ず足す必要がある。web/src/features/layout/resize.ts:16-34
- `loadLayoutSize` / `saveLayoutSize` / `useLayoutSize` は `LayoutSizeName` を受け取るだけで
  名前ごとの分岐が無い。名前を足しても**これらのファイルは変更不要**。web/src/features/layout/layout-storage.ts、useLayoutSize.ts
- `resizeDragValue` は `drag.startValue + (drag.startClient - client)`、つまり
  ポインタが左/上へ動くと値が増える。web/src/features/layout/resize.ts:63-75
- `resizeKeyValue` は axis `"x"` なら `ArrowLeft` で増、`ArrowRight` で減、`"y"` なら `ArrowUp` で増、
  `ArrowDown` で減。`Home` は min、`End` は max。web/src/features/layout/resize.ts:78-99
- `panelWidthMax(bodyWidthPx)` は `max(PANEL_WIDTH_MIN_PX, floor(body) - VIEWER_MIN_WIDTH_PX)`。
  非有限なら `PANEL_WIDTH_MIN_PX`。web/src/features/layout/resize.ts:49-54
- 既存の利用者は 2 箇所。`ReviewPage.tsx:167-176`(axis `"x"`、右パネル)と
  `PlaybackTimeline.tsx:49-58`(axis `"y"`、下タイムライン)。どちらも**ハンドルの右/下にパネルがある**
  向きなので、本タスクの追加は既定値で従来どおりに動かなければならない
- `web/tests/layout-styles.test.ts` は `ResizeHandle.tsx` が `role="separator"` と
  `import "./layout.css"` を含むことをソース検査する。これは維持する
- `web/tests/timeline-styles.test.ts:57` は `LAYOUT_SIZE_SPECS.timelineHeight.defaultValue` を参照する。値は変えない
- `web/tests/summary-coverage.test.ts` は src の全ファイルが最寄りの `_Summary.md` に載っていること、
  `web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っていることを検査する

## インターフェイス契約

### 変更 web/src/features/layout/resize.ts

既存のエクスポートはすべて残し、次を**追加**する。既存の定数値は変えない。

```ts
/** 左ドック(アウトライナ)幅の最小値と既定値(px)。 */
export const OUTLINER_WIDTH_MIN_PX = 200;
export const OUTLINER_WIDTH_DEFAULT_PX = 256;

export type LayoutSizeName = "panelWidth" | "timelineHeight" | "outlinerWidth";

/**
 * ハンドルから見て伸縮するパネルがどちら側にあるか。
 * "end" = ハンドルの右/下(既存の右パネル・タイムライン)。"start" = ハンドルの左/上(左ドック)。
 */
export type ResizeSide = "start" | "end";

export const LAYOUT_SIZE_SPECS: Readonly<Record<LayoutSizeName, SizeSpec>> = {
  panelWidth: { min: PANEL_WIDTH_MIN_PX, max: Number.POSITIVE_INFINITY, defaultValue: PANEL_WIDTH_DEFAULT_PX },
  timelineHeight: { min: TIMELINE_TRACK_MIN_PX, max: TIMELINE_TRACK_MAX_PX, defaultValue: TIMELINE_TRACK_DEFAULT_PX },
  outlinerWidth: { min: OUTLINER_WIDTH_MIN_PX, max: Number.POSITIVE_INFINITY, defaultValue: OUTLINER_WIDTH_DEFAULT_PX },
};

/**
 * .review-body の幅から求める右パネル幅の上限。
 * reservedPx は同じ行に並ぶ他パネル(左ドック)の幅で、その分も差し引く。既定 0。
 * 非有限な bodyWidthPx なら PANEL_WIDTH_MIN_PX。
 */
export function panelWidthMax(bodyWidthPx: number, reservedPx?: number): number;

/**
 * .review-body の幅から求める左ドック幅の上限。式は panelWidthMax と同じで、下限が OUTLINER_WIDTH_MIN_PX。
 * max(OUTLINER_WIDTH_MIN_PX, floor(bodyWidthPx) - VIEWER_MIN_WIDTH_PX - reservedPx)。非有限なら OUTLINER_WIDTH_MIN_PX。
 */
export function outlinerWidthMax(bodyWidthPx: number, reservedPx?: number): number;

/** side="end"(既定)は従来どおり startClient - client、"start" は client - startClient を加える。 */
export function resizeDragValue(
  drag: ResizeDrag | null,
  pointerId: number,
  client: number,
  min: number,
  max: number,
  side?: ResizeSide,
): number | null;

/** side="start" のときは増減キーを入れ替える(x: ArrowRight が増、y: ArrowDown が増)。Home / End は変わらない。 */
export function resizeKeyValue(
  key: string,
  axis: ResizeAxis,
  value: number,
  min: number,
  max: number,
  side?: ResizeSide,
): number | null;
```

- `reservedPx` は非有限または負なら 0 として扱う
- `panelWidthMax` と `outlinerWidthMax` の共通部分は非公開の内部関数にまとめてよい

### 変更 web/src/features/layout/ResizeHandle.tsx

```ts
export interface ResizeHandleProps {
  axis: ResizeAxis;
  /** 省略時 "end"(従来の向き) */
  side?: ResizeSide;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  label: string;
  className?: string;
  onChange(value: number): void;
}
```

- `side` を `resizeDragValue` と `resizeKeyValue` の末尾引数へそのまま渡す
- ルート要素に `data-side={side}` を追加する(値は `"start"` または `"end"`。省略時も `"end"` が付く)
- それ以外の JSX・属性・pointer capture の処理は変更しない

## 振る舞い

### resize(web/tests/resize.test.ts に追加。既存の it は変更しない)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `OUTLINER_WIDTH_MIN_PX` / `OUTLINER_WIDTH_DEFAULT_PX` | `200` / `256` |
| `LAYOUT_SIZE_SPECS.outlinerWidth` | `{ min: 200, max: Infinity, defaultValue: 256 }` |
| `LAYOUT_SIZE_SPECS.panelWidth` / `.timelineHeight` | 従来の値のまま(既存 it が検証) |
| `panelWidthMax(1280)` | `960`(既存の it。reservedPx 省略で従来どおり) |
| `panelWidthMax(1280, 256)` | `704` |
| `panelWidthMax(700, 256)` | `256`(下限で止まる) |
| `panelWidthMax(1280, Number.NaN)` / `panelWidthMax(1280, -50)` | `960`(reservedPx を 0 扱い) |
| `outlinerWidthMax(1280)` | `960` |
| `outlinerWidthMax(1280, 352)` | `608` |
| `outlinerWidthMax(500, 352)` / `outlinerWidthMax(0)` / `outlinerWidthMax(Number.NaN)` | `200` |
| `outlinerWidthMax(1000.9, 352)` | `328`(floor してから引く) |
| `resizeDragValue(drag, 1, 700, 256, 960)`(drag = `{pointerId:1,startClient:800,startValue:352}`) | `452`(既存の it。side 省略) |
| `resizeDragValue(drag, 1, 700, 256, 960, "end")` | `452` |
| `resizeDragValue(drag, 1, 700, 256, 960, "start")` | `256`(352 - 100 = 252 を下限で丸める) |
| `resizeDragValue(drag, 1, 900, 256, 960, "start")` | `452` |
| `resizeDragValue(drag, 1, 2000, 256, 960, "start")` | `960` |
| `resizeDragValue(null, 1, 900, 256, 960, "start")` / pointerId 不一致 | `null` |
| `resizeKeyValue("ArrowRight", "x", 352, 256, 960, "start")` | `368` |
| `resizeKeyValue("ArrowLeft", "x", 352, 256, 960, "start")` | `336` |
| `resizeKeyValue("ArrowDown", "y", 32, 32, 240, "start")` | `48` |
| `resizeKeyValue("ArrowUp", "y", 48, 32, 240, "start")` | `32` |
| `resizeKeyValue("ArrowUp", "x", 352, 256, 960, "start")` | `null`(軸に無いキーは side に関係なく null) |
| `resizeKeyValue("Home", "x", 352, 256, 960, "start")` / `"End"` | `256` / `960`(side に関係なく同じ) |
| `resizeKeyValue("ArrowLeft", "x", 352, 256, 960, "end")` | `368`(明示 end は既定と同じ) |

### layout-storage(web/tests/layout-storage.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `saveLayoutSize("outlinerWidth", 300)` の後 `loadLayoutSize("outlinerWidth")` | `300`。`loadLayoutSize("panelWidth")` は `null` のまま |
| `saveLayoutSize("panelWidth", 400)` → `saveLayoutSize("outlinerWidth", 300)` | localStorage の JSON が `{ panelWidth: 400, outlinerWidth: 300 }` |

### ソース検査(web/tests/resize.test.ts に追加)

`web/tests/layout-styles.test.ts` の `readSource` の解決方法をそのまま真似る。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `features/layout/ResizeHandle.tsx` | `data-side={side}` を含む。`side?: ResizeSide` を含む |
| `features/layout/ResizeHandle.tsx` | `resizeDragValue(` と `resizeKeyValue(` の呼び出しに `side` が渡っている(正規表現 `/resizeDragValue\([\s\S]*?side,?\s*\)/` と `/resizeKeyValue\([\s\S]*?side,?\s*\)/` に一致) |
| `app/ReviewPage.tsx` / `features/timeline/PlaybackTimeline.tsx` | `side="start"` を含まない(このタスクでは既存利用者を変えない) |

## 実装メモ
- `side` の既定は `"end"`。既存 2 箇所の利用者(ReviewPage、PlaybackTimeline)は**触らない**。
  既定値で従来と同じ値が出ることを、既存の it が side 省略のまま通ることで担保する
- `layout.css` は変更しない。`data-side` は 096 で CSS の配置(left/right)を決めるための目印であり、
  本タスクでは属性を付けるだけ
- `.review-body` の grid や `--outliner-width` の導入は 096 の仕事。ここでは行わない

## やらないこと
- `ReviewPage.tsx` / `review.css` / `PlaybackTimeline.tsx` / `layout.css` の変更
- `layout-storage.ts` / `useLayoutSize.ts` / `useElementSize.ts` の変更(型の追加だけで動く)
- `web/tests/layout-styles.test.ts` の変更(096 が grid の期待値を更新する)
- アウトライナ本体(094〜096)の実装

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている(`side` と `reservedPx` は省略可能)
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存の it は変更せずに通る
- [ ] layout_Summary.md を更新している。具体的には resize.ts の公開インターフェイスに
      `OUTLINER_WIDTH_MIN_PX` / `OUTLINER_WIDTH_DEFAULT_PX` / `ResizeSide` / `outlinerWidthMax` を追加し、
      `ResizeHandle` の説明に `side`(既定 end)を足し、他機能との関係に「左ドック(outliner)は
      `useLayoutSize("outlinerWidth")` と `side="start"` を使う」旨を書く
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
