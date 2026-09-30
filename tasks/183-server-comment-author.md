---
id: 183
title: コメント投稿時に投稿者の user id を comments.author_id に記録する
feature: server
depends_on: [182]
owns: [server/src/db/schema.sql, server/src/db/connection.ts, server/src/db/comments.ts, server/src/routes/comments.ts, server/server_Summary.md, server/tests/comment-author.test.ts]
reads: [server/src/identity/session.ts, server/src/app.ts, server/tests/helpers/app.ts, server/tests/db-migrate.test.ts, server/tests/db-comments.test.ts, server/tests/routes-comments.test.ts, server/tests/routes-project-identity.test.ts, shared/src/types.ts, shared/src/api.ts]
verify: npm run typecheck && npm run test
status: todo
---

## 目的
アカウント機能(184〜)の前段として、コメントを「誰が書いたか」を、表示名の文字列ではなく固有の user id で
記録する。将来の「自分のコメントだけ編集・削除できる」の土台であり、185 で匿名ユーザーをアカウントへ
統合するときに付け替える対象にもなる。今回は記録だけで、API の応答には出さない。

## 前提
- `migrate` は schema.sql を丸ごと実行した後に `addColumnIfMissing` で不足列を足す(`server/src/db/connection.ts`)。
  後から足す列は、**schema.sql の CREATE 文と `addColumnIfMissing` の両方**に書く(`playback_json` と同じ流儀)。
  schema.sql は旧定義の DB に対しても最初に実行されるので、**新しい列を参照する INDEX を schema.sql に書いてはならない**
- SQLite は `ALTER TABLE ... ADD COLUMN x TEXT REFERENCES users(id)` を、既定値が NULL なら `foreign_keys = ON` でも許す
- 182 で `identityDepsFrom(deps)` が `server/src/identity/session.ts` にある。
  `ensureUser(c, identityDepsFrom(deps))` で、Cookie からユーザーを解決・作成し user id を返す。
  `withTransaction` の内側で呼んではならない
- `ensureUser` は `deps.newUserId` / `deps.newSessionToken` を使い、`deps.newId` は消費しない。
  **コメント id は従来どおり `deps.newId()` から採る**(テストの `t.ids` の順序に依存するテストがある)
- `Comment` 型と `CommentSchema` は `shared/src/types.ts`(285 行で上限に近い)にある。
  既存テストは `Comment` を `toEqual` で比較しているので、**`Comment` 型と応答にキーを足してはならない**
- `server/tests/routes-project-identity.test.ts:142-159` は、**`GET .../comments`** で Set-Cookie が出ないことを検査している。
  POST と PATCH は検査していない
- `server/tests/db-migrate.test.ts:100-110` の列数検査は、実行前後の差分で比べているので、列を足しても落ちない

## インターフェイス契約

### `server/src/db/schema.sql`
comments の CREATE 文の末尾(`updated_at` の後)に `author_id TEXT REFERENCES users(id)` を足す。ほかは変えない。

### `server/src/db/connection.ts`
`migrate` に `addColumnIfMissing(db, "comments", "author_id", "TEXT REFERENCES users(id)")` を足す。

### `server/src/db/comments.ts`

```ts
export interface NewComment {
  // ...既存のまま...
  /** 投稿者の users.id。省略・null は NULL として保存する */
  authorId?: string | null;
}
```
`insertComment` は author_id を保存する。`toComment` と SELECT 文は変えず、`Comment` に authorId を出さない。

### `server/src/routes/comments.ts`
`POST /` の処理順を次にする。
1. project が無ければ 404
2. `CreateCommentInput.parse`(400)
3. version が無ければ 404
4. `ensureUser(c, identityDepsFrom(deps))`
5. `insertComment({ ..., authorId: userId })`

`GET /` と `PATCH /:commentId` では `ensureUser` を呼ばない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| Cookie なしで正しい `POST /api/projects/p1/comments` | 201。Set-Cookie に `rv_session=` がある。users は 1 行、そのコメントの `author_id` はその user の id |
| 上の Cookie を付けて、もう一度 POST | 201。Set-Cookie なし。2 件目の `author_id` も同じ user |
| POST の応答本文 | 従来と同じキーだけ(`authorId` キーが無い) |
| `t.ids = ["c1"]` で Cookie なしの POST | コメント id は `c1`(識別が newId を消費しない) |
| 存在しない project に POST | 404。users は 0 行、Set-Cookie なし |
| 本文不正(`body` 欠落)で POST | 400 `VALIDATION`。users は 0 行、Set-Cookie なし |
| 存在しない versionId で POST | 404。users は 0 行、Set-Cookie なし |
| Cookie なしで `PATCH .../comments/:id` の status 更新 | Set-Cookie なし。`author_id` は変わらない |
| `insertComment` を authorId なしで呼ぶ | author_id は NULL。戻り値の `Comment` は従来どおり |
| comments に存在しない user id を author_id として入れる | 外部キー違反で例外 |
| 旧定義(author_id なし)の comments を持つ DB に `migrate` | nullable な author_id が足され、既存行は NULL。2 回 `migrate` しても例外にならない |

旧 DB のテストは、`db-migrate.test.ts` の `legacyDb` の作り方を読んで、新規ファイルの中に同等のものを作る。

## やらないこと
- `Comment` 型・`CommentSchema`・`shared/` の変更、応答への authorId の追加
- コメントの編集・削除の権限検査
- web の変更
- 既存テストファイルと `tests/helpers/app.ts` の変更(新しいテストは `server/tests/comment-author.test.ts` に書く)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] 既存の server テストが変更なしで通る
- [ ] server/server_Summary.md の schema・comments の記述に author_id を反映している(追記は 5 行以内)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
