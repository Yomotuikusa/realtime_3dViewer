---
id: 125
title: タイムラインに再生対象オブジェクトの切替ドロップダウンを置く
feature: timeline
depends_on: [124]
owns: [web/src/features/timeline/PlaybackSourceSelect.tsx, web/src/features/timeline/PlaybackTimeline.tsx, web/src/features/timeline/timeline-labels.ts, web/src/features/timeline/timeline.css, web/src/features/timeline/timeline_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/tests/playback-source-select.test.ts, web/tests/timeline-styles.test.ts, web/tests/timeline-labels.test.ts]
reads: [web/src/features/viewer/usePlaybackSource.ts, web/src/features/viewer/playback-source-sync.ts, web/src/features/viewer/viewer_Summary.md, web/src/store/playback.ts, web/src/features/trail/model-clips.ts, web/src/store/objects.ts, web/tests/trail-bar.test.ts, web/tests/resize.test.ts, shared/src/protocol.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
アニメーションを持つオブジェクトが 2 つ以上読み込まれているとき、タイムラインのドロップダウンから
再生対象を切り替えられるようにする(切替はルーム共有)。

## 前提
- 124 で次が実装済み(web/src/features/viewer/):
  - `usePlaybackSource(): { sourceId: string | null; sourceClips; animated: readonly ModelVersion[] }`(animated は number 昇順)
  - `switchPlaybackSource(versionId: string, send: (msg: ClientMessage) => boolean): boolean`
    (表示ストア・playback ストアを同期更新し `playback:source` を送信する。既に対象なら送信しない)
- `PlaybackTimeline()` は現在 props を持たず、ReviewPage.tsx:210 で `<PlaybackTimeline />` と置かれている。
  ReviewPage では `realtime.send` を他部品へ `send={realtime.send}` で渡している
- 既存のソース検査 `tests/timeline-styles.test.ts:41` が `reviewPage.indexOf("<PlaybackTimeline />")` を使っているため、
  props 追加で壊れる(本タスクで `"<PlaybackTimeline send={realtime.send} />"` に直す)
- `tests/resize.test.ts:106-112` は PlaybackTimeline に `side="start"` が無いことを検査している(影響しない。変更しない)
- クリップ選択は `<select className="input timeline__clip" ...>`(PlaybackTimeline.tsx:61)。
  `.timeline__clip { max-width: 12rem; }`(timeline.css:91)
- 部品の実マウントテストの書き方は tests/trail-bar.test.ts を参照(createRoot + act、ストアへ直接登録)

## インターフェイス契約

```tsx
// web/src/features/timeline/timeline-labels.ts
export const SOURCE_LABEL = "再生オブジェクト";

// web/src/features/timeline/PlaybackSourceSelect.tsx
import type { ClientMessage } from "@shared/protocol";
/**
 * usePlaybackSource().animated が 2 件未満なら null。
 * それ以外は <select className="input timeline__source" aria-label={SOURCE_LABEL} title={SOURCE_LABEL} value={sourceId ?? ""}>
 * option は animated の順に value=version.id、表示テキスト=version.fileName。
 * onChange で switchPlaybackSource(event.target.value, send) を呼ぶ。
 */
export function PlaybackSourceSelect({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement | null;

// web/src/features/timeline/PlaybackTimeline.tsx
export function PlaybackTimeline({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement | null;
// .timeline__controls の先頭(クリップの <select> の直前)に <PlaybackSourceSelect send={send} /> を置く

// web/src/app/ReviewPage.tsx
// <PlaybackTimeline send={realtime.send} />
```

```css
/* web/src/features/timeline/timeline.css */
.timeline__source {
  max-width: 12rem;
}
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| アニメーション付きが 0 件 | PlaybackSourceSelect は何も描かない |
| アニメーション付きが 1 件(v1 clip, v2 空) | 何も描かない |
| v1(a.fbx, clip), v2(b.glb, clip)、sourceId "v1" | select が描かれ、option が [a.fbx, b.glb] の順、value "v1"、aria-label "再生オブジェクト" |
| 上の状態で b.glb を選ぶ | send が `{ type: "playback:source", versionId: "v2" }` で 1 回呼ばれ、playback ストアの sourceId と display.playbackSource が "v2" |
| 外部から sourceId が "v2" に変わる(ストア更新) | select の value が "v2" に追従 |
| v2 が unregister されて 1 件になる | select が消える |
| ラベルテスト | `SOURCE_LABEL === "再生オブジェクト"` |
| ソース検査: PlaybackTimeline | `<PlaybackSourceSelect send={send} />` が `timeline__clip` より前にある |
| ソース検査: ReviewPage | `<PlaybackTimeline send={realtime.send} />` を含む(timeline-styles.test.ts の配置検査もこの文字列に更新) |
| ソース検査: timeline.css | `.timeline__source` に `max-width: 12rem` |

## やらないこと
- 再生対象の解決ロジックや同期処理の変更(124 のファイルは reads のみ)
- 同名 fileName の区別表示(番号付与など)
- アニメーション付きが 1 件のときの表示(非表示のまま)
- コメント再現での切替(126)
- ObjectList(オブジェクト一覧)側への切替 UI の追加

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] timeline_Summary.md / app_Summary.md が更新されている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
