---
id: 185
title: ログイン・ログアウト API と、ログイン試行回数の制限、ログイン時の匿名データの統合を作る
feature: server
depends_on: [184]
owns: [server/src/identity/rate-limit.ts, server/src/identity/sign-in.ts, server/src/identity/session.ts, server/src/db/account-merge.ts, server/src/routes/account-login.ts, server/src/routes/account.ts, server/server_Summary.md, server/tests/rate-limit.test.ts, server/tests/account-merge.test.ts, server/tests/routes-account-login.test.ts, server/tests/routes-account-rate-limit.test.ts]
reads: [shared/src/account.ts, shared/src/api.ts, server/src/app.ts, server/src/db/schema.sql, server/src/db/connection.ts, server/src/db/users.ts, server/src/db/accounts.ts, server/src/identity/password.ts, server/src/identity/client-address.ts, server/src/errors.ts, server/tests/helpers/app.ts, server/tests/routes-account-register.test.ts]
verify: npm run typecheck && npm run test
status: todo
---

## 目的
184 で登録したアカウントに、別の端末や Cookie を消した後からログインして戻れるようにする。

- ログインした端末で匿名のまま作った・開いたプロジェクトやコメントは、アカウントに統合する
- パスワードの総当たりを防ぐため、ログイン ID×IP と IP 単位で失敗回数を制限する
- 登録 API にも IP 単位の回数制限を掛ける

## 前提
- 184 までに以下がある
  - `resolveUserId(c, deps)`:作成はせず、期限切れは消して null を返す
  - `rotateSession(c, deps, userId, kind)`:今のセッション行を消し、新しいセッションを発行する。
    内部で `withTransaction` を使う
  - `identityDepsFrom(deps)`
  - `SESSION_COOKIE`
  - 以上は `server/src/identity/session.ts` にある
- `findCredentialsByLoginId` と `findAccount` は `server/src/db/accounts.ts`、
  `hashPassword` / `verifyPassword` は `server/src/identity/password.ts` にある
- `withTransaction` は入れ子にできない(`server/src/db/connection.ts`)
- users を参照する列は次の 4 つ(`server/src/db/schema.sql`)
  - `sessions.user_id`:ON DELETE CASCADE
  - `project_members.user_id`:ON DELETE CASCADE
  - `projects.owner_id`:CASCADE なし
  - `comments.author_id`:CASCADE なし
- `deps.clientAddress(c)` は接続元 IP を返す(182)。`makeTestApp({ trustProxy: true })` にすると、
  `X-Forwarded-For` ヘッダの最後の値が IP になる。trustProxy なしの `app.request()` では常に `"unknown"`
- `makeTestApp` の `now` は常に `1700000000000` を返す(`server/tests/helpers/app.ts`)。
  時間経過の検証は `AttemptLimiter` の単体テストで、`now` を差し替えて行う
- `accountRoutes` の `routes.use("*")` で付けている `Cache-Control: no-store` は、
  `routes.route("/", sub)` でぶら下げたサブルートにも掛かる
- Hono の Cookie 削除は `import { deleteCookie } from "hono/cookie"` の `deleteCookie(c, name, opt)`
- SQLite の `INSERT INTO ... SELECT ... ON CONFLICT` は、SELECT に WHERE 句が無いと構文があいまいになる。
  本タスクの SELECT には必ず `WHERE user_id = ?` があるので、そのまま書いてよい

## インターフェイス契約

### `server/src/identity/rate-limit.ts`(新規)

```ts
import type { Context } from "hono";

export interface AttemptLimiterOptions {
  limit: number;
  windowMs: number;
  now: () => number;
  /** 保持するキー数の上限。既定 10000 */
  maxKeys?: number;
}

/**
 * キーごとの固定窓カウンタ。窓は最初に record した時刻から windowMs。
 * now() >= windowStart + windowMs で窓が明ける(そのエントリは消えたものとして扱う)。
 */
export class AttemptLimiter {
  constructor(options: AttemptLimiterOptions);
  /** count >= limit なら、窓が明けるまでの秒数(Math.ceil、最小 1)。そうでなければ null。明けたエントリは消す */
  retryAfterSeconds(key: string): number | null;
  /** 1 回数える。エントリが無い、または窓が明けていれば { count: 1, windowStart: now() } から始める。
   *  新しいキーを足すときに size >= maxKeys なら、先に明けたエントリをすべて消し、
   *  それでも size >= maxKeys なら挿入順で最も古いキーを消す */
  record(key: string): void;
  reset(key: string): void;
  /** 保持しているキー数 */
  get size(): number;
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMIT_PER_ID_AND_IP = 10;
export const LOGIN_LIMIT_PER_IP = 30;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;
export const REGISTER_LIMIT_PER_IP = 10;

export interface AuthLimiters {
  /** キー "<loginId またはユーザー id>|<ip>"。limit LOGIN_LIMIT_PER_ID_AND_IP / LOGIN_WINDOW_MS */
  byIdAndIp: AttemptLimiter;
  /** キー "<ip>"。limit LOGIN_LIMIT_PER_IP / LOGIN_WINDOW_MS */
  byIp: AttemptLimiter;
  /** キー "<ip>"。limit REGISTER_LIMIT_PER_IP / REGISTER_WINDOW_MS */
  registerByIp: AttemptLimiter;
}
export function createAuthLimiters(now: () => number): AuthLimiters;

/** 429 { error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts" } } と Retry-After: <seconds> の応答 */
export function tooManyRequests(c: Context, retryAfterSeconds: number): Response;
```

