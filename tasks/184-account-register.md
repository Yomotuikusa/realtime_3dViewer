---
id: 184
title: ログインIDとパスワードでアカウント登録する API と、自分のアカウント情報・表示名の API を作る
feature: server
depends_on: [182, 183]
owns: [shared/src/account.ts, shared/src/index.ts, shared/src/api.ts, shared/shared_Summary.md, shared/tests/account.test.ts, shared/tests/api.test.ts, server/src/db/schema.sql, server/src/db/connection.ts, server/src/db/users.ts, server/src/db/accounts.ts, server/src/identity/password.ts, server/src/identity/recovery-code.ts, server/src/identity/session.ts, server/src/routes/account.ts, server/src/app.ts, server/server_Summary.md, server/tests/helpers/app.ts, server/tests/password.test.ts, server/tests/recovery-code.test.ts, server/tests/db-account.test.ts, server/tests/routes-account-register.test.ts]
reads: [shared/src/types.ts, shared/src/protocol.ts, shared/src/project-list.ts, shared/tests/index.test.ts, server/src/routes/project-manage.ts, server/src/http-security.ts, server/src/config.ts, server/tests/db-migrate.test.ts, server/tests/db-identity.test.ts, server/tests/routes-project-identity.test.ts, server/tests/routes-project-manage.test.ts, server/tests/app-body-limit.test.ts]
verify: npm run typecheck && npm run test
status: todo
---

## 目的
いまは匿名ユーザー(Cookie)だけで、Cookie を失ったり別の端末から開いたりすると別人になる。
ユーザーが決める一意の**ログインID**とパスワードでアカウント登録できるようにする。

- 登録は「今の匿名ユーザーへのログインID付与(昇格)」とする。内部の `users.id` は変えないので、
  それまでの一覧・所有・コメントはそのまま引き継がれる
- パスワードは scrypt でハッシュ化し、平文はどこにも保存・出力しない
- パスワードを忘れたときのために、登録時に**リカバリーコード**を 1 回だけ返す(使うのは 186)
- 後続のタスクで使う shared のスキーマ(ログイン・パスワード変更・リセット)も、ここで全部定義する

## 前提
- `migrate` は schema.sql を丸ごと実行した後に `addColumnIfMissing` を呼ぶ(`server/src/db/connection.ts`)。
  後から足す列は **schema.sql の CREATE 文と `addColumnIfMissing` の両方**に書く。
  schema.sql は旧定義の DB に対しても最初に実行されるため、**新しい列を参照する INDEX を schema.sql に書いてはならない**。
  ログインID の UNIQUE INDEX は `migrate` の中で、`addColumnIfMissing` の後に `db.exec` で作る
- SQLite の UNIQUE INDEX は NULL を何行でも許す(匿名ユーザーは login_id が NULL)
- 既存テストは `INSERT INTO users (id, created_at)` と `INSERT INTO sessions (token_hash, user_id, created_at)` を
  生 SQL で書いている(`routes-project-manage.test.ts:40-45` など)。**追加する列はすべて nullable** にする
- `db-identity.test.ts` は `findUserIdBySessionHash(db, hash)` と `insertSession(db, { tokenHash, userId, createdAt })` を呼ぶ。
  **この 2 つの既存シグネチャは変えずに通すこと**(期限の判定は新しい関数で行う)
- 182 で `identityDepsFrom(deps)`・`ensureUser`・`SESSION_COOKIE` が `server/src/identity/session.ts` にある。
  `ensureUser` は `withTransaction` の内側で呼んではならない。`withTransaction` は入れ子にできない
- 182 で `/api/*` の非 GET に Origin 検査が掛かり、https 運用時の Cookie には Secure が付く(`identityDepsFrom` 経由)
- `server/src/routes/project-manage.ts` の `parseJson`(不正な JSON は 400 `VALIDATION`)と同等の関数を、routes/account.ts に置く
- `shared/tests/api.test.ts:98` は `Object.values(ErrorCode)` の件数を 7 と検査している。本タスクで 10 に書き換える
- `shared/tests/index.test.ts` は公開名の存在だけを検査するので、index.ts に `export *` を足しても落ちない
- `MAX_NAME_LENGTH`(50)は `shared/src/protocol.ts:30`、`IdSchema` は `shared/src/types.ts:172`
- zod 4.5 では `z.string().trim().toLowerCase().regex(...)` で、正規化してから検査できる(実測済み)
- scrypt の実測値:N=2^15, r=8, p=3 は約 120ms、N=2^10, r=8, p=1 は約 1ms。
  Node の scrypt は `maxmem` の既定が 32MiB で、N=2^15・r=8 は必要量(128·N·r = 32MiB)を超えるため、`maxmem` の指定が要る
