---
id: 186
title: パスワード変更・リカバリーコードによるパスワードリセット・リカバリーコード再発行の API を作る
feature: server
depends_on: [185]
owns: [server/src/routes/account-password.ts, server/src/routes/account.ts, server/src/db/accounts.ts, server/src/db/users.ts, server/server_Summary.md, server/tests/routes-account-password.test.ts, server/tests/routes-account-reset.test.ts]
reads: [shared/src/account.ts, shared/src/api.ts, server/src/app.ts, server/src/identity/session.ts, server/src/identity/sign-in.ts, server/src/identity/rate-limit.ts, server/src/identity/password.ts, server/src/identity/recovery-code.ts, server/src/routes/account-login.ts, server/src/db/account-merge.ts, server/src/db/connection.ts, server/tests/helpers/app.ts, server/tests/routes-account-login.test.ts]
verify: npm run typecheck && npm run test
status: todo
---

## 目的
- ログイン中のユーザーがパスワードを変えられるようにする
- パスワードを忘れたときは、登録時に受け取ったリカバリーコードで新しいパスワードを設定できるようにする
- パスワードを変えたりリセットしたりしたら、ほかの端末のセッションはすべて無効にする
- リセット経路は「本人確認の手段 + 新しいパスワード」の形にしておく。将来メールによる本人確認を足すときは、
  本人確認の部分だけを差し替えればよい

## 前提
- shared の `ChangePasswordInput`・`ResetPasswordInput`・`RegenerateRecoveryCodeInput`・`passwordEqualsLoginId`・
  `AccountWithRecoveryCode` は 184 で `shared/src/account.ts` に定義済み。
  `ResetPasswordInput` は newPassword とログイン ID が等しい場合を検証で弾くが、`ChangePasswordInput` は弾かない
  (スキーマがログイン ID を知らないため、ルート側で検査する)
- `RecoveryCodeInputSchema` を通した recoveryCode は、区切りなしの 16 進小文字 32 桁になっている
- 185 までに次がある
  - `resolveUserId`・`rotateSession`・`identityDepsFrom`(`server/src/identity/session.ts`)
  - `signIn(c, deps, accountUserId)`:匿名データの統合とセッション発行。`server/src/identity/sign-in.ts`
  - `AuthLimiters` と `tooManyRequests`:`server/src/identity/rate-limit.ts`
  - `accountRoutes` の中でルート生成ごとに作る limiters(`server/src/routes/account.ts`)
- `hashRecoveryCode` / `recoveryCodeMatches` / `generateRecoveryCode` は `server/src/identity/recovery-code.ts`、
  `hashPassword` / `verifyPassword` は `server/src/identity/password.ts` にある
- 185 のログインは、ID が存在しない場合もダミーの照合を行い、401 を同じ本文で返している。リセットも同じ方針にする
- `withTransaction` は入れ子にできず、`rotateSession` と `signIn` は内部で `withTransaction` を使う。
  **この 2 つは、自分の `withTransaction` を閉じた後で呼ぶ**
- `makeTestApp({ trustProxy: true })` にすると、`X-Forwarded-For` の最後の値が接続元 IP になる
- 185 の制限で、register は同じ IP から 1 時間に 10 回まで(テストの now は固定なので、1 つのテストアプリの中で 10 回まで)。
  ログインの失敗も同じアプリ内で数えられる。テストはケースごとにアプリを作り直す

## インターフェイス契約

### `server/src/db/accounts.ts`(追加)

```ts
export function setPasswordHash(db: Db, userId: string, passwordHash: string): void;
export function setRecoveryCodeHash(db: Db, userId: string, recoveryCodeHash: string): void;
```

### `server/src/db/users.ts`(追加)

```ts
/** userId のセッションをすべて消す */
export function deleteSessionsOfUser(db: Db, userId: string): void;
```

### `server/src/routes/account-password.ts`(新規)

```ts
export function accountPasswordRoutes(deps: Required<AppDeps>, limiters: AuthLimiters): Hono;
```
`account.ts` で `routes.route("/", accountPasswordRoutes(deps, limiters))` としてぶら下げる。
回数制限のキーは、ID×IP 側を `"<キーの主体>|<ip>"`、IP 側を `"<ip>"` とする。
制限の確認と 429 の返し方は、185 の login と同じ(確認は照合より前。失敗したときだけ両方を record し、成功したら ID×IP 側を reset)。

#### `POST /password`(パスワード変更)
1. `ChangePasswordInput.parse`(400 `VALIDATION`)
2. `userId = resolveUserId(c, deps)`。`creds = findCredentialsByUserId(userId)`。
   どちらかが null(未ログイン・匿名)なら 401 `UNAUTHORIZED`(`"Sign in required"`)
3. `passwordEqualsLoginId(newPassword, creds.loginId)` なら 400 `VALIDATION`
4. 回数制限(キーの主体は userId)。上限なら 429
5. `verifyPassword(currentPassword, creds.passwordHash)` が false なら、record して 403 `FORBIDDEN`(`"Current password is incorrect"`)
6. 新しいハッシュを await で計算した後、`withTransaction` で `setPasswordHash` と `deleteSessionsOfUser(userId)` を行う
7. `rotateSession(c, identityDepsFrom(deps), userId, "account")` で、この端末だけ新しいセッションにする
8. 200 `findAccount(userId)`。リカバリーコードは変えない

