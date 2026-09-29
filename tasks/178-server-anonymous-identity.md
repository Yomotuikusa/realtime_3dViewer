---
id: 178
title: 匿名ユーザーを Cookie セッションで識別し、プロジェクトの所有者と参加を記録する
feature: server
depends_on: []
owns: [server/src/db/schema.sql, server/src/db/connection.ts, server/src/db/users.ts, server/src/db/project-members.ts, server/src/db/projects.ts, server/src/identity/session.ts, server/src/routes/projects.ts, server/src/app.ts, server/server_Summary.md, server/tests/identity-session.test.ts, server/tests/db-identity.test.ts, server/tests/routes-project-identity.test.ts]
reads: [server/src/db/comments.ts, server/src/routes/comments.ts, server/src/index.ts, server/tests/helpers/app.ts, server/tests/db-migrate.test.ts, server/tests/db-projects.test.ts, server/tests/routes-projects-upload.test.ts, server/tests/routes-projects-read.test.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
いまのプロジェクトは誰が作ったか・誰が開いたかを記録していないため、「自分のプロジェクト一覧」を作れない。
将来のアカウント機能を前提に、**ユーザー(users)とセッション(sessions)を分けて**持つ。
アカウントができるまでは、サーバが発行する匿名ユーザーとして Cookie で識別する。
あわせて、プロジェクトの所有者(`projects.owner_id`)と、プロジェクトを開いた記録
(`project_members`)を残す。一覧 API と画面は後続タスク 179 で作る。

## 前提
- DB は `node:sqlite`。`openDb` が `PRAGMA foreign_keys = ON` を掛けてから `migrate` を呼ぶ。
  `migrate` は schema.sql を丸ごと実行し、その後 `addColumnIfMissing` で既存 DB に不足している列を足す
  (`server/src/db/connection.ts:7-35`)。schema.sql はすべて `CREATE ... IF NOT EXISTS` なので、
  **既存 DB では既存テーブルの CREATE は読み飛ばされる**。後から足す列は schema.sql の CREATE 文と
  `addColumnIfMissing` の両方に書くのがこのリポジトリの流儀(comments.playback_json と同じ)
- schema.sql は旧定義の projects(owner_id なし)に対しても最初に実行される
  (`server/tests/db-migrate.test.ts:14-47` の `legacyDb`)。そのため、**schema.sql に
  `projects.owner_id` を参照する INDEX を書いてはならない**(旧 DB の migrate が落ちる)
- `withTransaction` は BEGIN/COMMIT の入れ子に対応していない(`connection.ts:37-47`)
- `createApp` は `AppDeps` の省略可能な `now` / `newId` を埋めた `Required<AppDeps>` を
  各 routes に渡す(`server/src/app.ts:20-36`)
- テストの `makeTestApp` は `newId` を `t.ids` の先頭から順に払い出す(`server/tests/helpers/app.ts:55-62`)。
  既存テストは `t.ids = ["p1", "v1", ...]` のように、project・版の id がこの順で消費されることに依存している。
  **識別のための id 生成が `newId` を 1 回でも呼ぶと、既存テストの id がずれて落ちる**。
  そのため、ユーザー id とセッショントークンの生成は `newId` とは別の依存にする(契約参照)
- `seedProject` は `insertProject(t.db, { id, name, createdAt })` を ownerId なしで呼ぶ
  (`helpers/app.ts:74`)。db-projects / db-comments / routes-comments のテストも同じ形で呼ぶ。
  **`insertProject` の既存の呼び出し形は変えずに通ること**
- `db-projects.test.ts:85-91` は `findProject` の戻り値を `toEqual` で完全一致比較している。
  **`Project` 型・`findProject` の戻り値に `ownerId` などのキーを足してはならない**
- `db-projects.test.ts:31-48` のテーブル一覧テストは `name IN (...)` で絞っているので、テーブルを足しても落ちない
- Hono 4.13 の Cookie ヘルパは `import { getCookie, setCookie } from "hono/cookie"`。
  `setCookie` の `maxAge` は 400 日(34560000 秒)を超えると例外を投げる
- 今回の範囲では WebSocket(`/ws`)は識別しない。`server/src/index.ts` と `realtime/` は変更しない

## インターフェイス契約

### schema.sql への追加(既存の CREATE 文は projects に owner_id を足す以外は変えない)

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  owner_id TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id, last_opened_at);
```

- `users` と `sessions` の CREATE は `projects` より前に置いてよい(SQLite は REFERENCES 先の存在を
  CREATE 時に検査しないので、順序はどちらでも動く)
- `connection.ts` の `migrate` に `addColumnIfMissing(db, "projects", "owner_id", "TEXT REFERENCES users(id)")` を足す

### `server/src/db/users.ts`(新規)

```ts
import type { Db } from "./connection";

