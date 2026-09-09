---
id: 006
title: server Hono アプリ骨格・ファイル保存・プロジェクト取得とモデル配信
feature: server
depends_on: [005]
owns: [server/src/storage/files.ts, server/src/app.ts, server/src/routes/projects.ts, server/tests/helpers/app.ts, server/tests/storage-files.test.ts, server/tests/app.test.ts, server/tests/routes-projects-read.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, shared/src/protocol.ts, server/src/config.ts, server/src/errors.ts, server/src/db/connection.ts, server/src/db/projects.ts, server/tests/helpers/tmp.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
`createApp(deps)` で Hono アプリを組み立て、`GET /api/projects/:projectId` と
モデル本体の配信(§14)を通す。ここで確立する `AppDeps` と `tests/helpers/app.ts` を
007 / 008 / 021 がそのまま使う。

## 前提
- hono 4.13.7 / @hono/node-server 2.1.1。テストは `app.request(path, init)` で
  プロセス内実行する(HTTP サーバは立てない。§10)
- 004 の `HttpError` `toErrorResponse` `Config` `Db` `findProject` `findModelVersion`、
  005 の comments 層は実装済み(server_Summary.md 参照)
- nanoid 6: `import { nanoid } from "nanoid"`、`nanoid(12)`
- 決定事項 D5 / D11 / D12 / D13(docs/task-breakdown.md §3)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/storage/files.ts
export interface Storage {
  /** <dataDir>/uploads/<versionId>.glb.tmp に書いてから rename。書いたバイト数を返す */
  saveModelFile(versionId: string, data: Uint8Array): Promise<number>;
  /** 絶対パスとは限らない。<dataDir>/uploads/<versionId>.glb */
  modelFilePath(versionId: string): string;
  /** 無ければ何もしない */
  deleteModelFile(versionId: string): Promise<void>;
}
/** <dataDir>/uploads を mkdir -p してから返す */
export function createFileStorage(dataDir: string): Storage;
```

```ts
// server/src/app.ts
import type { Hono } from "hono";
import type { ServerMessage } from "@shared/protocol";
export interface AppDeps {
  db: Db;
  storage: Storage;
  config: Config;
  /** 同 project のルームへ配信する。008 の comments ルートが呼ぶ。010 で RoomHub に結線 */
  publish: (projectId: string, msg: ServerMessage) => void;
  now?: () => number;       // 既定 Date.now
  newId?: () => string;     // 既定 () => nanoid(12)
}
export function createApp(deps: AppDeps): Hono;
```

```ts
// server/src/routes/projects.ts
export function projectRoutes(deps: Required<AppDeps>): Hono;   // createApp が "/api/projects" にマウント
```

```ts
// server/tests/helpers/app.ts
export interface TestApp {
  app: Hono; db: Db; storage: Storage; dir: string;
  published: Array<{ projectId: string; msg: ServerMessage }>;   // publish の記録
  ids: string[];                                                  // newId が返す値のキュー。空なら "id-<連番>"
  cleanup(): void;                                                // dir を削除
}
/** 一時 dir(D12)+ :memory: DB + 固定 now(1700000000000)で createApp を組む */
export function makeTestApp(overrides?: Partial<Config>): TestApp;
/** project 1 件 + 版 1 件をシードし、モデルファイルも保存する */
export function seedProject(t: TestApp, opts?: { fileName?: string; bytes?: Uint8Array }): { project: Project; version: ModelVersion };
```

ルート(このタスクで実装するもの):

| メソッド / パス | 出力 |
| --- | --- |
| `GET /api/projects/:projectId` | 200 `Project`(JSON) |
| `GET /api/projects/:projectId/versions/:versionId/model` | 200 ファイル本体。`Content-Type` は D11。`Cache-Control: public, max-age=31536000, immutable`。`Content-Length` 付与 |

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createFileStorage(dir)` | `<dir>/uploads` が作られる。既にあっても例外なし |
| `saveModelFile("v1", bytes)` | 返り値 = bytes.length。`modelFilePath("v1")` に同じ内容。`.tmp` は残らない |
| `saveModelFile` を同 versionId で 2 回 | 2 回目の内容で上書きされる |
| `deleteModelFile("none")` | 例外なし。存在するものは削除される |
| `GET /api/projects/<seeded>` | 200。body が `ProjectSchema` で受理され、`latestVersion.id` が一致 |
| `GET /api/projects/nope` | 404 `{error:{code:"NOT_FOUND",...}}` |
| `GET .../versions/<v>/model`(fileName "a.glb") | 200。body のバイト列がシードと一致。`content-type` が `model/gltf-binary`、`cache-control` に `immutable` |
| 同上で fileName "a.gltf" | `content-type` が `model/gltf+json` |
| `GET .../versions/<v of other project>/model` | 404 NOT_FOUND |
| 版はあるがファイルが無い(seed 後に deleteModelFile) | 404 NOT_FOUND |
| `GET /api/unknown` | 404 JSON `NOT_FOUND`(HTML ではない) |
| ルート内で想定外の Error を throw(テスト用に `deps.db` を壊す等) | 500 `{error:{code:"INTERNAL",message:"Internal Server Error"}}` |
| `GET /`(API 以外) | 404(静的配信は 021。ここでは JSON 404 でよい) |
| `makeTestApp().ids = ["p1"]` のとき `deps.newId()` | "p1"。使い切ったら "id-1", "id-2", … |

## やらないこと
- `POST /api/projects`(アップロード。007)。POST を受けるルートを置かない
- comments ルート(008)、WebSocket(010)、静的配信(021)
- `server/src/index.ts` の変更(010)
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(AppDeps / ルート一覧 / テストヘルパを記載)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
