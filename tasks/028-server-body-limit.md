---
id: 028
title: server リクエスト本体の上限強制・エラーログ・ファイル保存の非同期化
feature: server
depends_on: []
owns: [server/src/app.ts, server/src/routes/projects.ts, server/src/routes/upload-validation.ts, server/src/storage/files.ts, server/src/db/comments.ts, server/tests/app.test.ts, server/tests/app-body-limit.test.ts, server/tests/helpers/app.ts, server/tests/upload-validation.test.ts, server/tests/storage-files.test.ts, server/tests/routes-projects-upload.test.ts, server/tests/db-comments.test.ts, server/server_Summary.md]
reads: [server/src/errors.ts, server/src/config.ts, server/src/routes/comments.ts, server/src/routes/static.ts, server/src/index.ts, shared/shared_Summary.md, shared/src/api.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
セキュリティレビューで確認した DoS 経路を塞ぐ。現状はアップロード上限が `Content-Length`
ヘッダのみで判定され、ヘッダ無し(chunked)や非数値で素通りして本体全部がメモリに載る。
コメント POST には本体上限が一切ない。あわせて 500 の原因がログに残らない点、
モデル保存が同期 I/O でイベントループを止める点、環境依存で落ちるテストを直す。

## 前提
- `hono/body-limit` は hono 4.13.7 に同梱されている(`node_modules/hono/dist/middleware/body-limit/index.js`)。
  `Content-Length` があり `Transfer-Encoding` が無ければヘッダ値で判定し、それ以外は本体を
  読みながら `maxSize` 超過時点で `onError(c)` を呼ぶ。**依存の追加は不要**
- `app.onError` は `toErrorResponse` で `HttpError` を `{error:{code,message}}` に変換する。server/src/app.ts:31
- `assertUploadSize` は server/src/routes/projects.ts:39 からしか呼ばれていない。
  bodyLimit で置き換わるため**削除する**(テスト server/tests/upload-validation.test.ts:62-67 も削除)
- `file.size > maxUploadBytes` の検査(server/src/routes/projects.ts:49)は multipart 全体ではなく
  ファイル本体の厳密判定なので**残す**
- `saveModelFile` は `writeFileSync` / `renameSync` を使っている。server/src/storage/files.ts:21-26。
  失敗時に `<versionId>.glb.tmp` が残る
- `findComment`(server/src/db/comments.ts:104-110)は本番コードから未使用。テスト
  server/tests/db-comments.test.ts からのみ参照される。**削除する**
- `makeTestApp` は `loadConfig({})` の既定 `webDistDir: "./web/dist"` をそのまま使うため、cwd に
  build 済み `web/dist` があると `/` が index.html を返し server/tests/app.test.ts:15-17 が落ちる
- server/tests/app.test.ts の 3 件目 "resolves injectable ids and defaults" は `createApp` を呼んでおらず
  何も検証していない。**削除する**
- `modelExtension` はドット無しファイル名で `slice(-1)`(末尾 1 文字)を拡張子扱いする。
  server/src/routes/upload-validation.ts:16-23
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/app.ts(追加分。既存の AppDeps / createApp のシグネチャは変えない)
/** JSON API(コメント投稿・更新)の本体上限 */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;
/** multipart の境界・name フィールド分として maxUploadBytes に上乗せする余裕 */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
```

createApp 内の結線(順序はこのとおり。route より前に use する):
```ts
app.use("*", async (c, next) => { await next(); c.header("X-Content-Type-Options", "nosniff"); });
app.use("/api/projects", bodyLimit({ maxSize: config.maxUploadBytes + MULTIPART_OVERHEAD_BYTES, onError: tooLarge }));
app.use("/api/projects/:projectId/comments", bodyLimit({ maxSize: MAX_JSON_BODY_BYTES, onError: tooLarge }));
app.use("/api/projects/:projectId/comments/*", bodyLimit({ maxSize: MAX_JSON_BODY_BYTES, onError: tooLarge }));
// tooLarge: () => { throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large"); }
```

```ts
// server/src/app.ts onError(置き換え)
// status が 500 のときだけ、次の JSON 1 行を console.error に出す(4xx は出さない)
// {"level":"error","msg":"request_failed","method":"POST","path":"/api/projects","error":"<message>","stack":"<stack or undefined>"}
```

```ts
// server/src/routes/upload-validation.ts
export type ModelExt = ".glb" | ".gltf";
/** node:path の extname を使う。ドット無し・未対応拡張子は UNSUPPORTED_FORMAT を投げる */
export function modelExtension(fileName: string): ModelExt;
export function assertModelBytes(ext: ModelExt, bytes: Uint8Array): void;   // 変更なし
// assertUploadSize は削除
```

```ts
// server/src/storage/files.ts(Storage インターフェイスは変更なし。実装のみ)
// saveModelFile: fs/promises の writeFile → rename。rename が失敗したら tmp を rm(force) してから元の例外を再スロー
// deleteModelFile: fs/promises の rm({ force: true })
```

```ts
// server/tests/helpers/app.ts
// makeTestApp の config は webDistDir を overrides.webDistDir ?? join(dir, "dist")(存在しないディレクトリ)にする
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| POST /api/projects、Content-Length あり、値 > maxUploadBytes + 64KiB | 413 `PAYLOAD_TOO_LARGE`、`parseBody` は呼ばれない |
| POST /api/projects、Content-Length なし(`Transfer-Encoding: chunked`)、本体 > maxUploadBytes + 64KiB | 413 `PAYLOAD_TOO_LARGE` |
| POST /api/projects、本体は上限内だが file.size > maxUploadBytes | 413 `PAYLOAD_TOO_LARGE`(既存挙動を維持) |
| POST /api/projects、上限内の正常な multipart | 201(既存テストがそのまま通る) |
| POST /api/projects/:id/comments、本体 > 1MiB(Content-Length あり) | 413 `PAYLOAD_TOO_LARGE` |
| POST /api/projects/:id/comments、本体 > 1MiB(Content-Length なし) | 413 `PAYLOAD_TOO_LARGE` |
| PATCH /api/projects/:id/comments/:cid、本体 > 1MiB | 413 `PAYLOAD_TOO_LARGE` |
| GET /api/projects/:id/comments(本体なし) | bodyLimit の影響を受けず 200 |
| どのレスポンスでも | `X-Content-Type-Options: nosniff` が付く(200・404・500 で確認) |
| ルートが未知の Error を投げる | 500 `INTERNAL` を返し、console.error に `request_failed` の JSON 1 行が出る(vi.spyOn で検証) |
| ルートが HttpError(404) を投げる | 404 を返し、console.error は呼ばれない |
| `modelExtension("model")`(ドット無し) | `UNSUPPORTED_FORMAT` |
| `modelExtension("a.b.GLB")` | `.glb` |
| `saveModelFile` で rename が失敗(rename 先をディレクトリにしておく等) | 例外が伝播し、`<id>.glb.tmp` が残らない |
| `saveModelFile` 正常 | ファイルが書かれ tmp が残らない(既存テストを維持) |
| GET `/`(makeTestApp の既定) | cwd の `web/dist` の有無に関係なく JSON 404 |
| `findComment` | 存在しない(export も test も削除) |

## やらないこと
- WebSocket 側(`server/src/realtime/*`)の上限は 029 で行う。ここでは触らない
- `shared/*` のスキーマ変更は 030 で行う
- `server/src/routes/comments.ts` と `server/src/routes/static.ts` は変更しない(bodyLimit は app.ts で結線する)
- 認証・認可の追加はしない(共有リンク方式の設計を維持する)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(bodyLimit・nosniff・request_failed ログ・assertUploadSize と findComment の削除を反映)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
