---
id: 007
title: server モデルアップロード(POST /api/projects)
feature: server
depends_on: [006]
owns: [server/src/routes/projects.ts, server/src/routes/upload-validation.ts, server/tests/upload-validation.test.ts, server/tests/routes-projects-upload.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, server/src/app.ts, server/src/errors.ts, server/src/storage/files.ts, server/src/db/connection.ts, server/src/db/projects.ts, server/tests/helpers/app.ts, server/tests/helpers/tmp.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
「アップロード → URL 発行」(§6 前提)。multipart で glTF/GLB を受け、検証し、ファイルと
projects / model_versions を保存して `Project` を返す。

## 前提
- 006 の `createApp` / `projectRoutes` / `AppDeps` / `Storage` / `makeTestApp` が実装済み
  (server_Summary.md 参照)。`routes/projects.ts` に POST を追加する
- Hono の `await c.req.parseBody()` で `file` は `File`(Web API)、`name` は string になる。
  テストは `new FormData()` に `new File([bytes], "a.glb")` を append して
  `app.request("/api/projects", { method: "POST", body: form })` で送る
- `Content-Length` は `c.req.header("content-length")`。テストでは `headers` に明示して上限超を再現する
- `ProjectNameSchema` `ALLOWED_MODEL_EXTENSIONS` `ErrorCode` は `@shared/api`
- `withTransaction` `insertProject` `insertModelVersion` `findProject` は 004
- 決定事項 D2 / D10 / D11 / D13(docs/task-breakdown.md §3)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/routes/upload-validation.ts
export type ModelExt = ".glb" | ".gltf";
/** 拡張子(小文字化して判定)。許可外なら HttpError(400, UNSUPPORTED_FORMAT) */
export function modelExtension(fileName: string): ModelExt;
/**
 * マジックバイト検査。.glb: 先頭 4 バイトが "glTF"。.gltf: UTF-8 JSON として parse でき、
 * トップレベルに object の "asset" がある。違反は HttpError(400, UNSUPPORTED_FORMAT)。
 * 0 バイトも UNSUPPORTED_FORMAT
 */
export function assertModelBytes(ext: ModelExt, bytes: Uint8Array): void;
/** 上限超なら HttpError(413, PAYLOAD_TOO_LARGE)。contentLength は未指定/非数なら検査しない */
export function assertUploadSize(contentLength: string | undefined, maxBytes: number): void;
```

`POST /api/projects`(routes/projects.ts に追加)の処理順:

1. `assertUploadSize(Content-Length, config.maxUploadBytes)` — 本文を読む前
2. `parseBody()`。`name` を `ProjectNameSchema` で検証、`file` が `File` でなければ 400 VALIDATION
3. `modelExtension(file.name)` → ext
4. `file.size > maxBytes` なら 413
5. bytes = `new Uint8Array(await file.arrayBuffer())`、`assertModelBytes(ext, bytes)`
6. `projectId = newId()`, `versionId = newId()`, `now = now()`
7. `storage.saveModelFile(versionId, bytes)`
8. `withTransaction`: `insertProject` → `insertModelVersion({ fileName: file.name, byteSize: bytes.length })`。
   throw したら `storage.deleteModelFile(versionId)` してから再 throw(→ 500)
9. `201` で `findProject(projectId)` の結果を返す

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `modelExtension("a.GLB")` / `"b.gltf"` | ".glb" / ".gltf" |
| `modelExtension("a.fbx")` / `"noext"` / `"a.glb.zip"` | HttpError 400 UNSUPPORTED_FORMAT |
| `assertModelBytes(".glb", "glTF"+任意 8 バイト)` | 例外なし |
| `assertModelBytes(".glb", "FBX!....")` / 0 バイト | 400 UNSUPPORTED_FORMAT |
| `assertModelBytes(".gltf", '{"asset":{"version":"2.0"}}')` | 例外なし |
| `assertModelBytes(".gltf", "{}")` / `"not json"` | 400 UNSUPPORTED_FORMAT |
| `assertUploadSize("101", 100)` | 413 PAYLOAD_TOO_LARGE。`"100"` / `undefined` / `"abc"` は例外なし |
| POST 正常(name "Robot", 12 バイトの "glTF..." を a.glb で) | 201。body が `ProjectSchema` で受理、`name:"Robot"`、`latestVersion.number:1`、`fileName:"a.glb"`、`byteSize:12`。`published` は空 |
| 上の後 `GET /api/projects/<id>` / `GET .../model` | 200。model の body がアップロードしたバイト列 |
| POST で `ids=["p1","v1"]` | `project.id==="p1"`, `latestVersion.id==="v1"`。ファイルが `storage.modelFilePath("v1")` に存在 |
| POST で name 欠落 / 空白のみ / 101 文字 | 400 VALIDATION |
| POST で file 欠落 / file が文字列フィールド | 400 VALIDATION |
| POST で a.fbx | 400 UNSUPPORTED_FORMAT。DB に project が増えず、uploads にファイルが残らない |
| POST で a.glb だが中身が "FBX!" | 400 UNSUPPORTED_FORMAT |
| POST で `Content-Length` ヘッダを maxUploadBytes+1 に設定 | 413。DB / ファイルに何も残らない |
| `makeTestApp({maxUploadBytes: 8})` で 12 バイトの glb(Content-Length 無し) | 413(`file.size` 検査) |
| `insertModelVersion` が throw するよう細工(例: シードで `ids` を既存 id と衝突させる) | 500 INTERNAL。`storage.modelFilePath(versionId)` のファイルが削除されている |
| 名前 `"  Robot  "` | 保存される name は `"Robot"` |

## やらないこと
- `POST /api/projects/:projectId/versions`(再アップロード。MVP+1)
- ストリーミング multipart パーサの自作(D2)
- comments ルート(008)、WS(010)
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(POST の入出力とエラーコードを記載)
- [ ] `server/src/routes/projects.ts` が 300 行以内(超えそうなら upload-validation.ts へ寄せる)
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
