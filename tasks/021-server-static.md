---
id: 021
title: server web/dist の静的配信と SPA フォールバック
feature: server
depends_on: [010, 020]
owns: [server/src/routes/static.ts, server/src/app.ts, server/src/config.ts, server/tests/routes-static.test.ts, server/tests/config.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, server/src/errors.ts, server/src/routes/projects.ts, server/src/routes/comments.ts, server/src/index.ts, server/tests/helpers/app.ts, server/tests/helpers/tmp.ts, web/src/app/routes.ts]
verify: npm run typecheck && npm run test:server
status: todo
---

## 目的
本番運用(§18)の統合。`npm run build` が作る `web/dist` を同一プロセスから配信し、
`/p/:projectId` のような SPA のパスで直接開いても `index.html` が返るようにする。
これで `npm run build && npm run start` だけで全体が動く。

## 前提
- 006〜008 の `createApp(deps)` は `/api/projects` と `/api/projects/:projectId/comments` を
  マウントし、`app.onError` で `{error:{code,message}}` を返す。`app.notFound` の挙動は
  server_Summary.md を確認する(未定義なら Hono 既定の 404 テキスト)
- 004 の `Config` は `{ port, dataDir, maxUploadBytes }`。**このタスクで `webDistDir` を足す**。
  004 の `tests/config.test.ts` は `loadConfig({})` を `toEqual` で全キー比較しているため、
  **期待値に `webDistDir` を足して更新する**(他の行は変えない)
- `makeTestApp(overrides?: Partial<Config>)`(006)で `webDistDir` を一時ディレクトリに差し替えられる。
  一時ディレクトリは D12(`server/.vite/test-tmp/` 配下に `mkdtemp`、`afterEach` で削除)
- WS(`/ws`)は `attachRealtime` が `http.Server` 側で upgrade を処理するので Hono には届かない。
  静的配信は `/ws` を特別扱いしなくてよい
- `@hono/node-server/serve-static` は使わない(D32: root が cwd 基準でテストしにくい)。
  `node:fs/promises` で自前実装する
- `npm run build` は既に package.json にある(vite build → `web/dist`)。**package.json は変更しない**。
  `server/src/index.ts` も変更しない(`createApp` が `config.webDistDir` を見るので結線不要)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/config.ts(追加分)
export interface Config {
  port: number; dataDir: string; maxUploadBytes: number;
  /** WEB_DIST_DIR(既定 "./web/dist")。相対パスは cwd 基準 */
  webDistDir: string;
}
```

```ts
// server/src/routes/static.ts
import type { Hono } from "hono";

/** 拡張子 → Content-Type。未知は "application/octet-stream" */
export function contentTypeFor(filePath: string): string;

/** root 配下の安全なファイルパスに解決する。root の外に出る / 不正なら null。
 *  urlPath は "/" 始まりのパス部分(クエリ無し、decodeURIComponent 済み) */
export function resolveStaticPath(root: string, urlPath: string): string | null;

/** createApp が最後に app.route("/", staticRoutes(root)) でマウントする。
 *  root が存在しなければ、すべて素通し(後段の notFound に任せる) */
export function staticRoutes(root: string): Hono;
```

`staticRoutes` の規則:

| リクエスト | 応答 |
| --- | --- |
| `GET /api/...` | 触らない(先にマウント済みの API ルートが処理。ここでは `/api/` 始まりを常に `next()`) |
| `GET /assets/x.js`(ファイルが存在) | 200、本文はファイル、`Content-Type: text/javascript; charset=utf-8`、`Cache-Control: public, max-age=31536000, immutable`(`/assets/` 配下はハッシュ付きファイル名のため) |
| `GET /`(`index.html` が存在) | 200、`text/html; charset=utf-8`、`Cache-Control: no-cache` |
| `GET /p/abc`(ファイルとして存在しない、拡張子なし) | `index.html` を 200 で返す(SPA フォールバック)。`Cache-Control: no-cache` |
| `GET /missing.png`(拡張子ありで存在しない) | `next()`(→ 404) |
| `GET /../etc/passwd` 相当 / `%2e%2e` を含む | `resolveStaticPath` が null → `next()`(→ 404)。ファイルを読まない |
| `POST /` などの GET / HEAD 以外 | `next()` |
| root 自体が存在しない | すべて `next()` |

`Content-Type` 表(最低限): `.html` `text/html; charset=utf-8` / `.js` `.mjs` `text/javascript; charset=utf-8` /
`.css` `text/css; charset=utf-8` / `.json` `application/json` / `.svg` `image/svg+xml` /
`.png` `image/png` / `.ico` `image/x-icon` / `.woff2` `font/woff2` / `.map` `application/json` /
`.glb` `model/gltf-binary` / `.wasm` `application/wasm`。

`app.ts` への追加分: API ルートのマウント **後**、**最後**に
`app.route("/", staticRoutes(deps.config.webDistDir))`。あわせて `app.notFound` を
`404 {error:{code:"NOT_FOUND", message:"Not Found"}}`(JSON)に統一する(未設定の場合のみ追加)。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `loadConfig({})` | `webDistDir === "./web/dist"`(他のキーは 004 のとおり) |
| `loadConfig({WEB_DIST_DIR:"/srv/dist"})` | `"/srv/dist"` |
| `contentTypeFor("a.js")` / `"a.html"` / `"a.glb"` / `"a.unknownext"` | 上表のとおり / `application/octet-stream` |
| `resolveStaticPath("/r", "/assets/a.js")` | `path.join("/r","assets/a.js")` と一致 |
| `resolveStaticPath("/r", "/")` | `"/r"`(ディレクトリ。呼び出し側で index.html を補う) |
| `resolveStaticPath("/r", "/../x")` / `"/a/../../x"` / `"/a b"` | `null` |
| 一時 dist に `index.html`, `assets/app.js`, `favicon.ico` を置いて `GET /` | 200、本文が index.html の内容、`Content-Type` が `text/html; charset=utf-8`、`Cache-Control: no-cache` |
| `GET /assets/app.js` | 200、本文一致、`text/javascript; charset=utf-8`、`Cache-Control` に `immutable` |
| `GET /favicon.ico` | 200、`image/x-icon`、`Cache-Control: no-cache`(`/assets/` 外) |
| `GET /p/abc-123_X` | 200、本文が index.html |
| `GET /p/abc/deep` | 200、本文が index.html(拡張子が無い未知パスはすべてフォールバック) |
| `GET /missing.png` | 404 JSON `{error:{code:"NOT_FOUND",...}}` |
| root の親に `outside.txt` を置き `GET /../outside.txt` / `GET /%2e%2e/outside.txt` | 本文に outside.txt の内容が **含まれない**(200 で index.html か 404 のどちらか。root の外は決して読まない) |
| `GET /api/projects/nope` | 従来どおり 404 JSON(静的配信が API を横取りしない) |
| `GET /api/unknown-route` | 404 JSON(`index.html` にフォールバックしない) |
| `POST /` | 404 JSON(GET / HEAD 以外は配信しない) |
| `HEAD /` | 200、本文なし、`Content-Type` は html |
| `webDistDir` に存在しないパスを渡して `GET /` | 404 JSON。throw しない |
| 006〜008 の既存 routes テスト | 引き続き通る |

## やらないこと
- `web/` 側の変更、`vite.config.ts` の `base` 設定
- gzip / Brotli の事前圧縮、ETag、Range(MVP 外)
- `server/src/index.ts` / `package.json` の変更
- ディレクトリリスティング
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(静的配信の規則、`WEB_DIST_DIR`、本番起動手順 `npm run build && npm run start`)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