- `makeTestApp` は `newId` を `t.ids` から払い出す。識別・アカウント処理で `newId` を使ってはならない
  (ユーザー id は `newUserId`、トークンは `newSessionToken`、リカバリーコードは `newRecoveryCode`)
- Hono の `c.header()` を `await next()` の後で呼ぶと、onError の応答にも付く(app.ts の nosniff と同じ)

## インターフェイス契約

### `shared/src/account.ts`(新規。`shared/src/index.ts` から `export *`)

```ts
import { z } from "zod";
import { MAX_NAME_LENGTH } from "./protocol";
import { IdSchema } from "./types";

export const LOGIN_ID_PATTERN = /^[a-z0-9_-]{3,32}$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
/** "xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx"(16 進小文字 32 桁を 4 桁ずつ区切る) */
export const RECOVERY_CODE_PATTERN = /^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/;

/** 前後の空白を除き、小文字にしてから LOGIN_ID_PATTERN を検査する */
export const LoginIdSchema = z.string().trim().toLowerCase().regex(LOGIN_ID_PATTERN);
/** 新しく設定するパスワード。trim しない */
export const NewPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);
/** 照合用に入力されたパスワード(長さの下限は課さない) */
export const PasswordInputSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);
export const DisplayNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
/** 空白と "-" を除き、小文字にしてから 16 進 32 桁を検査する。出力は区切りなしの 32 桁 */
export const RecoveryCodeInputSchema = z.string()
  .transform((value) => value.replace(/[\s-]/g, "").toLowerCase())
  .pipe(z.string().regex(/^[0-9a-f]{32}$/));

/** password.normalize("NFKC").toLowerCase() が loginId と等しければ true */
export function passwordEqualsLoginId(password: string, loginId: string): boolean;

export const RegisterAccountInput = z.object({
  loginId: LoginIdSchema,
  password: NewPasswordSchema,
  displayName: DisplayNameSchema.optional(),
}).superRefine((value, ctx) => {
  if (passwordEqualsLoginId(value.password, value.loginId)) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Password must differ from login ID" });
  }
});
export type RegisterAccountInput = z.infer<typeof RegisterAccountInput>;

export const LoginInput = z.object({ loginId: LoginIdSchema, password: PasswordInputSchema });
export type LoginInput = z.infer<typeof LoginInput>;

export const UpdateAccountInput = z.object({ displayName: DisplayNameSchema });
export type UpdateAccountInput = z.infer<typeof UpdateAccountInput>;

/** 186 で使う。currentPassword は照合用、newPassword は新規設定用 */
export const ChangePasswordInput = z.object({
  currentPassword: PasswordInputSchema,
  newPassword: NewPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

/** 186 で使う */
export const ResetPasswordInput = z.object({
  loginId: LoginIdSchema,
  recoveryCode: RecoveryCodeInputSchema,
  newPassword: NewPasswordSchema,
}).superRefine((value, ctx) => {
  if (passwordEqualsLoginId(value.newPassword, value.loginId)) {
    ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Password must differ from login ID" });
  }
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

/** 186 で使う */
export const RegenerateRecoveryCodeInput = z.object({ password: PasswordInputSchema });
export type RegenerateRecoveryCodeInput = z.infer<typeof RegenerateRecoveryCodeInput>;

/** 自分のアカウント情報。匿名ユーザーは loginId が null */
export interface Account {
  userId: string;
  loginId: string | null;
  displayName: string | null;
}
export const AccountSchema = z.object({
  userId: IdSchema,
  loginId: z.string().regex(LOGIN_ID_PATTERN).nullable(),
  displayName: z.string().min(1).max(MAX_NAME_LENGTH).nullable(),
}) satisfies z.ZodType<Account>;

/** 登録・リセット・再発行の応答。recoveryCode はこの応答でしか得られない */
export interface AccountWithRecoveryCode {
  account: Account;
  recoveryCode: string;
}
export const AccountWithRecoveryCodeSchema = z.object({
  account: AccountSchema,
  recoveryCode: z.string().regex(RECOVERY_CODE_PATTERN),
}) satisfies z.ZodType<AccountWithRecoveryCode>;
```
### `shared/src/api.ts`

```ts
export const ErrorCode = {
  // ...既存の 7 つ...
  CONFLICT: "CONFLICT",
  UNAUTHORIZED: "UNAUTHORIZED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
} as const;
```
`TOO_MANY_REQUESTS` は 185 で使う。本タスクでは定義だけ行う。

