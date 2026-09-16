---
id: 141
title: server 1 リクエストで受け付けるモデルファイル数の上限を環境変数で決める
feature: server
depends_on: [140]
owns: [server/src/config.ts, server/src/app.ts, server/src/routes/project-upload.ts, server/src/routes/projects.ts, server/tests/config.test.ts, server/tests/routes-projects-upload.test.ts, server/server_Summary.md]
reads: [server/src/routes/upload-validation.ts, server/src/errors.ts, server/tests/helpers/app.ts, shared/src/api.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:server
status: todo
---

## 目的
プロジェクト作成の multipart は file フィールドを何個でも受け付け、個数の上限が無い。
1 ファイルあたりのサイズと本文全体の上限だけが歯止めなので、`MAX_UPLOAD_FILES` を `config.ts` に加え、
超過は本文のバイト列を読む前に 400 で断る。

## 前提
- `server/src/routes/project-upload.ts:13-16` `readUploadedModels(field: unknown, maxBytes: number): Promise<UploadedModel[]>`。
  `:17-20` で `fields = Array.isArray(field) ? field : [field]` とし、空または File 以外があれば
  `HttpError(400, "VALIDATION", "A model file is required")`。`:22-39` で 1 件ずつ拡張子 → サイズ → `file.arrayBuffer()` → `assertModelBytes`
- 呼び出し元は `server/src/routes/projects.ts:39`(作成: `readUploadedModels(body.file, deps.config.maxUploadBytes)`)と
  `:88`(版追加。1 ファイル)
- `server/src/errors.ts` の `HttpError(status, code, message)`(`:4-13`)。`toErrorResponse`(`:16-35`)が `{ error: { code, message } }` にする
- `server/src/config.ts` は 140 で `wsHeartbeatIntervalMs` と `DEFAULT_*` 定数が入った状態。`parseNonNegativeInteger` は 0 を許す
- `server/src/app.ts` の `AppDeps.config` は 140 で `Omit<Config, "webDistDir" | "wsHeartbeatIntervalMs"> & Partial<…>` になっている。
  テストの config は `server/tests/helpers/app.ts` の `makeTestApp(overrides: Partial<Config> = {})` が `{ ...loadConfig({}), ...overrides, dataDir, webDistDir }` で組み立てる
  (`routes-projects-upload.test.ts:13-17` の `testApp(overrides)` はそれを包んで後始末に登録するだけの局所関数)。
  したがって `testApp({ maxUploadFiles: 2 })` で上限を変えたアプリを作れる
- `server/tests/routes-projects-upload.test.ts:34-39` の `multiUploadForm(name, files)` が複数 file を append する。
  `:59-80` が複数保存の成功例、`:82-96` が「全件検証してから保存」の例(415 でプロジェクト 0 件・uploads 空を確認)
- `server/server_Summary.md:9-10`(config.ts)、`:26-27`(project-upload.ts)、`:56-60`(app.ts)

## インターフェイス契約

```ts
// server/src/config.ts
/** MAX_UPLOAD_FILES の既定 */
export const DEFAULT_MAX_UPLOAD_FILES = 20;
export interface Config {
  // …140 までのフィールド
  /** MAX_UPLOAD_FILES。1 リクエストで受け付けるモデルファイル数の上限。1 以上 */
  maxUploadFiles: number;
}
// loadConfig: parseNonNegativeInteger("MAX_UPLOAD_FILES", …) の結果が 0 なら Error("MAX_UPLOAD_FILES must be at least 1")
```

```ts
// server/src/app.ts
// AppDeps.config の Partial に "maxUploadFiles" を加える(既存テストは渡さない)
config: Omit<Config, "webDistDir" | "wsHeartbeatIntervalMs" | "maxUploadFiles">
  & Partial<Pick<Config, "webDistDir" | "wsHeartbeatIntervalMs" | "maxUploadFiles">>;
```

```ts
// server/src/routes/project-upload.ts
/**
 * multipart の file フィールド(単一または配列)を検証して返す。
 * fields.length > maxFiles なら、どのファイルのバイト列も読まずに HttpError(400, "VALIDATION", "Too many files")。
 * この検査は File 型の検査(A model file is required)の直後、拡張子検査の前に行う。
 */
export async function readUploadedModels(field: unknown, maxBytes: number, maxFiles: number): Promise<UploadedModel[]>;
```

```ts
// server/src/routes/projects.ts の 2 箇所
readUploadedModels(body.file, deps.config.maxUploadBytes, deps.config.maxUploadFiles ?? DEFAULT_MAX_UPLOAD_FILES)
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `loadConfig({})` | `maxUploadFiles === 20` |
| `loadConfig({ MAX_UPLOAD_FILES: "3" })` | 3 |
| `loadConfig({ MAX_UPLOAD_FILES: "0" })` / `"abc"` / `"-1"` | `/MAX_UPLOAD_FILES/` で throw |
| `POST /api/projects` に `maxUploadFiles: 2` の app で 3 ファイル(すべて正しい .glb) | 400、`error.code === "VALIDATION"`、`error.message === "Too many files"`。プロジェクト 0 件、`uploads` 空 |
| 同じ app で 2 ファイル | 201(境界は受理) |
| `maxUploadFiles: 1` の app で 2 ファイルのうち 2 つ目が `.txt` | 400 `VALIDATION`(個数検査が形式検査より先) |
| `maxUploadFiles` を渡さない `makeTestApp()` | `loadConfig({})` の既定 20 になり、既存テストが通る |
| 版追加 `POST /api/projects/:id/versions`(1 ファイル) | 従来どおり 201 |

## やらないこと
- 合計バイト数の上限(`bodyLimit`)や 1 ファイルの上限は変えない
- web 側の個数チェックは足さない(サーバのエラー文言がそのまま表示される)
- 環境変数の説明を docs に足すのは起票側が行う
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md の config.ts / project-upload.ts の説明が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