/** 匿名ユーザーの行を作る。将来のアカウントも同じ users 行を使う */
export function insertUser(db: Db, input: { id: string; createdAt: number }): void;

/** セッションを作る。tokenHash は生トークンの SHA-256(16進小文字 64 文字) */
export function insertSession(
  db: Db,
  input: { tokenHash: string; userId: string; createdAt: number },
): void;

/** tokenHash に対応する user id。無ければ null */
export function findUserIdBySessionHash(db: Db, tokenHash: string): string | null;
```

### `server/src/db/project-members.ts`(新規)

```ts
import type { Db } from "./connection";

/**
 * userId が projectId を開いたことを記録する。
 * 行が無ければ joined_at = last_opened_at = openedAt で作り、あれば last_opened_at だけを openedAt に更新する。
 * (INSERT ... ON CONFLICT(project_id, user_id) DO UPDATE SET last_opened_at = excluded.last_opened_at)
 */
export function touchProjectMembership(
  db: Db,
  input: { projectId: string; userId: string; openedAt: number },
): void;
```

### `server/src/db/projects.ts`(変更)

```ts
/** ownerId を省略・null にすると owner_id は NULL(既存の呼び出しはそのまま通る) */
export function insertProject(
  db: Db,
  input: { id: string; name: string; createdAt: number; ownerId?: string | null },
): void;
```

`findProject` / `Project` の形は変えない。

### `server/src/identity/session.ts`(新規)

```ts
import type { Context } from "hono";
import type { Db } from "../db/connection";

/** セッショントークンを入れる Cookie 名 */
export const SESSION_COOKIE = "rv_session";
/** Cookie の Max-Age(秒)。400 日 = Hono の setCookie が許す上限 */
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export interface IdentityDeps {
  db: Db;
  now: () => number;
  /** users.id の生成。AppDeps.newId とは別系統 */
  newUserId: () => string;
  /** 生のセッショントークンの生成 */
  newSessionToken: () => string;
}

/** 生トークンの SHA-256 を 16 進小文字で返す(node:crypto の createHash) */
export function hashSessionToken(token: string): string;

/**
 * リクエストの Cookie からユーザーを解決して user id を返す。
 * Cookie が無い、またはどのセッションにも一致しないときは、users と sessions の行を
 * 1 トランザクションで作り、Set-Cookie で新しいトークンを渡してからその user id を返す。
 * withTransaction の内側から呼んではならない(入れ子になる)。
 */