### `server/src/db/account-merge.ts`(新規)

```ts
/**
 * 匿名ユーザー fromUserId のデータを toUserId に移し、fromUserId の users 行を消す。自身の withTransaction で行う。
 * - project_members: (project, to) の行が無ければ from の行を to として作る。
 *   あれば joined_at は小さい方、last_opened_at は大きい方にする
 * - projects.owner_id が from の行を to にする
 * - comments.author_id が from の行を to にする
 * - users の from 行を消す(sessions と from の project_members は CASCADE で消える)
 * from が login_id を持つ、from === to、from・to のどちらかが存在しない場合は、何も変えずに Error を throw する。
 */
export function mergeAnonymousUser(db: Db, fromUserId: string, toUserId: string): void;
```

### `server/src/identity/session.ts`(追加)

```ts
/**
 * 今の Cookie のセッション行があれば消し、Cookie を削除する
 * (deleteCookie。path "/"、HttpOnly、SameSite=Lax、secureCookie なら Secure)。Cookie が無くても例外にしない。
 */
export function endSession(c: Context, deps: IdentityDeps): void;
```

### `server/src/identity/sign-in.ts`(新規。186 も使う)

```ts
/**
 * accountUserId としてログインさせる。
 * 1. current = resolveUserId(c, deps)
 * 2. current があり、accountUserId と異なり、findAccount(current).loginId が null(匿名)なら
 *    mergeAnonymousUser(deps.db, current, accountUserId)
 *    (current が別のアカウントなら統合しない)
 * 3. rotateSession(c, deps, accountUserId, "account")
 */
export function signIn(c: Context, deps: IdentityDeps, accountUserId: string): void;
```

### `server/src/routes/account-login.ts`(新規)

```ts
export function accountLoginRoutes(deps: Required<AppDeps>, limiters: AuthLimiters): Hono;
```

`POST /login` の処理順:
1. `LoginInput.parse`(不正な JSON・値は 400 `VALIDATION`。回数には数えない)
2. `ip = deps.clientAddress(c)`、`idKey = \`${loginId}|${ip}\``
3. `byIdAndIp.retryAfterSeconds(idKey)` と `byIp.retryAfterSeconds(ip)` のうち null でないものの最大値があれば、
   `tooManyRequests`(パスワードは照合しない)
4. `creds = findCredentialsByLoginId(loginId)`
   - creds があれば `verifyPassword(password, creds.passwordHash)`
   - 無ければ、ダミーのハッシュで `verifyPassword` を実行した上で失敗とする(応答時間をそろえ、ID の存在を推測させない)。
     ダミーのハッシュは `hashPassword("<固定文字列>", deps.passwordParams)` を、ルート生成ごとに 1 回だけ遅延計算して使い回す
5. 失敗なら `byIdAndIp.record(idKey)`、`byIp.record(ip)` を行い、401 `UNAUTHORIZED`(`"Invalid login ID or password"`)。
   ID が無い場合もパスワード違いの場合も同じ応答にする
6. 成功なら `byIdAndIp.reset(idKey)` → `signIn(c, identityDepsFrom(deps), creds.userId)` → 200 `findAccount(creds.userId)`

`POST /logout`:`endSession(c, identityDepsFrom(deps))` → 204、本文なし。Cookie が無くても 204。

### `server/src/routes/account.ts`(変更)
- ルート生成時に `const limiters = createAuthLimiters(deps.now)` を 1 回作り、
  `routes.route("/", accountLoginRoutes(deps, limiters))` でぶら下げる
- `POST /register` の先頭で、`registerByIp.retryAfterSeconds(ip)` があれば `tooManyRequests`。
  無ければ `registerByIp.record(ip)` してから、184 の処理に進む(本文の検証失敗も含めて、登録要求はすべて数える)