### `server/src/db/schema.sql` と `connection.ts`
- users の CREATE に `login_id TEXT`, `password_hash TEXT`, `display_name TEXT`, `recovery_code_hash TEXT` を足す
- sessions の CREATE に `expires_at INTEGER` を足す(NULL は無期限 = 匿名セッション)
- `migrate` に次を足す。既存の 2 行の後に並べる
  - 上の 5 列それぞれの `addColumnIfMissing`
  - 最後に `db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id)")`

### `server/src/identity/password.ts`(新規)

```ts
export interface ScryptParams { logN: number; r: number; p: number }
/** OWASP の推奨値の一つ(N=2^15, r=8, p=3) */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { logN: 15, r: 8, p: 3 };

/**
 * password.normalize("NFKC") を scrypt でハッシュ化する。salt は randomBytes(16)、鍵長 64。
 * maxmem は 256 * 2^logN * r。
 * 形式: "scrypt$<logN>$<r>$<p>$<salt base64url>$<hash base64url>"
 */
export function hashPassword(password: string, params?: ScryptParams): Promise<string>;

/**
 * stored に書かれたパラメータで password.normalize("NFKC") を再計算し、timingSafeEqual で比べる。
 * 形式が壊れている(区切り数・数値・logN が 10〜20 の外・base64url として不正・長さ不一致)なら false。例外は投げない。
 */
export function verifyPassword(password: string, stored: string): Promise<boolean>;
```
scrypt は `node:crypto` のコールバック版を Promise で包んで使う(同期版はイベントループを止めるので使わない)。

### `server/src/identity/recovery-code.ts`(新規)

```ts
/** randomBytes(16) を 16 進小文字にして 4 桁ずつ "-" で区切る(RECOVERY_CODE_PATTERN に一致) */
export function generateRecoveryCode(): string;
/** 空白と "-" を除いて小文字にした 32 桁の SHA-256(16 進小文字 64 文字) */
export function hashRecoveryCode(code: string): string;
/** hashRecoveryCode(code) と storedHash を timingSafeEqual で比べる。長さが違えば false */
export function recoveryCodeMatches(code: string, storedHash: string): boolean;
```

### `server/src/db/users.ts`(追加・変更)

```ts
/** expiresAt を省略・null にすると NULL(既存の呼び出しはそのまま通る) */
export function insertSession(
  db: Db,
  input: { tokenHash: string; userId: string; createdAt: number; expiresAt?: number | null },
): void;
/** tokenHash のセッション。無ければ null。期限の判定はしない */
export function findSession(db: Db, tokenHash: string): { userId: string; expiresAt: number | null } | null;
export function deleteSession(db: Db, tokenHash: string): void;
```
`insertUser` と `findUserIdBySessionHash` は変えない。

### `server/src/db/accounts.ts`(新規)

```ts
import type { Account } from "@shared/account";

export interface AccountCredentials {
  userId: string;
  loginId: string;
  passwordHash: string;
  recoveryCodeHash: string;
}

/** users 行が無ければ null。匿名ユーザーは loginId: null で返す */
export function findAccount(db: Db, userId: string): Account | null;
/** login_id が一致するアカウント。無ければ null */
export function findCredentialsByLoginId(db: Db, loginId: string): AccountCredentials | null;
/** userId がアカウント(login_id あり)なら資格情報、匿名・不在なら null */
export function findCredentialsByUserId(db: Db, userId: string): AccountCredentials | null;
export function isLoginIdTaken(db: Db, loginId: string): boolean;
/** login_id・password_hash・recovery_code_hash を設定する。displayName を省略したら display_name は変えない */
export function setAccountCredentials(
  db: Db,
  input: { userId: string; loginId: string; passwordHash: string; recoveryCodeHash: string; displayName?: string },
): void;
export function setDisplayName(db: Db, userId: string, displayName: string): void;
```

### `server/src/identity/session.ts`(追加・変更)

```ts
/** アカウントセッションの有効期間(秒)。30 日 */
export const ACCOUNT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Cookie のセッションが有効なら user id を返す。Cookie が無い・未知なら null。
 * expires_at が now() 以下なら、そのセッション行を消して null を返す。ユーザーやセッションを作らない。
 */
export function resolveUserId(c: Context, deps: Pick<IdentityDeps, "db" | "now">): string | null;

/**
 * 今の Cookie のセッション行があれば消し(他人の行でも)、userId の新しいセッションを発行して Set-Cookie する。
 * kind が "account" なら expires_at = now() + ACCOUNT_SESSION_MAX_AGE_SECONDS * 1000、Max-Age = ACCOUNT_SESSION_MAX_AGE_SECONDS。
 * "anonymous" なら expires_at = NULL、Max-Age = SESSION_MAX_AGE_SECONDS。
 * Cookie の属性は ensureUser と同じ(HttpOnly・SameSite=Lax・Path=/・secureCookie なら Secure)。
 * DB の更新は内部の withTransaction で行うので、withTransaction の内側から呼んではならない。
 */
export function rotateSession(
  c: Context,
  deps: IdentityDeps,
  userId: string,
  kind: "anonymous" | "account",
): void;
```
`ensureUser` は最初に `resolveUserId` を使う。期限切れのセッションは Cookie が無いのと同じ扱いになり、匿名ユーザーを新しく作る。

