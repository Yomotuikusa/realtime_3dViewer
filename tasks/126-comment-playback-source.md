---
id: 126
title: コメントの再生位置に再生対象オブジェクトを記録し、再現時に切り替える
feature: comments
depends_on: [125]
owns: [shared/src/types.ts, shared/shared_Summary.md, shared/tests/comment-playback.test.ts, web/src/features/comments/compose.ts, web/src/features/comments/replay.ts, web/src/features/comments/useCommentReplay.ts, web/src/features/comments/comments_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/tests/compose.test.ts, web/tests/comment-replay.test.ts]
reads: [web/src/features/viewer/playback-source-sync.ts, web/src/features/viewer/playback-source.ts, web/src/store/playback.ts, web/src/features/comments/CommentComposer.tsx, web/src/features/trail/model-clips.ts, web/src/store/objects.ts, server/src/db/comments.ts, shared/src/api.ts, shared/src/protocol.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
再生対象を切り替えられるようになった(124/125)ため、コメントの `clipIndex` / `frame` だけでは
どのオブジェクトのクリップか分からない。投稿時に再生対象の versionId を記録し、
コメントを開いたときにそのオブジェクトへ切り替えてからフレームを再現する。

## 前提
- `CommentPlayback` は `{ clipIndex: number; frame: number }`(shared/src/types.ts:21-27)。
  `CommentPlaybackSchema`(types.ts:191-194)は余分なキーを取り除く。
  `IdSchema`(types.ts:141)が export 済み
- サーバーは `playback` を JSON のまま保存・返却する(server/src/db/comments.ts:50-52,87)。API の入力検証は
  shared/src/api.ts で `CommentPlaybackSchema` を使う。server のコード変更は不要
- 124 で playback ストアに `sourceId: string | null` が追加済み。
  `switchPlaybackSource(versionId, send): boolean` は、アニメーション付きでない版に対しては false を返して何もしない。
  切替時は playback ストアを同期で更新する(直後の selectClip / seekFrame は上書きされない)
- `commentPlaybackOf(playback, recordFrame)` は CommentComposer.tsx:66 から
  `usePlaybackStore.getState()` を丸ごと渡して呼ばれる。ストアに sourceId があるので、CommentComposer.tsx は変更不要
- `applyCommentPlayback` / `applyCommentReplay` は replay.ts。`useCommentReplay()` は ReviewPage.tsx:88 で引数なしで呼ばれている。
  125 で ReviewPage は `<PlaybackTimeline send={realtime.send} />` に変更済み
- `tests/comments-styles.test.ts:169` は CommentComposer に `commentPlaybackOf` が含まれることだけを検査している(影響しない)

## インターフェイス契約

```ts
// shared/src/types.ts
export interface CommentPlayback {
  clipIndex: number;
  frame: number;
  /** 投稿時に再生していたオブジェクトの versionId。省略は記録なし(古いデータ) */
  versionId?: string;
}
export const CommentPlaybackSchema = z.object({
  clipIndex: z.number().int().min(0),
  frame: z.number().int().min(0),
  versionId: IdSchema.optional(),
}) satisfies z.ZodType<CommentPlayback>;
```

```ts
// web/src/features/comments/compose.ts
/** スイッチ OFF またはクリップ無しなら null。sourceId が null でなければ versionId を含める */
export function commentPlaybackOf(
  playback: { clips: readonly PlaybackClip[]; clipIndex: number; time: number; fps: number; sourceId: string | null },
  recordFrame: boolean,
): CommentPlayback | null;

// web/src/features/comments/replay.ts
/**
 * playback が null / undefined なら false。
 * playback.versionId があれば switchPlaybackSource(versionId, send) を先に呼び、false なら何もせず false。
 * その後は既存どおり clipIndex の範囲検査 → pause → selectClip → seekFrame → true。
 */
export function applyCommentPlayback(
  playback: CommentPlayback | null | undefined,
  send: (msg: ClientMessage) => boolean,
): boolean;
export function applyCommentReplay(comment: Comment | null, send: (msg: ClientMessage) => boolean): void;

// web/src/features/comments/useCommentReplay.ts
export function useCommentReplay(send: (msg: ClientMessage) => boolean): void;
// effect の依存は既存の [selectedId] のまま。send は ref で最新値を参照する

// web/src/app/ReviewPage.tsx
// useCommentReplay(realtime.send);
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| schema: `{ clipIndex: 0, frame: 0, versionId: "v1" }` | 成功し、versionId が保たれる |
| schema: versionId 無し | 成功(versionId は undefined) |
| schema: versionId が空文字 / `"a b"` | 失敗 |
| schema: 余分なキー `extra` | 取り除かれる(既存テストを維持) |
| commentPlaybackOf: sourceId "v2", clips 1 件, time 0.5, fps 24, ON | `{ clipIndex: 0, frame: 12, versionId: "v2" }` |
| commentPlaybackOf: sourceId null, clips 1 件, ON | `{ clipIndex: 0, frame: 12 }`(versionId キー無し) |
| commentPlaybackOf: OFF / clips 空 | null(既存どおり) |
| applyCommentPlayback: versionId 無し | 既存の挙動どおり(switch も send も呼ばない) |
| applyCommentPlayback: versionId "v2"(アニメ付き)、現 sourceId "v1"、clipIndex 1, frame 24 | send `{ type: "playback:source", versionId: "v2" }` が 1 回。sourceId "v2"、clipIndex 1、フレーム 24、playing false、戻り値 true |
| applyCommentPlayback: versionId が現 sourceId と同じ | send されない。clipIndex / frame を反映し true |
| applyCommentPlayback: versionId "v9"(未読み込み / クリップ無し) | false。playback ストアも send も変化なし |
| applyCommentPlayback: versionId "v2" に切替後、clipIndex が v2 のクリップ数以上 | false(切替は済んだまま) |
| applyCommentReplay(null, send) | 既存どおり replay 線を消すだけ。send されない |

- replay テストでは model-clips ストアと objects ストアへ直接登録して、アニメーション付きの版を用意する。
  各テストの前に両ストアを reset する

## やらないこと
- server のコード変更(JSON 保存のため不要)
- CommentComposer.tsx の変更
- コメント一覧での再生対象名の表示
- versionId の無い古いコメントを、現在の再生対象に合わせて補正すること
- 124 / 125 のファイルの変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md / comments_Summary.md / app_Summary.md が更新されている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
