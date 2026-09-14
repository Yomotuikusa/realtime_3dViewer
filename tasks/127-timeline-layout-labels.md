---
id: 127
title: タイムラインの操作欄とスライダーを入れ替え、ドロップダウンに見えるラベルを付け、ブロック間隔を広げる
feature: timeline
depends_on: []
owns: [web/src/features/timeline/PlaybackTimeline.tsx, web/src/features/timeline/PlaybackSourceSelect.tsx, web/src/features/timeline/timeline-labels.ts, web/src/features/timeline/timeline.css, web/src/features/timeline/timeline_Summary.md, web/tests/timeline-styles.test.ts, web/tests/timeline-labels.test.ts, web/tests/playback-source-select.test.ts]
reads: [web/src/features/timeline/TimelineRuler.tsx, web/tests/resize.test.ts, web/tests/trail-bar.test.ts, web/src/styles/tokens.css]
verify: npm run typecheck && npm run test
status: done
---

## 目的
タイムラインの見やすさを改善する。操作ボタン群をスライダーの上に置き、再生対象オブジェクトと
アニメーションのドロップダウンに画面上で見えるラベルを付け、操作欄のブロック同士の間隔を広げて
どこまでが1つの塊か分かるようにする。

## 前提
- 現在の PlaybackTimeline.tsx の JSX 順は `<ResizeHandle>` → `<TimelineRuler>` → `<div className="timeline__controls">`
  (PlaybackTimeline.tsx:52-84)
- 現在のドロップダウンはラベル要素を持たず、`aria-label` / `title` のみ:
  - 再生対象: PlaybackSourceSelect.tsx:11-20 の `<select className="input timeline__source" ...>`(animated が 2 件未満なら null)
  - アニメーション: PlaybackTimeline.tsx:61-63 の `<select className="input timeline__clip" ...>`
- フレーム / fps はすでに `<label className="timeline__field"><span>{ラベル}</span>…</label>` の形(PlaybackTimeline.tsx:69-78)。
  `.timeline__field` は `display: inline-flex; gap: var(--space-1)`(timeline.css:79-85)
- `.timeline__controls` は `gap: var(--space-2)`(timeline.css:55-59)。トークンは `--space-5: 24px`(styles/tokens.css:16)
- 既存のソース検査(tests/timeline-styles.test.ts)は
  「`<ResizeHandle` が `<TimelineRuler` より前」「`<PlaybackSourceSelect send={send} />` が `timeline__clip` より前」
  「`.timeline__transport` に `margin-inline: auto`」を検査している。いずれも本変更後も成り立つ(維持する)
- tests/resize.test.ts:103-113 は PlaybackTimeline に `side="start"` が無いことを検査している。変更しない(ハンドルは上端のまま、side も付けない)
- tests/playback-source-select.test.ts:69 が aria-label `"再生オブジェクト"` を検査している(文言変更に合わせて直す)

## インターフェイス契約

```ts
// web/src/features/timeline/timeline-labels.ts(値だけ変更。他の定数は変更しない)
export const CLIP_LABEL = "アニメーション";
export const SOURCE_LABEL = "対象オブジェクト";
```

```tsx
// web/src/features/timeline/PlaybackSourceSelect.tsx(シグネチャ不変)
export function PlaybackSourceSelect({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement | null;
// animated が 2 件未満なら null(ラベルも描かない)。それ以外は次の構造:
<label className="timeline__field">
  <span>{SOURCE_LABEL}</span>
  <select className="input timeline__source" aria-label={SOURCE_LABEL} title={SOURCE_LABEL} value={sourceId ?? ""} onChange={...}>
    {/* option は従来どおり */}
  </select>
</label>

// web/src/features/timeline/PlaybackTimeline.tsx(シグネチャ不変)
// JSX 順を <ResizeHandle> → <div className="timeline__controls"> → <TimelineRuler> に変更する。
// .timeline__controls 内の順序は従来どおり: PlaybackSourceSelect → アニメーション → transport → フレーム → fps
// アニメーションの select を次の構造で包む(select の属性は従来どおり):
<label className="timeline__field">
  <span>{CLIP_LABEL}</span>
  <select className="input timeline__clip" aria-label={CLIP_LABEL} title={CLIP_LABEL} value={clipIndex} onChange={...}>…</select>
</label>
```

```css
/* web/src/features/timeline/timeline.css */
.timeline__controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}
/* .timeline__field の gap: var(--space-1) は変更しない。他のルールも変更しない */
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| ラベルテスト | `CLIP_LABEL === "アニメーション"`、`SOURCE_LABEL === "対象オブジェクト"`。他の定数の期待値は従来どおり |
| アニメーション付きが 0 件 / 1 件 | PlaybackSourceSelect の host に `label` も `select` も無い |
| v1(a.fbx), v2(b.glb)、sourceId "v1" | `label.timeline__field` が描かれ、その中の `span` のテキストが "対象オブジェクト"、その label 内に select があり aria-label "対象オブジェクト"、option [a.fbx, b.glb]、value "v1" |
| 上の状態で b.glb を選ぶ | 従来どおり send が `{ type: "playback:source", versionId: "v2" }` で 1 回呼ばれる(既存テストを維持) |
| ソース検査: PlaybackTimeline の縦順 | `<ResizeHandle` < `className="timeline__controls"` < `<TimelineRuler` の出現順 |
| ソース検査: アニメーションのラベル | PlaybackTimeline に `<span>{CLIP_LABEL}</span>` があり、その出現位置が `timeline__clip` より前、かつ `<PlaybackSourceSelect send={send} />` より後 |
| ソース検査: 既存の順序 | `<PlaybackSourceSelect send={send} />` が `timeline__clip` より前(既存検査を維持) |
| ソース検査: timeline.css | `.timeline__controls` に `gap: var(--space-5)`、`.timeline__field` に `gap: var(--space-1)` |

## やらないこと
- ReviewPage.tsx やレイアウト(review.css)の変更
- リサイズハンドルの位置・向き・`side` の変更(帯の上端のまま)
- TimelineRuler.tsx の変更
- 区切り線や背景色など、間隔以外の装飾の追加
- transport ボタンの中央寄せ(`margin-inline: auto`)の変更
- 再生対象切替・クリップ選択のロジック変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの構造・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] timeline_Summary.md が更新されている(操作欄がスライダーの上にあること、ドロップダウンの見えるラベル)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