### `server/src/app.ts`

```ts
export interface AppDeps {
  // ...既存...
  /** パスワードハッシュのパラメータ。既定は DEFAULT_SCRYPT_PARAMS */
  passwordParams?: ScryptParams;
  /** リカバリーコードの生成。既定は generateRecoveryCode */
  newRecoveryCode?: () => string;
}
```
- `/api/account` と `/api/account/*` に、`validateContentLength` と `bodyLimit({ maxSize: MAX_JSON_BODY_BYTES })` を掛ける
- `app.route("/api/account", accountRoutes(resolved))`

### `server/tests/helpers/app.ts`
`makeTestApp` の deps に `passwordParams: { logN: 10, r: 8, p: 1 }` を足す。**ほかは変えない**。

### `server/src/routes/account.ts`(新規)

```ts
export function accountRoutes(deps: Required<AppDeps>): Hono;
```
すべての応答(エラーも含む)に `Cache-Control: no-store` を付ける(`routes.use("*")` で `await next()` の後に `c.header`)。

| メソッドとパス | 処理順 | 成功 |
| --- | --- | --- |
| `GET /` | ① `ensureUser(c, identityDepsFrom(deps))` ② `findAccount` | 200 `Account` |
| `PATCH /` | ① `UpdateAccountInput.parse`(不正な JSON・値は 400 `VALIDATION`)② `ensureUser` ③ `setDisplayName` | 200 `Account` |
| `POST /register` | 下記 | 201 `AccountWithRecoveryCode` |

`POST /register` の処理順:
1. `RegisterAccountInput.parse`(400 `VALIDATION`)
2. `passwordHash = await hashPassword(input.password, deps.passwordParams)`、`recoveryCode = deps.newRecoveryCode()`
   (await の後に DB を読むため、ここから先は await しない)
3. `current = resolveUserId(c, deps)`
4. `current` があり、そのユーザーの `loginId` が null でなければ 409 `CONFLICT`(`"Already registered"`)
5. `isLoginIdTaken` なら 409 `CONFLICT`(`"Login ID is already taken"`)
6. `withTransaction` の中で、次を行う
   - `current` が null なら `insertUser({ id: deps.newUserId(), createdAt: deps.now() })` し、それを userId とする
   - `setAccountCredentials({ userId, loginId, passwordHash, recoveryCodeHash: hashRecoveryCode(recoveryCode), displayName })`
   - 並行する登録で UNIQUE 制約違反(メッセージに `UNIQUE constraint failed: users.login_id` を含む)が出たら、
     5 と同じ 409 にする。ほかの例外はそのまま投げる
7. `rotateSession(c, identityDepsFrom(deps), userId, "account")`(セッション固定化の対策)
8. 201 `{ account: findAccount(userId), recoveryCode }`

