---
id: 004
title: server 設定・エラー型・SQLite 接続・projects テーブル層
feature: server
depends_on: [002]
owns: [server/src/config.ts, server/src/errors.ts, server/src/db/connection.ts, server/src/db/schema.sql, server/src/db/projects.ts, server/tests/helpers/tmp.ts, server/tests/config.test.ts, server/tests/errors.test.ts, server/tests/db-projects.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, server/tsconfig.json, server/vitest.config.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
server の土台(環境変数、HTTP エラー型、`node:sqlite` 接続とスキーマ適用、projects /
model_versions の CRUD)を作る。以降の server タスクはすべてここに積む。

## 前提
- Node 24.12 の `node:sqlite`(`import { DatabaseSync } from "node:sqlite"`)を使う。
  ExperimentalWarning が stderr に出るが無害。トランザクション用ヘルパは無いので
  `BEGIN` / `COMMIT` / `ROLLBACK` を `db.exec` で発行する
- `npm run test:server` は `vitest run --config server/vitest.config.ts`(environment: node、
  `server/tests/**/*.test.ts`)を workspace 直下で実行する
- `@shared/types` から `Project` `ModelVersion`、`@shared/api` から `ErrorCode` `ApiError`
  `MAX_UPLOAD_BYTES_DEFAULT` を import する(002 で定義済み。shared/shared_Summary.md 参照)
- `server/src/index.ts` はプレースホルダのまま触らない(010 で書き換える)
- 決定事項 D10 / D12(docs/task-breakdown.md §3)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/config.ts
export interface Config { port: number; dataDir: string; maxUploadBytes: number }
/** PORT(既定 3000)/ DATA_DIR(既定 "./data")/ MAX_UPLOAD_BYTES(既定 MAX_UPLOAD_BYTES_DEFAULT) */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config;
```

```ts
// server/src/errors.ts
import type { ApiError, ErrorCode } from "@shared/api";
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string);
}
/** HttpError → そのまま / ZodError → 400 VALIDATION / それ以外 → 500 INTERNAL("Internal Server Error") */
export function toErrorResponse(err: unknown): { status: number; body: ApiError };
```

```ts
// server/src/db/connection.ts
import { DatabaseSync } from "node:sqlite";
export type Db = DatabaseSync;
/** 開いて PRAGMA foreign_keys=ON と journal_mode=WAL(":memory:" のときは WAL 不要)を設定し migrate() する */
export function openDb(path: string): Db;
/** schema.sql(同ディレクトリ、import.meta.url から解決)を exec。IF NOT EXISTS で冪等 */
export function migrate(db: Db): void;
/** BEGIN → fn → COMMIT。fn が throw したら ROLLBACK して再 throw */
export function withTransaction<T>(db: Db, fn: () => T): T;
```

`server/src/db/schema.sql` は設計書 §13.2 の CREATE 文をそのまま置く(projects / model_versions /
comments / idx_comments_project)。comments テーブルもこのタスクで作る(005 は CRUD だけ)。

```ts
// server/src/db/projects.ts
import type { Project, ModelVersion } from "@shared/types";
export function insertProject(db: Db, input: { id: string; name: string; createdAt: number }): void;
/** number は同 project の max(number)+1(無ければ 1) */
export function insertModelVersion(
  db: Db, input: { id: string; projectId: string; fileName: string; byteSize: number; createdAt: number },
): ModelVersion;
/** latestVersion = number 最大の版。project が無い、または版が 1 つも無ければ null(D10) */
export function findProject(db: Db, projectId: string): Project | null;
/** projectId に属さない versionId なら null */
export function findModelVersion(db: Db, projectId: string, versionId: string): ModelVersion | null;
```

```ts
// server/tests/helpers/tmp.ts  (以降の server テストが共用する)
/** server/.vite/test-tmp/ 配下に mkdtemp した絶対パスを返す(D12)。/tmp は使わない */
export function makeTmpDir(prefix: string): string;
/** 再帰削除。存在しなければ何もしない */
export function removeTmpDir(dir: string): void;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `loadConfig({})` | `{port:3000, dataDir:"./data", maxUploadBytes:104857600}` |
| `loadConfig({PORT:"8080", DATA_DIR:"/x", MAX_UPLOAD_BYTES:"10"})` | それぞれ 8080 / "/x" / 10 |
| `loadConfig({PORT:"abc"})` / `{MAX_UPLOAD_BYTES:"-1"}` | `Error` を throw(メッセージに変数名を含む) |
| `toErrorResponse(new HttpError(404,"NOT_FOUND","x"))` | `{status:404, body:{error:{code:"NOT_FOUND",message:"x"}}}` |
| `toErrorResponse(<ZodError>)` | status 400、code `VALIDATION`、message は非空 |
| `toErrorResponse(new Error("secret"))` | status 500、code `INTERNAL`、message は `"Internal Server Error"`(元メッセージを漏らさない) |
| `openDb(":memory:")` | 3 テーブルと index が存在する(`sqlite_master` で確認) |
| `openDb(<一時ファイルパス>)` を 2 回 | 2 回目も例外なし(冪等) |
| `openDb` 後に FK 違反の insert(存在しない project_id で model_versions) | throw する(foreign_keys=ON) |
| `withTransaction` 内で throw | ROLLBACK され、途中の insert が残らない。例外は呼び出し元へ再 throw |
| `insertProject` → `findProject` | 版が無いので null |
| `insertModelVersion` を同 project に 2 回 | number が 1, 2。返り値は入力 + number |
| 上の後 `findProject` | `latestVersion.number === 2`、`name` `createdAt` が一致 |
| `insertProject` を同 id で 2 回 | throw(PRIMARY KEY) |
| `findProject("nope")` | null |
| `findModelVersion(projectA, versionOfProjectB)` | null |
| `findModelVersion(projectA, versionOfProjectA)` | ModelVersion(byteSize / fileName 一致) |
| `makeTmpDir("x")` | `server/.vite/test-tmp/` 配下に存在するディレクトリ。`removeTmpDir` 後は存在しない |

## やらないこと
- comments の CRUD(005)、HTTP ルート・Hono アプリ(006)、ファイル保存(006)
- `server/src/index.ts` の変更(010)
- マイグレーションのバージョン管理(IF NOT EXISTS で十分)
- 依存の追加・package.json / tsconfig / vitest 設定の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(ファイル一覧 / 公開インターフェイス / shared との関係)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
