---
id: 067
title: server Project 応答に全版 versions を含め、複数ファイルの一括アップロードと既存 project への版追加 API を実装する
feature: server
depends_on: [066]
owns: [server/src/db/projects.ts, server/src/routes/projects.ts, server/src/routes/project-upload.ts, server/src/app.ts, server/tests/helpers/app.ts, server/tests/db-projects.test.ts, server/tests/routes-projects-read.test.ts, server/tests/routes-projects-upload.test.ts, server/tests/routes-projects-versions.test.ts, server/tests/app-body-limit.test.ts, server/server_Summary.md]
reads: [shared/src/types.ts, shared/src/protocol.ts, shared/src/api.ts, server/src/routes/upload-validation.ts, server/src/routes/comments.ts, server/src/storage/files.ts, server/src/db/connection.ts, server/src/errors.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
1つの project に複数のモデルファイルを置けるようにする。
`GET /api/projects/:id` が全版を返し、`POST /api/projects` が複数ファイルを一括で受け、
`POST /api/projects/:id/versions` で後から追加できるようにする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 066 で `Project.versions: ModelVersion[]`(number 昇順、1件以上、末尾 = latestVersion)が
  `ProjectSchema` に加わった。shared/src/types.ts
- 066 で `ServerMessage` に `{ type: "object:added"; version: ModelVersion }` が加わった。shared/src/protocol.ts
- 066 で `listModelVersions(db, projectId): ModelVersion[]`(number 昇順、不在なら `[]`)が加わり、
  `findProject` は既に `versions`(全版)と `latestVersion`(末尾)を返す。server/src/db/projects.ts。
  本タスクでは db 層を変更しない(契約の再掲は互換確認のため)
- `insertModelVersion` は `MAX(number)+1` で採番して `ModelVersion` を返す。server/src/db/projects.ts:36-59
- `POST /api/projects` の現在の流れ: `parseBody()` → name 検証 → `file instanceof File` →
  拡張子 → サイズ → `assertModelBytes` → `saveModelFile` → transaction で insert →
  失敗時 `deleteModelFile`。server/src/routes/projects.ts:36-79
- Hono 4.13 の `c.req.parseBody({ all: true })` は同名フィールドが複数あるとき配列、
  1つだけのとき単一値を返す。`file` が File でも string(通常フィールド)でも来うる。
- `deps.publish(projectId, msg)` は REST からルーム全員へ配信する口で、コメント投稿が
  `comment:created` を流している。server/src/routes/comments.ts:54
- **multipart の本体上限は `app.ts` の `bodyLimit` がパス完全一致で掛けている。**
  `app.use("/api/projects", ...)` は `/api/projects/:projectId/versions` に**当たらない**。
  server/src/app.ts:53-60。新ルートには同じ `validateContentLength` と
  `bodyLimit({ maxSize: config.maxUploadBytes + MULTIPART_OVERHEAD_BYTES })` を追加すること
- 上限は「リクエスト本体全体」に掛かる。複数ファイルの合計が `maxUploadBytes` を超えれば
  bodyLimit が 413 を返す。ファイル単位の `file.size > maxUploadBytes` 判定はそのまま残す
- `tests/helpers/app.ts` の `seedProject` は 066 で既に `versions: [version]` を返す。
  `tests/db-projects.test.ts` の `findProject` の `toEqual` も 066 で `versions` 込みに更新済み
- `routes/projects.ts` は 107 行。複数ファイルと versions ルートを足すと 300 行に近づくため、
  「1ファイルを検証して保存する」処理は `routes/project-upload.ts` へ切り出してよい(任意)

## インターフェイス契約

```ts
// server/src/db/projects.ts(066 で実装済み。本タスクは呼ぶだけで変更しない)
export function listModelVersions(db: Db, projectId: string): ModelVersion[];
export function findProject(db: Db, projectId: string): Project | null;
```

```ts
// server/src/routes/project-upload.ts(切り出す場合)
export interface UploadedModel {
  fileName: string;
  bytes: Uint8Array;
}
/**
 * multipart の file フィールド(単一 or 配列)を検証済みの配列にする。
 * File 以外・0件は VALIDATION、拡張子不正は UNSUPPORTED_FORMAT、
 * 1ファイルが maxBytes 超は PAYLOAD_TOO_LARGE、内容不正は assertModelBytes の例外。
 * 1つでも失敗したら例外(何も保存しない)。
 */
export async function readUploadedModels(field: unknown, maxBytes: number): Promise<UploadedModel[]>;
```

REST:

| メソッド / パス | 入力 | 応答 |
| --- | --- | --- |
| `POST /api/projects` | multipart `name`、`file` × 1件以上 | 201 `Project`(versions は送信順に number 1..N) |
| `POST /api/projects/:projectId/versions` | multipart `file` × 1件 | 201 `ModelVersion`(number = 既存最大+1)。成功後 `publish(projectId, { type: "object:added", version })` |
| `GET /api/projects/:projectId` | — | 200 `Project`(versions 全件) |
| `GET /api/projects/:projectId/versions/:versionId/model` | — | 変更なし |

`POST /api/projects` の複数ファイル処理:
1. name 検証 → `readUploadedModels` で全ファイルを検証(ここで失敗なら何も保存しない)
2. 各ファイルに `deps.newId()` で versionId を採り、送信順に `saveModelFile`
3. 1つの transaction で `insertProject` と全 `insertModelVersion`(送信順)
4. 保存または transaction に失敗したら、保存済みの全ファイルを `deleteModelFile` して例外を投げる

`POST /:projectId/versions`: project 不在は 404 `NOT_FOUND`。`file` が配列(2件以上)なら 400 `VALIDATION`。
保存 → `insertModelVersion` → 失敗時 `deleteModelFile` → `publish` → 201。
`publish` は DB 反映後にだけ呼ぶ。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `findProject` で版が3つある project(`POST /api/projects/p1/versions` を2回叩いた後の `GET`) | `versions` が number 昇順3件、`latestVersion` が number 3 の版 |
| `POST /api/projects` に `file` 1件 | 201。`versions.length === 1`、`latestVersion.number === 1`(既存テストがそのまま通る) |
| `POST /api/projects` に `file` を `a.glb`, `b.gltf` の順で2件 | 201。`versions[0].fileName === "a.glb"`(number 1)、`versions[1].fileName === "b.gltf"`(number 2)、`latestVersion.id === versions[1].id`。2ファイルとも `modelFilePath` に保存済み |
| 2件のうち2件目が非 glTF(`c.txt`) | 415 `UNSUPPORTED_FORMAT`。projects 行 0 件、uploads に残骸なし |
| 2件のうち1件が `maxUploadBytes` 超(config を小さくして検証) | 413 `PAYLOAD_TOO_LARGE`。何も保存しない |
| 2件のうち2件目の内容が不正(マジックバイト違い) | `assertModelBytes` の既存エラー。1件目のファイルも残らない |
| `file` が 0 件(name のみ) | 400 `VALIDATION`(既存どおり) |
| 2件保存後に transaction が失敗(`newId` を重複させて PK 違反を起こす等) | 500。保存した2ファイルとも削除される |
| `POST /api/projects/p1/versions` に `file` 1件 | 201 `ModelVersion`(number 2、projectId p1)。`t.published` に `{ projectId: "p1", msg: { type: "object:added", version } }` が1件。`GET /api/projects/p1` の `versions` が2件になる |
| 同上で project が存在しない | 404 `NOT_FOUND`。publish されない。ファイルを保存しない |
| 同上で `file` が2件 | 400 `VALIDATION`。publish されない |
| 同上で `file` 欠落 | 400 `VALIDATION` |
| 同上で拡張子不正 | 415 `UNSUPPORTED_FORMAT` |
| 同上で本体が `maxUploadBytes + MULTIPART_OVERHEAD_BYTES` 超(Content-Length 指定) | 413 `PAYLOAD_TOO_LARGE`(app-body-limit テストに追加) |
| 同上で DB 失敗 | 500。保存ファイル削除、publish されない |
| `GET /api/projects/p1` | `ProjectSchema.parse` が通り、`versions` を含む |

## やらないこと
- `db/projects.ts` の `findProject` / `listModelVersions` の変更(066 で済んでいる)
- RoomHub の可視性状態(068)
- 版の削除・並べ替え API
- 可視性の永続化
- web の変更
- `MULTIPART_OVERHEAD_BYTES` や `maxUploadBytes` の値の変更(合計上限は現状の本体上限のまま)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md のルート・DB・テスト一覧を更新している(project-upload.ts を作った場合はそれも)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