- 186 で limiters を使うので、`AuthLimiters` はルート生成ごとに 1 組とする(テストのアプリ間で共有しない)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `AttemptLimiter({ limit: 3, windowMs: 1000, now })` で、t=0 に record 2 回 | `retryAfterSeconds` は null |
| 続けて t=0 に 3 回目の record | `retryAfterSeconds` は 1(ceil(1000/1000)) |
| limit 10・windowMs 900000 で、t=T に 10 回 record | t=T では 900、t=T+899001 では 1、t=T+900000 では null で、size は 0 |
| 窓が明けた後に record | count 1 から数え直す |
| `reset(key)` | そのキーの `retryAfterSeconds` は null。他のキーは変わらない |
| maxKeys 2 で、a(明けた)・b を持つ状態で c を record | a が消え、size 2 |
| maxKeys 2 で、a・b(どちらも窓内)を持つ状態で c を record | a(最古)が消え、size 2 |
| 匿名 A(project P を所有、Q と R の members、コメント 1 件)を、アカウント B(R の members:joined 5・last 50。A の R は joined 1・last 100)へ `mergeAnonymousUser` | P の owner_id は B。B の members は Q・R・P。R は joined 1・last 100。コメントの author_id は B。users の A 行、A のセッション、A の members は無い |
| from がアカウント / from === to / 存在しない from | Error。DB は変わらない |
| 登録済みのアカウントに、Cookie なしで正しい ID・パスワードで `POST /api/account/login` | 200 `Account`。Set-Cookie は 1 つで `Max-Age=2592000`。sessions に `expires_at = now + 2592000000` の行が増える |
| ログイン ID を大文字で送る(`"TANAKA"`) | 200(小文字に正規化) |
| 匿名 Cookie(project を作成済み)でログインする | 200。その project の owner_id はアカウントになり、`GET /api/projects` にアカウント側で出る。匿名ユーザーの users 行は消える。古い Cookie で `GET /api/account` すると、新しい匿名ユーザーになる |
| アカウント B の Cookie のまま、アカウント C でログインする | 200、C になる。B は統合されず、B の users 行とデータは残る。この端末の B のセッション行は消える |
| パスワード違い / 存在しない ID | どちらも 401 `UNAUTHORIZED`、本文は同じ(`"Invalid login ID or password"`)。Set-Cookie なし |
| 存在しない ID でログイン | `verifyPassword` が呼ばれている(ダミー照合)。ESM の export は `vi.spyOn` できないので、テストは `vi.mock("../src/identity/password", async (importOriginal) => { const actual = await importOriginal<typeof import("../src/identity/password")>(); return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) }; })` で包んで呼び出しを確かめる(このモックは `routes-account-login.test.ts` だけに書く) |
| `makeTestApp({ trustProxy: true })`、同じ IP・同じ ID で 10 回失敗した後、11 回目(正しいパスワード) | 429 `TOO_MANY_REQUESTS`、`Retry-After: 900`。ログインしない |
| 上の状態で、別の IP から同じ ID・正しいパスワード | 200(ID×IP 単位の制限なので、他人が本人をロックできない) |
| 同じ IP から 3 つの ID で合計 30 回失敗した後、4 つ目の ID で試す | 429(IP 単位) |
| 9 回失敗した後に成功し、また 9 回失敗する | 10 回目の失敗まで 401(成功で ID×IP のカウントが戻る) |
| 本文不正のログインを 20 回 | すべて 400。その後の正しいログインは 200(検証失敗は数えない) |
| 同じ IP から `POST /api/account/register` を 10 回(成功・失敗を問わず)した後の 11 回目 | 429、`Retry-After: 3600` |
| `POST /api/account/logout`(アカウント Cookie) | 204。Set-Cookie に `rv_session=` と `Max-Age=0`。そのセッション行は消える。同じ Cookie で `GET /api/account` すると新しい匿名ユーザーになる |
| Cookie なしで logout | 204 |
| ログイン・ログアウト・429 の応答 | `Cache-Control: no-store` がある |
| login の応答や DB に、パスワードの平文が含まれない | 含まれない |

## やらないこと
- パスワード変更・リセット・リカバリーコード再発行(186)
- 試行回数の DB への永続化(再起動でリセットされてよい)
- CAPTCHA、アカウントのロックアウト(ID 単位の全面停止)、通知
- web の変更
- 既存テストファイルと `tests/helpers/app.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server/server_Summary.md を更新している(追記 12 行以内。300 行を超えないこと)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
