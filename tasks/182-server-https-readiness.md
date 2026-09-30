---
id: 182
title: HTTPS のリバースプロキシ配下で安全に動くよう、公開 origin・Secure Cookie・HSTS・Origin 検査・接続元 IP を整える
feature: server
depends_on: []
owns: [server/src/config.ts, server/src/index.ts, server/src/app.ts, server/src/http-security.ts, server/src/identity/session.ts, server/src/identity/client-address.ts, server/src/routes/projects.ts, server/src/routes/project-manage.ts, server/server_Summary.md, server/tests/config.test.ts, server/tests/http-security.test.ts, server/tests/client-address.test.ts, server/tests/session-secure-cookie.test.ts]
reads: [server/tests/helpers/app.ts, server/tests/app.test.ts, server/tests/routes-project-identity.test.ts, server/tests/routes-project-manage.test.ts, server/src/errors.ts, server/src/realtime/ws.ts, web/src/api/ws.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
リリース時はさくらの VPS 上で、Caddy(TLS 終端・Let's Encrypt 自動更新)を前段に置き、
アプリは `127.0.0.1:3000` で HTTP のまま待ち受ける構成にする。アプリ側では次を行う。
- 公開 URL が https のとき、Cookie に `Secure` を付け、HSTS を返す
- 状態を変える API は他 origin からの要求を拒否する
- 後続のログイン試行回数制限(185)で使う接続元 IP の取得口を用意する
- 本番起動では公開 URL の設定を必須にする

## 前提
- `loadConfig(env)` は引数の env だけを読む(`server/src/config.ts`)。テストは `loadConfig({})` を多用する
  (`server/tests/helpers/app.ts:33`)。`process.env` を直接読んではならない
- `server/tests/config.test.ts:12-37` は `loadConfig` の戻り値を `toEqual` で完全一致比較している。
  本タスクで新しいキーを期待値に足す
- `AppDeps.config` の型は `Omit<Config, ...> & Partial<Pick<Config, ...>>`(`server/src/app.ts:24-26`)。
  新しいキーもこの Omit / Partial の列に加え、**既存の fixture が型エラーにならない**ようにする
- `ensureUser` を呼ぶ箇所は、`routes/projects.ts` の 3 か所(40 / 57 / 163 行付近)と、
  `routes/project-manage.ts` の `identity()` の 1 か所。どれも IdentityDeps をその場で組み立てている
- `@hono/node-server` の `getConnInfo` は `import { getConnInfo } from "@hono/node-server/conninfo"`。
  **`app.request()` で呼んだテストでは `c.env` が無いため TypeError を投げる**(実測済み)
- `@hono/node-server` は `c.req.url` を Host ヘッダから組み立てる。`app.request("/x")` の origin は `http://localhost`
- vite の開発用 proxy(`web/vite.config.ts`)は Host を書き換えない。開発時のブラウザの Origin は
  `http://localhost:5173` で、サーバから見たリクエスト URL の origin と一致する
- WS の Origin 検査は `server/src/realtime/ws.ts` で実装済み。本タスクでは触らない。
  web は `location.protocol` が `https:` なら `wss:` を使う(`web/src/api/ws.ts:152`)
- `app.use("*")` の `nosniff` と同じく、`await next()` の後に `c.header()` すると、onError の応答にも付く
- `HttpError(403, "FORBIDDEN", message)` は onError で `{ error: { code, message } }` の 403 になる(`server/src/errors.ts`)

## インターフェイス契約

### `server/src/config.ts`

```ts
export interface Config {
  // ...既存のキーはそのまま...
  /** PUBLIC_ORIGIN。ブラウザから見た公開 origin(例 "https://review.example.com")。未設定は null */
  publicOrigin: string | null;
  /** TRUST_PROXY。"1" のときだけ true。前段のリバースプロキシが付ける X-Forwarded-For を信頼する */
  trustProxy: boolean;
  /** HOST。待ち受けアドレス(例 "127.0.0.1")。未設定・空文字は null(Node の既定 = 全アドレス) */
  host: string | null;
}

/** publicOrigin が "https:" で始まれば true */
export function usesHttps(config: { publicOrigin?: string | null }): boolean;
```

`loadConfig` の追加規則:
- `PUBLIC_ORIGIN` は `new URL()` で解釈し、`url.origin` を保存する(末尾の `/` は落ちる)。
  次のどれかに当たれば、`PUBLIC_ORIGIN` を含むメッセージで throw する
  - URL として解釈できない
  - protocol が `http:` / `https:` 以外
  - pathname が `/` 以外、search / hash がある、username / password がある
- `env.NODE_ENV === "production"` で `PUBLIC_ORIGIN` が未設定(または空文字)なら、
  `"PUBLIC_ORIGIN is required when NODE_ENV=production"` で throw する
- `TRUST_PROXY` は未設定・`"0"` なら false、`"1"` なら true。それ以外は `TRUST_PROXY` を含むメッセージで throw する

### `server/src/identity/client-address.ts`(新規)

```ts
import type { Context } from "hono";

/**
 * 接続元 IP。trustProxy が true で X-Forwarded-For があれば、カンマ区切りの最後の要素を trim したもの
 * (空なら次へ進む)。それ以外は getConnInfo(c).remote.address。
 * address が undefined、または getConnInfo が例外を投げたら "unknown"。
 */
export function clientAddressFrom(c: Context, trustProxy: boolean): string;
```
- getConnInfo の例外は、`app.request()` 経由の呼び出し(テスト)で必ず起きる想定内のものなので、
  握りつぶすのではなく「接続情報なし」として扱う旨をコメントに書く
- 最後の要素を使う理由:Caddy はクライアントから届いた X-Forwarded-For の末尾に、実際の接続元を追記するため。
  このこともコメントに書く

### `server/src/http-security.ts`(新規)

```ts
import type { MiddlewareHandler } from "hono";

export const HSTS_VALUE = "max-age=31536000";

/** 応答に Strict-Transport-Security: HSTS_VALUE を付ける(await next() の後で c.header) */
export function hsts(): MiddlewareHandler;

/**
 * GET / HEAD / OPTIONS 以外で Origin ヘッダがあり、許可 origin と一致しなければ
 * HttpError(403, "FORBIDDEN", "Cross-origin request rejected") を throw する。
 * 許可 origin は publicOrigin。null ならリクエスト URL の origin(new URL(c.req.url).origin)。
 * Origin ヘッダが無い要求は通す。
 */
export function sameOriginGuard(publicOrigin: string | null): MiddlewareHandler;
```

### `server/src/app.ts`

```ts
export interface AppDeps {
  // ...既存...
  // config の Omit / Partial に "publicOrigin" | "trustProxy" | "host" を加える
  /** 接続元 IP の取得。既定は (c) => clientAddressFrom(c, config.trustProxy ?? false) */
  clientAddress?: (c: Context) => string;
}
```
- `usesHttps(config)` のときだけ、`app.use("*", hsts())` を掛ける
- 常に `app.use("/api/*", sameOriginGuard(config.publicOrigin ?? null))` を掛ける。
  既存の bodyLimit より前でも後でもよい

### `server/src/identity/session.ts`

```ts
export interface IdentityDeps {
  db: Db;
  now: () => number;
  newUserId: () => string;
  newSessionToken: () => string;
  /** true なら Set-Cookie に Secure を付ける。省略は false */
  secureCookie?: boolean;
}

/** AppDeps から IdentityDeps を作る。secureCookie = usesHttps(deps.config) */
export function identityDepsFrom(
  deps: Pick<Required<AppDeps>, "db" | "now" | "newUserId" | "newSessionToken" | "config">,
): IdentityDeps;
```
- `AppDeps` は `import type { AppDeps } from "../app"` で読む。値の import にすると循環するので、しない
- `ensureUser` の setCookie に `secure: deps.secureCookie === true` を足す。ほかの属性は変えない
- `routes/projects.ts` の 3 か所と `routes/project-manage.ts` の `identity()` を `identityDepsFrom(deps)` に置き換える。
  挙動は変えない

### `server/src/index.ts`
- `serve({ fetch: app.fetch, port: config.port, hostname: config.host ?? undefined })`
- 起動ログ `server_started` に `publicOrigin` と `https: usesHttps(config)` を足す

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `loadConfig({})` | 既存の値に加え、`publicOrigin: null, trustProxy: false, host: null` |
| `loadConfig({ PUBLIC_ORIGIN: "https://review.example.com/", TRUST_PROXY: "1", HOST: "127.0.0.1" })` | `publicOrigin: "https://review.example.com", trustProxy: true, host: "127.0.0.1"` |
| `PUBLIC_ORIGIN` が `"ftp://x"` / `"https://x/app"` / `"https://x/?a=1"` / `"not a url"` | `/PUBLIC_ORIGIN/` で throw |
| `TRUST_PROXY: "yes"` | `/TRUST_PROXY/` で throw |
| `loadConfig({ NODE_ENV: "production" })` | `/PUBLIC_ORIGIN is required/` で throw |
| `loadConfig({ NODE_ENV: "production", PUBLIC_ORIGIN: "http://localhost:3000" })` | 成功(本番でも http を明示すれば起動できる) |
| `usesHttps({ publicOrigin: "https://a" })` / `"http://a"` / `null` / `{}` | true / false / false / false |
| `makeTestApp({ publicOrigin: "https://review.example.com" })` で任意の応答 | `Strict-Transport-Security: max-age=31536000` がある |
| `makeTestApp()`(publicOrigin null)で任意の応答 | `Strict-Transport-Security` が無い |
| `makeTestApp({ publicOrigin: "https://review.example.com" })` で Cookie なしの `GET /api/projects` | Set-Cookie に `Secure` が含まれ、`HttpOnly`・`SameSite=Lax`・`Path=/` も含まれる |
| `makeTestApp()` で Cookie なしの `GET /api/projects` | Set-Cookie に `Secure` が無い(`routes-project-identity.test.ts` が変更なしで通る) |
| `makeTestApp()` で `Origin: http://evil.example` 付きの `POST /api/projects` | 403 `FORBIDDEN`。users は 0 行 |
| `makeTestApp()` で `Origin: http://localhost` 付きの `PATCH /api/projects/p1` | 403 にならない(従来の結果) |
| `makeTestApp()` で Origin なしの `DELETE /api/projects/p1` | 403 にならない |
| `makeTestApp()` で `Origin: http://evil.example` 付きの `GET /api/projects` | 200(GET は検査しない) |
| `makeTestApp({ publicOrigin: "https://review.example.com" })` で `Origin: http://localhost` の POST | 403 |
| 同上で `Origin: https://review.example.com` の `DELETE /api/projects/p1/membership` | 403 にならない |
| `Origin: null`(文字列)の POST | 403 |
| `clientAddressFrom` を trustProxy=true、`X-Forwarded-For: 1.1.1.1, 2.2.2.2 ` で | `"2.2.2.2"` |
| trustProxy=false で同じヘッダ(app.request 経由) | `"unknown"`(ヘッダを信頼しない) |
| trustProxy=true、X-Forwarded-For なし(app.request 経由) | `"unknown"` |
| trustProxy=true、`X-Forwarded-For: " , "` | `"unknown"` |

`clientAddressFrom` のテストは、テスト内で `new Hono()` にルートを 1 つ作り、`app.request()` で呼んで確かめる。

## やらないこと
- アプリ自体での TLS 待ち受け(`https.createServer`)、証明書の読み込み、HTTP→HTTPS リダイレクト(Caddy が行う)
- Caddy・systemd の設定ファイル、VPS の構築手順(人間が `docs/` に書く)
- `server/src/realtime/ws.ts` の変更
- ログイン・試行回数制限そのもの(184〜186)
- `tests/helpers/app.ts` と、owns に無い既存テストの変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server/server_Summary.md に、新しい環境変数 3 つ・`http-security.ts`・`client-address.ts`・`identityDepsFrom` を
      追記している(追記は 12 行以内。Summary 全体が 300 行を超えないこと)。178 の「`Secure` 未設定」の申し送りを更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