export function ensureUser(c: Context, deps: IdentityDeps): string;
```

Set-Cookie は `setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS })`。
`Secure` は付けない(現状は HTTP の LAN 運用。HTTPS 化の際に付ける旨を Summary の申し送りに書く)。
DB には生トークンを保存しない。

### `server/src/app.ts`(変更)

```ts
export interface AppDeps {
  // ...既存のまま...
  /** 匿名ユーザー id の生成。既定は nanoid(12)。newId とは独立 */
  newUserId?: () => string;
  /** セッショントークンの生成。既定は nanoid(32) */
  newSessionToken?: () => string;
}
```

`createApp` の `resolved` で既定値を埋める。`tests/helpers/app.ts` は変更しない(省略時は既定の nanoid になる)。

### `server/src/routes/projects.ts`(変更)

- `POST /`:`name` と `file` の検証(`ProjectNameSchema.parse` と `readUploadedModels`)が**通った後**、
  既存の `withTransaction` の**前**で `ensureUser` を呼ぶ。トランザクション内で
  `insertProject(..., ownerId: userId)` と各版の登録に続けて
  `touchProjectMembership({ projectId, userId, openedAt: createdAt })` を行う
- `GET /:projectId`:project が見つかった後で `ensureUser` を呼び、
  `touchProjectMembership({ projectId, userId, openedAt: deps.now() })` を記録してから、従来どおり `Project` を返す
- 上記以外のルート(版追加・版削除・モデル配信・コメント系)では `ensureUser` を呼ばない

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| Cookie なしで `POST /api/projects`(正常な name と file) | 201。`Set-Cookie` に `rv_session=<トークン>` と `HttpOnly`・`SameSite=Lax`・`Path=/`・`Max-Age=34560000` が含まれる。users 1 行、sessions 1 行 |
| 上の直後の DB | `sessions.token_hash` は Cookie のトークンそのものではなく `hashSessionToken(token)` と一致する。`projects.owner_id` はその session の user_id。`project_members` に (project, user, joined_at=1700000000000, last_opened_at=1700000000000) の 1 行 |
| 上の Cookie を付けてもう一度 `POST /api/projects` | 201。レスポンスに `Set-Cookie` が無い。users は 1 行のまま。新しい project の owner_id も同じ user |
| どのセッションにも一致しない Cookie(`rv_session=unknown`)で `POST /api/projects` | 201。新しいユーザーが作られ、`Set-Cookie` で新しいトークンが渡される |
| Cookie なしで name 欠落の `POST /api/projects` | 400 `VALIDATION`。users は 0 行、`Set-Cookie` なし |
| `t.ids = ["p1", "v1"]` で Cookie なしの `POST /api/projects`(1 ファイル) | project id は `p1`、版 id は `v1`(識別処理が `newId` を消費しない) |
| `seedProject`(owner_id NULL)に Cookie なしで `GET /api/projects/p1` | 200。本文は従来の `Project` と完全一致(`ownerId` キーなし)。`Set-Cookie` あり。`project_members` に (p1, そのユーザー) の行ができる。`projects.owner_id` は NULL のまま |
| 同じ Cookie で `GET /api/projects/p1` を 2 回 | `project_members` の (p1, user) は 1 行のまま |
| 存在しない project に `GET /api/projects/nope` | 404 `NOT_FOUND`。users は 0 行、`Set-Cookie` なし |
| Cookie なしで `GET .../comments`・`GET .../versions/:v/model`・`POST .../versions` | どのレスポンスにも `Set-Cookie` が無く、users は 0 行 |
| `touchProjectMembership` を openedAt=10 で呼び、次に 20 で呼ぶ | 1 行で joined_at=10、last_opened_at=20 |
| `project_members` に存在しない user_id / project_id を入れる | 外部キー違反で例外 |
| members の付いた project を(版・コメントなしの状態で)`DELETE FROM projects` | その project の members 行も消える(ON DELETE CASCADE) |
| `insertProject` を ownerId なしで呼ぶ | owner_id は NULL |
| 旧定義(owner_id なし)の DB に `migrate` | projects に nullable な owner_id が足され、既存行は NULL。users / sessions / project_members ができる。2 回 `migrate` しても例外にならない |
| `hashSessionToken("abc")` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |

## やらないこと
- プロジェクト一覧 API(`GET /api/projects`)と web 側の変更は 179 で行う。ここでは作らない
- 名前変更・削除・権限検査(403)は 180 で行う
- WebSocket 接続の識別、`server/src/index.ts`・`server/src/realtime/` の変更
- ログイン・ログアウト・アカウント登録・セッションの失効や期限管理
- `Project` 型・`shared/` の変更
- `tests/helpers/app.ts` と既存テストファイルの変更(新しいテストは owns の 3 ファイルに書く)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] 既存の server テストが変更なしで通る
- [ ] server/server_Summary.md に users / sessions / project_members、`identity/session.ts`、
      `Secure` 未設定の申し送りが反映されている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
