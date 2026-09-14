---
id: 082
title: shared コメントに再生位置(クリップ添字とフレーム)を持たせる型とスキーマを追加する
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/api.ts, shared/tests/comment-playback.test.ts, shared/shared_Summary.md]
reads: [shared/src/protocol.ts, shared/tests/types.test.ts, shared/tests/api.test.ts, shared/tests/protocol.test.ts]
verify: npm run typecheck && npm run test:shared
status: done
---

## 目的
コメント投稿時のタイムライン位置(どのクリップの何フレーム目か)をコメントに保存し、
選択時にその位置へ戻れるようにする。その共有型と zod スキーマを shared に追加する。
server の保存(task 083)と web の記録・ジャンプ(task 084)はこの契約に従う。

## 前提
- `Comment` interface と `CommentSchema` は shared/src/types.ts:21-32, 154-166 にあり、
  `satisfies z.ZodType<Comment>` で型整合を検証している。zod は 4.5.4 で、
  `z.ZodType<Output>` は出力型だけを拘束する
- `CreateCommentInput` は shared/src/api.ts:40-48 の zod オブジェクトと `z.infer` の型
- `npm run typecheck` は shared / server / web の 3 つを続けて型検査する(workspace/package.json:10)。
  server と web のテストは `Comment` 型のフィクスチャを多数持っており(例:
  web/tests/store-comments.test.ts、server/tests/helpers/app.ts)、`Comment` に **必須** の
  フィールドを足すとそれらの typecheck が壊れる。本タスクは shared 以外を変更しないので、
  **新フィールドは省略可能(`?:`)** にする。省略は `null`(未登録)と同義とする
- `shared/tests/types.test.ts` は 266 行で上限(300 行)に近い。本タスクのテストは
  **新規ファイル** `shared/tests/comment-playback.test.ts` に書き、types.test.ts / api.test.ts /
  protocol.test.ts は変更しない(既存フィクスチャは `playback` を持たないまま通ること自体が
  「省略可能」の検証になる)
- `shared/src/index.ts` は `export * from "./types"` / `"./api"` なので、types.ts / api.ts に
  export を足せば公開面に含まれる。index.ts の変更は不要

## インターフェイス契約

### shared/src/types.ts

`CommentStatus` の直後に追加:

```ts
/** コメント投稿時のタイムライン位置。クリップの無いモデルでは記録しない */
export interface CommentPlayback {
  /** playback ストアの clips の添字。0 以上の整数 */
  clipIndex: number;
  /** 表示フレーム(fps 換算後の整数)。0 以上 */
  frame: number;
}
```

`Comment` に 1 フィールド追加(`status` の直前に置く。他のフィールドは変更しない):

```ts
export interface Comment {
  // ...既存フィールド...
  strokes: Stroke[];
  /** 投稿時の再生位置。未登録は null。省略は null と同義(古い保存データ) */
  playback?: CommentPlayback | null;
  status: CommentStatus;
  // ...
}
```

`CommentStatusSchema` の直後に追加:

```ts
export const CommentPlaybackSchema = z.object({
  clipIndex: z.number().int().min(0),
  frame: z.number().int().min(0),
}) satisfies z.ZodType<CommentPlayback>;
```

`CommentSchema` に 1 行追加(`status` の直前):

```ts
  playback: CommentPlaybackSchema.nullable().optional(),
```

### shared/src/api.ts

`CreateCommentInput` に 1 行追加(`strokes` の直後):

```ts
  playback: CommentPlaybackSchema.nullable().optional(),
```

`CommentPlaybackSchema` は `"./types"` から import する(既存の import 文に追加する)。
`UpdateCommentStatusInput` / `ListCommentsQuery` は変更しない。

## 振る舞い

### shared/tests/comment-playback.test.ts(新規)
`CommentPlaybackSchema`、`CommentSchema`、`CreateCommentInput`、`parseServerMessage` を対象にする。
フィクスチャは shared/tests/types.test.ts:118-130 の `comment` と同じ形を自前で定義する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `CommentPlaybackSchema.safeParse({ clipIndex: 0, frame: 0 })` | success |
| `{ clipIndex: 2, frame: 120 }` | success、parse 結果は入力と `toEqual` |
| `{ clipIndex: -1, frame: 0 }` | 失敗 |
| `{ clipIndex: 0, frame: -1 }` | 失敗 |
| `{ clipIndex: 0.5, frame: 0 }` / `{ clipIndex: 0, frame: 1.5 }` | 失敗(整数のみ) |
| `{ clipIndex: 0 }`(frame 欠落) / `{ frame: 0 }`(clipIndex 欠落) | 失敗 |
| `{ clipIndex: 0, frame: 0, extra: 1 }` | success、parse 結果に `extra` は残らない |
| `CommentSchema` に `playback` を持たないコメント | success、parse 結果に `playback` キーが無い(`"playback" in result` が false) |
| `CommentSchema` に `playback: null` | success、parse 結果の `playback` は `null` |
| `CommentSchema` に `playback: { clipIndex: 1, frame: 30 }` | success、parse 結果の `playback` が入力と `toEqual` |
| `CommentSchema` に `playback: { clipIndex: -1, frame: 30 }` | 失敗 |
| `CreateCommentInput` に `playback` 無し / `null` / `{ clipIndex: 0, frame: 10 }` | いずれも success |
| `CreateCommentInput` に `playback: { clipIndex: 0, frame: "10" }` | 失敗 |
| `parseServerMessage(JSON.stringify({ type: "comment:created", comment: {...playback: { clipIndex: 0, frame: 5 } } }))` | ok で、`comment.playback` が `{ clipIndex: 0, frame: 5 }`(protocol の CommentSchema 経由で受理される) |
| 型レベル | `const c: Comment = { ...playback 無し }` と `{ ...playback: null }` と `{ ...playback: { clipIndex: 0, frame: 0 } }` の 3 つが typecheck を通る(テスト内に変数宣言として置く) |

### 既存テストへの影響(落ちてはならない)

| 状況 | 期待する結果 |
| --- | --- |
| shared/tests/types.test.ts、api.test.ts、protocol.test.ts、index.test.ts | 変更なしで通る |
| server / web の typecheck | `Comment` / `CreateCommentInput` に必須フィールドを足していないので通る |

## やらないこと
- server の DB 列・保存(task 083)、web の記録・ジャンプ・表示(task 084 / 085)
- `Comment.playback` を必須にすること、server / web のフィクスチャの更新
- `MAX_*` 定数の追加(フレーム上限は設けない)
- protocol.ts の変更(`CommentSchema` を参照しているので自動で追随する)
- クリップ名や秒数の保存(クリップ添字とフレームだけを持つ)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・スキーマで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md の types.ts / api.ts の説明・公開インターフェイス(型に `CommentPlayback`、
      スキーマに `CommentPlaybackSchema`)・テスト一覧(comment-playback.test.ts)を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