#### `POST /password-reset`(リカバリーコードによるリセット)
1. `ResetPasswordInput.parse`(400 `VALIDATION`)
2. 回数制限(キーの主体は loginId)。上限なら 429
3. `creds = findCredentialsByLoginId(loginId)`。creds があれば `recoveryCodeMatches(recoveryCode, creds.recoveryCodeHash)`。
   無ければ、固定のダミーハッシュ(64 桁の "0")に対して `recoveryCodeMatches` を実行した上で失敗とする
4. 失敗なら record して 401 `UNAUTHORIZED`(`"Invalid login ID or recovery code"`)。ID が無い場合も同じ本文にする
5. 成功したら、`hashPassword` を await で計算し、新しいコード `deps.newRecoveryCode()` を作る。その後 `withTransaction` で次を行う
   - `setPasswordHash`
   - `setRecoveryCodeHash(hashRecoveryCode(newCode))`(使ったコードは無効になる)
   - `deleteSessionsOfUser(creds.userId)`
6. ID×IP 側を reset してから、`signIn(c, identityDepsFrom(deps), creds.userId)` を呼ぶ
   (この端末をログイン状態にする。匿名 Cookie ならデータを統合する)
7. 200 `{ account: findAccount(creds.userId), recoveryCode: newCode }`

#### `POST /recovery-code`(リカバリーコード再発行)
1. `RegenerateRecoveryCodeInput.parse`(400)
2. 未ログイン・匿名なら 401 `UNAUTHORIZED`(`"Sign in required"`)
3. 回数制限(キーの主体は userId)。上限なら 429
4. `verifyPassword(password, creds.passwordHash)` が false なら、record して 403 `FORBIDDEN`(`"Current password is incorrect"`)
5. `setRecoveryCodeHash(hashRecoveryCode(newCode))`。セッションはそのまま
6. 200 `{ account, recoveryCode: newCode }`

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| アカウント Cookie で `POST /api/account/password` `{ currentPassword: 正, newPassword: "new password 1" }` | 200 `Account`。Set-Cookie は新しいトークン(`Max-Age=2592000`)。以降は新しいパスワードでログインでき、古いパスワードは 401 |
| 同じアカウントで 2 つの端末(Cookie A・B)にログインしていて、A でパスワードを変更 | B の Cookie で `GET /api/account` すると `loginId: null`(匿名になる)。A の古いトークンも無効で、A は新しい Set-Cookie のトークンで `loginId` が返る |
| 現在のパスワードが違う | 403 `FORBIDDEN`。パスワードは変わらない |
| Cookie なし・匿名 Cookie で変更 | 401 `UNAUTHORIZED` |
| newPassword がログイン ID と同じ(大小文字違いを含む)/ 7 文字 | 400 `VALIDATION` |
| `trustProxy`、同じ IP で現在のパスワードを 10 回間違えた後の 11 回目(正しいパスワード) | 429、`Retry-After: 900` |
| Cookie なしで `POST /api/account/password-reset` `{ loginId, recoveryCode: 登録時のコード, newPassword }` | 200。`recoveryCode` は新しいコードで、登録時のものと異なる。Set-Cookie あり、`account.loginId` が返る。新しいパスワードでログインでき、古いパスワードは 401 |
| 同じリカバリーコードでもう一度リセット | 401 `UNAUTHORIZED`(使ったコードは無効) |
| 新しいコードでリセット | 200 |
| リカバリーコードを大文字・区切りなしで入力 | 200(正規化される) |
| リセット前にほかの端末でログインしていたセッション | 無効になる(`GET /api/account` で `loginId: null`) |
| 匿名 Cookie(project を作成済み)でリセットする | その project の owner_id がアカウントになる(185 の統合) |
| コード違い / 存在しないログイン ID | どちらも 401、本文は同じ(`"Invalid login ID or recovery code"`)。DB は変わらない |
| 同じ IP・同じ ID でコードを 10 回間違えた後の 11 回目(正しいコード) | 429 |
| newPassword がログイン ID と同じ | 400 `VALIDATION` |
| アカウント Cookie で `POST /api/account/recovery-code` `{ password: 正 }` | 200。新しいコードが返り、古いコードでのリセットは 401、新しいコードでは 200。セッションは変わらない(Set-Cookie なし) |
| recovery-code でパスワード違い / 未ログイン | 403 / 401 |
| 3 つの API の応答 | `Cache-Control: no-store`。応答と DB にパスワード・コードの平文が含まれない(コードは応答の recoveryCode だけ) |

## やらないこと
- メールによるリセット(将来。今回は経路の形だけ差し替えやすくしておく)
- 管理者による強制リセット・CLI
- リカバリーコードの複数発行
- web の変更
- 既存テストファイルと `tests/helpers/app.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server/server_Summary.md を更新している(追記 10 行以内。300 行を超えないこと)。
      「将来メール認証を足すときは password-reset の本人確認部分を差し替える」旨を申し送りに書く
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
