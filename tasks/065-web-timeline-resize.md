---
id: 065
title: web タイムライン上辺の境界をドラッグしてルーラー帯の高さを変えられるようにする(ResizeHandle を利用、localStorage 保存)
feature: web
depends_on: [064]
owns: [web/src/features/timeline/PlaybackTimeline.tsx, web/src/features/timeline/TimelineRuler.tsx, web/src/features/timeline/timeline-labels.ts, web/src/features/timeline/timeline.css, web/src/features/timeline/timeline_Summary.md, web/tests/timeline-styles.test.ts, web/tests/timeline-labels.test.ts]
reads: [web/src/features/layout/resize.ts, web/src/features/layout/layout-storage.ts, web/src/features/layout/useLayoutSize.ts, web/src/features/layout/useElementSize.ts, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/layout.css, web/src/features/layout/layout_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/features/timeline/timeline.ts, web/src/features/viewer/viewer.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
3D ビュー直下のタイムライン帯は、ルーラー(目盛り + 再生ヘッド)の高さが 32px 固定である。
タイムラインの上辺(ビューとの境界)をつかんでドラッグし、ルーラー帯の高さを 32〜240px で変えられるようにする。
伸びるのはルーラー帯だけで、操作ボタン行(クリップ・再生操作・フレーム・fps)の高さは変えない。
高さは localStorage に保存し、ダブルクリックで既定(32px)に戻す。
タスク 064 で作った `features/layout/` の部品(`ResizeHandle`、`useLayoutSize`、`useElementSize`、`clampSize`、
`LAYOUT_SIZE_SPECS.timelineHeight`)を使い、**layout/ のファイルは変更しない**。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### タスク 064 で用意されているもの(reads: の layout/ 参照)
- `LAYOUT_SIZE_SPECS.timelineHeight` は `{ min: 32, max: 240, defaultValue: 32 }`。
  `TIMELINE_TRACK_MIN_PX` / `TIMELINE_TRACK_MAX_PX` / `TIMELINE_TRACK_DEFAULT_PX` も同じ値で公開されている。
  web/src/features/layout/resize.ts
- `useLayoutSize("timelineHeight")` は `[value, setValue]` を返し、初期値は localStorage(キー `3dreviewer:layout`)の
  保存値、無ければ 32。`setValue` は保存も行う。丸めはしないので呼び出し側で `clampSize` する
- `useElementSize(ref)` は `{ width, height }` を ResizeObserver で追従する(測定前は 0、jsdom ガード済み)
- `ResizeHandle` の props は `{ axis, value, min, max, defaultValue, label, className?, onChange }`。
  `axis="y"` のとき `role="separator"` `aria-orientation="horizontal"` の高さ 8px の要素を描き、
  ポインタが**上**へ動くほど値が増える。`position: absolute; left: 0; right: 0; z-index: 1; cursor: row-resize` は
  `layout.css` の `.resize-handle[data-axis="y"]` が持ち、**上下のオフセットは呼び出し側の CSS が決める**
  (064 では `.review-body__resize { right: calc(var(--panel-width) - 4px) }` と書いている。同じ要領で
  `.timeline__resize { top: -4px }` を書く)
- ハンドルのダブルクリックは `onChange(defaultValue)` を呼ぶ。矢印キー(↑↓)・Home・End にも対応済み

### タイムラインの現状
- `PlaybackTimeline` は `<div className="timeline" role="region">` の中に `<TimelineRuler …/>` と
  `<div className="timeline__controls">` を描く。クリップが無ければ null。web/src/features/timeline/PlaybackTimeline.tsx:22-62
- `TimelineRuler` は `trackRef` の幅だけを ResizeObserver で測り(:14-30)、SVG の `viewBox` を
  `"0 0 " + width + " " + RULER_HEIGHT_PX` にしている(:78)。目盛り線の y は `RULER_HEIGHT_PX - 6` / `- 12`(:80, :84)、
  ラベルは `y={12}`(:85)、再生ヘッドの縦線は `height={RULER_HEIGHT_PX}`(:90)。`RULER_HEIGHT_PX = 32` を export(:5)
- `.timeline` は `display: grid; gap; padding; border-top`(timeline.css:1-8)。`position` は未指定。
  `.timeline__track` は `height: 32px; touch-action: none`(timeline.css:10-19)
- `.review-viewer` は `position: relative; overflow: hidden; grid-template-rows: minmax(0, 1fr) auto`
  (web/src/app/review.css:84-92)で、タイムラインは 2 行目。上の `.review-stage` は `overflow: hidden`(:94-98)、
  その中の `.review-hud` は `z-index: 1`(:100-111)。`.review-stage` も `.review-viewer` も stacking context を
  作らないので、`.timeline` の中に置いた `z-index: 1` のハンドルは DOM 順で後にある分 HUD より上に描かれ、
  `top: -4px` のはみ出しは `.review-stage` には属さないので切れない
- HUD の操作ヒント `.hud-hint` は `bottom: var(--space-3)`(= 12px)なので、4px の重なりでは当たらない
- `web/tests/timeline-styles.test.ts` は `RULER_HEIGHT_PX` を import し(:7)、`.timeline__track` の宣言に
  `"height: " + RULER_HEIGHT_PX + "px"` が含まれることを検査する(:55)。**この行はこのタスクで書き換える**。
  同ファイル :34-43 の「`review-stage` → `review-hud` → `<PlaybackTimeline />` → `<JoinDialog` の順」は維持する
- `web/tests/timeline-labels.test.ts` はラベル定数を検査している。新ラベルの行を足す
- `web/tests/styles-rules.test.ts`: `var(--x)` は tokens.css の宣言かフォールバックが必要。
  新しい `--timeline-track-height` は tokens.css に**足さない**ので、参照側にフォールバックを書く
- 現在の行数: PlaybackTimeline.tsx 62、TimelineRuler.tsx 96、timeline.css 88、timeline-labels.ts 19、timeline_Summary.md 38

## インターフェイス契約

### 変更 web/src/features/timeline/timeline-labels.ts

```ts
export const TIMELINE_RESIZE_LABEL = "タイムラインの高さ";
```

### 変更 web/src/features/timeline/TimelineRuler.tsx

```ts
/** ルーラー帯の既定(最小)の高さ。CSS のフォールバックと LAYOUT_SIZE_SPECS.timelineHeight.defaultValue に一致する */
export const RULER_HEIGHT_PX = 32;

export interface TimelineRulerProps {   // 変更なし
  frame: number;
  lastFrame: number;
  onSeek(frame: number): void;
}
export function TimelineRuler(props: TimelineRulerProps): ReactElement;
```

- 幅の測定を `useElementSize(trackRef)` に置き換え、**高さも**その戻り値から取る(自前の ResizeObserver は消す)
- SVG は `width > 0 && height > 0` のときだけ描き、`viewBox` を `"0 0 " + width + " " + height` にする
- 目盛り線の y は `height - 6` / `height - 12`、再生ヘッドの縦線は `height={height}`。ラベルの `y={12}` は変えない
  (目盛りは下辺基準、数字は上辺基準のまま、帯が伸びた分だけ縦線が長くなる)
- pointer / key によるシークの処理は変えない

### 変更 web/src/features/timeline/PlaybackTimeline.tsx

- `const [trackHeight, setTrackHeight] = useLayoutSize("timelineHeight")`(フックは早期 return より前)
- `effective = clampSize(trackHeight, TIMELINE_TRACK_MIN_PX, TIMELINE_TRACK_MAX_PX)`
- `.timeline` に `style={{ "--timeline-track-height": effective + "px" } as CSSProperties}` を付ける
- `.timeline` の**先頭の子**として
  `<ResizeHandle axis="y" className="timeline__resize" value={effective} min={TIMELINE_TRACK_MIN_PX} max={TIMELINE_TRACK_MAX_PX} defaultValue={TIMELINE_TRACK_DEFAULT_PX} label={TIMELINE_RESIZE_LABEL} onChange={setTrackHeight} />`
  を置く。その後ろは現状どおり `<TimelineRuler …/>`、`.timeline__controls`

### 変更 web/src/features/timeline/timeline.css

- `.timeline` に `position: relative;` を足す
- `.timeline__track` の `height: 32px` を `height: var(--timeline-track-height, 32px);` に変える
- 追加: `.timeline__resize { top: -4px; }`

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `TIMELINE_RESIZE_LABEL` | `"タイムラインの高さ"`(timeline-labels.test.ts) |
| `RULER_HEIGHT_PX` | 32 のまま。`LAYOUT_SIZE_SPECS.timelineHeight.defaultValue` と等しい(timeline-styles.test.ts で両方 import して比較) |
| CSS `.timeline__track`(timeline-styles.test.ts) | `height: var(--timeline-track-height, ` + RULER_HEIGHT_PX + `px)` と `touch-action: none` を含む |
| CSS `.timeline` / `.timeline__resize`(timeline-styles.test.ts) | `.timeline` が `position: relative` を含む。`.timeline__resize` が `top: -4px` を含む |
| ソース PlaybackTimeline.tsx(timeline-styles.test.ts) | `<ResizeHandle` と `axis="y"` と `"--timeline-track-height"` を含み、`<ResizeHandle` の出現位置が `<TimelineRuler` より前 |
| ソース TimelineRuler.tsx(timeline-styles.test.ts) | `useElementSize` を含み、`new ResizeObserver` を含まない。`viewBox` の文字列に `RULER_HEIGHT_PX` を使っていない(`"0 0 " + width + " " + height`) |
| ソース ReviewPage.tsx(timeline-styles.test.ts、既存) | `review-stage` → `review-hud` → `<PlaybackTimeline />` → `<JoinDialog` の順(変更なし) |
| 画面(手動確認) | クリップのあるモデルで、タイムライン上辺にカーソルを置くと `row-resize` になり、上へドラッグするとルーラー帯が伸びて 3D ビューが縮む。再生ヘッドの縦線は帯の高さいっぱいに伸び、目盛りは下辺、数字は上辺に留まる。240px で止まる。ダブルクリックで 32px に戻る。再読み込み後も高さが保たれる。クリップの無いモデルではハンドルも出ない |

## やらないこと
- `features/layout/` 配下の変更(範囲や既定値の変更が必要なら申し送りに書く)
- `tokens.css` に `--timeline-track-height` を足すこと(フォールバックで済ませる)
- 操作ボタン行の高さやレイアウトの変更、ルーラーの目盛り間隔ロジック(`timeline.ts`)の変更
- TimelineRuler / PlaybackTimeline のコンポーネントテスト(jsdom に ResizeObserver が無い)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行(手動確認の行を除く)に対応するテストがあり、通る
- [ ] timeline_Summary.md が更新されている(ファイル一覧・公開インターフェイス・他機能との関係に layout/ への依存を追記)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
