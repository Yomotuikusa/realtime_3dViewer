---
id: 083
title: server コメントの再生位置を playback_json 列に保存し、既存 DB へ列を追加する移行を入れる
feature: server
depends_on: [082]
owns: [server/src/db/schema.sql, server/src/db/connection.ts, server/src/db/comments.ts, server/tests/helpers/app.ts, server/tests/db-comments.test.ts, server/tests/db-migrate.test.ts, server/tests/routes-comments.test.ts, server/tests/routes-comments-playback.test.ts, server/server_Summary.md]
reads: [shared/src/types.ts, shared/src/api.ts, server/src/routes/comments.ts, server/src/app.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
task 082 で shared に追加した `Comment.playback`(`CommentPlayback | null`、省略可)を SQLite に
永続化し、REST の投稿で受け取って一覧・投稿応答・WS 配信に載せる。
運用中の `data/app.db` が既に存在するため、`CREATE TABLE IF NOT EXISTS` だけでは列が増えない。
既存 DB に列を後付けする移行を `migrate()` に入れる。

## 前提
- `CommentPlayback` は `{ clipIndex: number; frame: number }`、`Comment.playback?: CommentPlayback | null`、
  `CreateCommentInput.playback` は `.nullable().optional()`(shared/src/types.ts、shared/src/api.ts。task 082)
- `migrate(db)` は schema.sql を読んで `db.exec` するだけ(server/src/db/connection.ts:17-21)。
  schema.sql は `CREATE TABLE IF NOT EXISTS comments (...)` で、既存テーブルには何もしない
- SQLite は `PRAGMA table_info(comments)` で列の一覧(`name` を含む行)を返し、
  `ALTER TABLE comments ADD COLUMN playback_json TEXT` で NULL 可の列を後付けできる
- `insertComment(db, input: NewComment)` は INSERT 後に `selectComment` で読み直して返す。
  `toComment(row)` が行 → `Comment` の唯一の変換点(server/src/db/comments.ts:35-48)。
  `listComments` / `selectComment` の SELECT 列は明示列挙なので、新列を **両方の SELECT に足す**
- `routes/comments.ts` の POST は `insertComment(deps.db, { id, projectId, ...input, createdAt })`
  と入力をスプレッドするので、`NewComment` に `playback` を足せばルートの変更は不要。
  応答と `publish` は `insertComment` の戻り値をそのまま使う(server/src/routes/comments.ts:39-53)
- `tests/helpers/app.ts` の `seedComment(t, opts)` は `insertComment` を呼ぶフィクスチャで、
  routes テストが使う(server/tests/helpers/app.ts:86-124)
- `makeTestApp()` は `openDb(":memory:")` 相当のインメモリ DB を使う。
  db テストの `makeDb()` も同様(server/tests/db-comments.test.ts:19-23)

## インターフェイス契約

### server/src/db/schema.sql
`comments` の `CREATE TABLE` に列を 1 つ追加する(`strokes_json` の直後。NULL 可、既定 NULL):

```sql
  strokes_json TEXT NOT NULL,
  playback_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('open','resolved')),
```

### server/src/db/connection.ts

```ts
/** 既存 DB に後から増えた列を、無ければ ALTER TABLE で追加する。あれば何もしない。 */
export function addColumnIfMissing(db: Db, table: string, column: string, definition: string): void;

/** Apply the idempotent schema bundled with this module, then the column migrations. */
export function migrate(db: Db): void;
// 実装: 既存どおり schema.sql を exec した後に
//   addColumnIfMissing(db, "comments", "playback_json", "TEXT");
```

`addColumnIfMissing` は `PRAGMA table_info(<table>)` の結果に `column` と同名の行があれば何もせず、
無ければ `ALTER TABLE <table> ADD COLUMN <column> <definition>` を実行する。`table` / `column` /
`definition` は呼び出し側が固定文字列で渡す前提とし、値のエスケープは行わない。

### server/src/db/comments.ts

```ts
import type { CameraState, Comment, CommentPlayback, CommentStatus, Stroke, Vec3 } from "@shared/types";

export interface NewComment {
  // ...既存フィールド...
  strokes: Stroke[];
  /** 未指定・null は NULL として保存する */
  playback?: CommentPlayback | null;
  createdAt: number;
}

interface CommentRow {
  // ...既存...
  strokes_json: string;
  playback_json: string | null;
  // ...
}
```

- `toComment(row)`: `playback: row.playback_json === null ? null : (JSON.parse(row.playback_json) as CommentPlayback)`。
  **常に `playback` キーを持つ `Comment` を返す**(省略しない)
- `insertComment`: INSERT 列に `playback_json` を追加し、値は
  `input.playback == null ? null : JSON.stringify(input.playback)`
- `selectComment` / `listComments`: SELECT 列に `playback_json` を追加
- `updateCommentStatus`: 変更なし(`selectComment` 経由で `playback` が載る)

### server/tests/helpers/app.ts
`seedComment` の `opts` に `playback?: CommentPlayback | null` を追加し、そのまま `insertComment` へ渡す。
省略時は渡さない(= NULL)。

## 振る舞い

### server/tests/db-migrate.test.ts(新規)
`openDb(":memory:")` ではなく `new DatabaseSync(":memory:")` を直接開き、**`playback_json` を含まない旧定義**
の `comments` テーブル(schema.sql:17-29 の列から `playback_json` を除いたもの)と、外部キーに必要な
`projects` / `model_versions` を手で `CREATE TABLE` してから `migrate(db)` を呼ぶ。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 旧定義の DB に `migrate(db)` | `PRAGMA table_info(comments)` に `playback_json` 行があり、`notnull` が 0 |
| 旧定義の DB に旧行(playback_json 無し)を INSERT してから `migrate` → `listComments` | その行の `playback` が `null` |
| 移行済み DB に再度 `migrate(db)` | 例外なく終わり、列は 1 つのまま(`table_info` で `playback_json` が 1 行) |
| 新規 DB に `openDb(":memory:")` | `playback_json` 列がある(schema.sql 側の定義でも増えている) |
| `addColumnIfMissing(db, "comments", "playback_json", "TEXT")` を既存列に対して呼ぶ | 何もしない(列数が変わらない) |
| `addColumnIfMissing(db, "comments", "extra_col", "INTEGER")` | `extra_col` 列が増える |

### server/tests/db-comments.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `insertComment` に `playback: { clipIndex: 1, frame: 48 }` | 戻り値と `listComments` の該当行の `playback` が `{ clipIndex: 1, frame: 48 }` |
| `playback` を省略 | `playback` が `null`(`undefined` ではない) |
| `playback: null` | `playback` が `null` |
| `updateCommentStatus` で resolved にする | `playback` は保存値のまま |
| 既存の round-trip テスト | `playback: null` を含めた形で `toEqual` が通るよう期待値を更新する |

### server/tests/routes-comments.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| POST に `playback: { clipIndex: 0, frame: 12 }` | 201、応答の `playback` が同値、`publish` された `comment:created` の `comment.playback` も同値、GET 一覧にも載る |
| POST に `playback` 無し | 201、応答の `playback` が `null` |
| POST に `playback: null` | 201、応答の `playback` が `null` |
| POST に `playback: { clipIndex: -1, frame: 0 }` | 400 `VALIDATION`、保存も publish もされない |
| POST に `playback: { clipIndex: 0, frame: 1.5 }` | 400 `VALIDATION` |
| `seedComment(t, { ..., playback: { clipIndex: 2, frame: 3 } })` → GET 一覧 | 該当コメントの `playback` が `{ clipIndex: 2, frame: 3 }` |
| 既存 "seeds documented defaults" テスト | 既定で `playback` が `null` であることを追加で確認する |

### 既存テストへの影響(落ちてはならない)

| 状況 | 期待する結果 |
| --- | --- |
| server/tests/realtime-*.test.ts、app.test.ts | 変更なしで通る |
| `npm run typecheck`(web を含む) | web は `playback` を読まないので通る |

## やらないこと
- `routes/comments.ts` / `app.ts` の変更(スプレッドで自動追随する)
- `playback` の更新 API(PATCH は status だけのまま)
- `frame` の上限検証(shared のスキーマに従う)
- projects / model_versions への列追加や、汎用マイグレーション基盤(バージョン表など)の導入
- `data/app.db` の実ファイルに対する手動操作(起動時の `migrate` で自動移行する)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md の schema.sql / connection.ts(`addColumnIfMissing`、移行手順)/ comments.ts /
      helpers/app.ts の説明と、テスト一覧(db-migrate.test.ts)を更新している
- [ ] すべてのファイルが300行以内(routes-comments.test.ts は現在 247 行。追記で超えそうなら
      `playback` 関連のケースを `server/tests/routes-comments-playback.test.ts` へ分け、Summary にも載せる)
- [ ] verify: に書いたコマンドが成功する