パスワード・ハッシュ・リカバリーコード・トークンをログに出さない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `LoginIdSchema.parse("  Tanaka_1 ")` | `"tanaka_1"` |
| `LoginIdSchema` に `"ab"`・33 文字・`"たなか"`・`"a b c"` | 失敗 |
| `NewPasswordSchema` に 7 文字 / 8 文字 / 128 文字 / 129 文字 | 失敗 / 成功 / 成功 / 失敗 |
| `RegisterAccountInput` に `{ loginId: "tanaka12", password: "Tanaka12" }` | 失敗(issue の path が `["password"]`) |
| `ResetPasswordInput` で newPassword が loginId と等しい | 失敗(path `["newPassword"]`) |
| `RecoveryCodeInputSchema.parse("ABCD-ef01-2345-6789-abcd-ef01-2345-6789")` | `"abcdef0123456789abcdef0123456789"` |
| `RecoveryCodeInputSchema` に 31 桁・`"g"` を含む | 失敗 |
| `Object.values(ErrorCode)` | 10 件で `CONFLICT`・`UNAUTHORIZED`・`TOO_MANY_REQUESTS` を含む |
| `hashPassword("password1", { logN: 10, r: 8, p: 1 })` | `scrypt$10$8$1$` で始まり、`$` 区切りで 6 要素。同じ入力を 2 回ハッシュすると結果が異なる |
| そのハッシュを `verifyPassword("password1", …)` / `("password2", …)` | true / false |
| `verifyPassword("password１", hashPassword("password1"))`(全角数字) | true(NFKC 正規化) |
| `verifyPassword("x", "garbage")`・`"scrypt$99$8$1$aa$bb"`・`"bcrypt$..."` | false(例外なし) |
| `hashPassword("password1")`(既定パラメータ) | `scrypt$15$8$3$` で始まり、verify が true(maxmem 不足で例外にならない) |
| `generateRecoveryCode()` | `RECOVERY_CODE_PATTERN` に一致。2 回呼ぶと異なる |
| `recoveryCodeMatches("ABCD EF01-...", hashRecoveryCode("abcd-ef01-..."))`(区切り・大小文字違い) | true。1 桁違いは false、storedHash が 64 文字でなければ false |
| 旧定義(178 時点:users に id・created_at だけ、sessions に expires_at なし)の DB に `migrate` | 5 列が足され、既存行は NULL。`idx_users_login_id` ができる。2 回 `migrate` しても例外にならない |
| login_id が同じ users 行を 2 つ作る | UNIQUE 制約違反で例外。login_id NULL の行は複数作れる |
| `findAccount` を匿名ユーザー / 不在の id で | `{ userId, loginId: null, displayName: null }` / null |
| Cookie なしで `GET /api/account` | 200 `{ userId: <新しい id>, loginId: null, displayName: null }`。Set-Cookie あり。`Cache-Control: no-store` |
| 同じ Cookie で `PATCH /api/account` `{ "displayName": "  Taro " }` | 200、`displayName: "Taro"`。Set-Cookie なし |
| `PATCH` に `displayName: ""`・51 文字・不正 JSON | 400 `VALIDATION`。`Cache-Control: no-store` がある |
| Cookie なしで `POST /api/account/register` `{ loginId: "Tanaka", password: "correct horse", displayName: "田中" }` | 201。`account.loginId: "tanaka"`、`displayName: "田中"`、`recoveryCode` は `RECOVERY_CODE_PATTERN` に一致。Set-Cookie はちょうど 1 つで、`Max-Age=2592000`・`HttpOnly`・`SameSite=Lax`・`Path=/`。users は 1 行、sessions は 1 行で `expires_at = 1700000000000 + 2592000000` |
| 上の直後の DB | `password_hash` は `scrypt$10$8$1$` で始まり、平文 `correct horse` をどの列にも含まない。`recovery_code_hash` は `hashRecoveryCode(recoveryCode)` と一致し、コードの平文を含まない |
| 匿名 Cookie(project を 1 つ作成済み)で register | 201。`account.userId` は匿名時の id と同じ。`projects.owner_id` と `project_members` はそのまま。古いセッション行は消え、Set-Cookie のトークンは古いものと異なる |
| register 時に displayName を省略し、事前に PATCH で `"Taro"` を設定済み | `displayName: "Taro"` のまま |
| アカウントの Cookie で、もう一度 register | 409 `CONFLICT`。DB は変わらない |
| 既に使われている loginId(大小文字違い `"TANAKA"` を含む)で register | 409 `CONFLICT`。新しい users 行もセッションもできない |
| 期限切れ(`expires_at` ≤ now)のアカウントセッションの Cookie で `GET /api/account` | そのセッション行は消え、新しい匿名ユーザーが作られ、`loginId: null` が返る |
| 期限切れの Cookie で register | 新しいユーザーとして登録される(期限切れのアカウントは変わらない) |
| password が loginId と同じ、7 文字、不正 JSON の register | 400 `VALIDATION`。users は増えない |
| `Origin: http://evil.example` の register | 403(182 の検査)。users は 0 行 |
| `t.ids = ["p1", "v1"]` で register の後に `POST /api/projects` | project id は `p1`、版 id は `v1`(アカウント処理が newId を消費しない) |

## やらないこと
- ログイン・ログアウト・試行回数制限・匿名データの統合(185)
- パスワード変更・リセット・リカバリーコード再発行の API(186。ここでは shared のスキーマだけを作る)
- web の変更(187〜189)
- `Comment` 型・`shared/src/types.ts` の変更
- 既存テストファイルの変更(`shared/tests/api.test.ts` の件数と、`tests/helpers/app.ts` の passwordParams の追加を除く)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] 既存の shared / server テストが通る
- [ ] shared_Summary.md と server_Summary.md を更新している(server は追記 15 行以内。300 行を超えないこと)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
