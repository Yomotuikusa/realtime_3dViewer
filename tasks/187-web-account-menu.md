---
id: 187
title: 一覧画面にアカウントメニュー(登録・ログイン・ログアウト、リカバリーコードの表示)を追加する
feature: account
depends_on: [184]
owns: [web/src/api/account.ts, web/src/api/client.ts, web/web_Summary.md, web/tests/api-account.test.ts, web/src/features/account/AccountMenu.tsx, web/src/features/account/LoginDialog.tsx, web/src/features/account/RegisterDialog.tsx, web/src/features/account/RecoveryCodeDialog.tsx, web/src/features/account/account-labels.ts, web/src/features/account/account.css, web/src/features/account/account_Summary.md, web/tests/account-labels.test.ts, web/tests/account-menu.test.ts, web/tests/account-dialogs.test.ts, web/src/features/projects/ProjectListPage.tsx, web/src/features/projects/projects.css, web/src/features/projects/projects_Summary.md, web/tests/project-list-page.test.ts, web/tests/project-list-account.test.ts]
reads: [shared/src/account.ts, shared/src/api.ts, shared/src/protocol.ts, web/src/app/display-name.ts, web/src/app/review.css, web/src/features/projects/RenameProjectDialog.tsx, web/src/features/projects/projects-labels.ts, web/src/features/comments/comment-labels.ts, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/api-projects.test.ts, web/tests/api-client.test.ts, web/tests/theme-effect.test.ts, web/tests/ui-layers.test.ts, docs/DESIGN_SKILL.md]
verify: npm run typecheck && npm run test
status: todo
---

## 目的
184・185 のアカウント API を画面から使えるようにする。一覧画面(`/`)の見出しの右に、次を出す。
- 匿名のとき:「ログイン」「アカウント登録」
- ログイン中:表示名・`@ログインID`・「ログアウト」

登録に成功したら、リカバリーコードを 1 回だけ表示し、保存を促す。
ログイン・ログアウトで利用者が変わったら、一覧を読み直す。

## 前提
- API(184・185。すべて同一オリジン、Cookie は既定で送られる)
  | メソッドとパス | 本体 | 成功 |
  | --- | --- | --- |
  | `GET /api/account` | なし | 200 `Account`(匿名は `loginId: null`) |
  | `PATCH /api/account` | `{ displayName }` | 200 `Account` |
  | `POST /api/account/register` | `{ loginId, password, displayName? }` | 201 `AccountWithRecoveryCode` |
  | `POST /api/account/login` | `{ loginId, password }` | 200 `Account` |
  | `POST /api/account/logout` | なし | 204 本文なし |
- エラーの code(`shared/src/api.ts`)
  - 登録:ログインID 重複は 409 `CONFLICT`
  - ログイン:ID かパスワードの誤りは 401 `UNAUTHORIZED`
  - 回数制限:429 `TOO_MANY_REQUESTS`
  - 入力不正:400 `VALIDATION`
- 185 のログイン API はまだ無い可能性がある(並列実行)。web のテストはすべて fetch か API モジュールをモックするので影響しない
- `Account`・`AccountSchema`・`AccountWithRecoveryCodeSchema`・`LoginIdSchema`・`passwordEqualsLoginId`・
  `MIN_PASSWORD_LENGTH`・`MAX_PASSWORD_LENGTH` は `shared/src/account.ts`(184)にある。`MAX_NAME_LENGTH` は `shared/src/protocol.ts`
- `web/src/api/client.ts` の `requestJson(path, init, schema)` と `requestNoContent(path, init)` は、いまは非公開関数。
  本タスクで `export` を付けて `web/src/api/account.ts` から使う(中身は変えない)。
  JSON を送る形は `renameProject`(`client.ts:124-134`)に倣う
- 表示名の保存は `saveName(name)`(`web/src/app/display-name.ts`)。入室ダイアログの初期値になる
- ダイアログの構造は `RenameProjectDialog`(`web/src/features/projects/RenameProjectDialog.tsx`)に倣う
  - `.review-backdrop` + `.review-dialog`、`role="dialog"`、`aria-modal`
  - `import "../../app/review.css";`
  - キャンセルは `CANCEL_LABEL`(`web/src/features/comments/comment-labels.ts`)
- `.review-backdrop` は `position: absolute` なので、account.css に `.account-dialog__backdrop { position: fixed; }` を置く。
  **account.css に数値の z-index を書かない**(`web/tests/ui-layers.test.ts` の方針)
- 既存テストの罠
  - `web/tests/project-list-page.test.ts` は `vi.mock("../src/api/client", () => ({ listProjects: vi.fn() }))` だけで
    ProjectListPage を描画している。"retries after a failed request"(88-99 行)は、`host.querySelector("button")` で
    **ページ内の最初のボタン**を再読み込みボタンとしてクリックする。
    本タスクで、このファイルに `vi.mock("../src/api/account", ...)` を足す。beforeEach で
    `getAccount` を**解決しない Promise** にし(メニューは何も描画しない)、既存のテストを期待値を変えずに通す
  - `web/tests/theme-effect.test.ts:136-164` は App を `/` でモックなしに描画する(fetch は失敗する)。
    AccountMenu は `getAccount` の失敗を catch して何も描画せず、未処理の Promise 拒否を出してはならない。このファイルは変更しない
- web のコンポーネントテストは jsdom 上で `createRoot` + `act` で描画する(`project-list-page.test.ts` の `render` に倣う)。
  fetch のスタブは `vi.stubGlobal("fetch", fetchMock)`(`web/tests/api-projects.test.ts`)に倣う
- 文言・色・余白は `tokens.css` のトークンと、`controls.css` の `.btn` / `.field` / `.input` / `.alert` を使う

## インターフェイス契約

### `web/src/api/account.ts`(新規)

```ts
import type { Account, AccountWithRecoveryCode } from "@shared/account";

/** GET /api/account を AccountSchema で検証して返す */
export function getAccount(): Promise<Account>;
/** PATCH /api/account { displayName } */
export function updateDisplayName(displayName: string): Promise<Account>;
/** POST /api/account/register。displayName が undefined ならキーを送らない */
export function registerAccount(input: {
  loginId: string;
  password: string;
  displayName?: string;
}): Promise<AccountWithRecoveryCode>;
/** POST /api/account/login */
export function login(input: { loginId: string; password: string }): Promise<Account>;
/** POST /api/account/logout。成功時の本文は読まない */
export function logout(): Promise<void>;
```
POST / PATCH は `headers: { "Content-Type": "application/json" }`、`body: JSON.stringify(input)`。
エラーは既存と同じ `ApiClientError(status, code, message)`。

### `web/src/features/account/account-labels.ts`

```ts
export const LOGIN_LABEL = "ログイン";
export const REGISTER_LABEL = "アカウント登録";
export const LOGOUT_LABEL = "ログアウト";
export const LOGIN_DIALOG_TITLE = "ログイン";
export const REGISTER_DIALOG_TITLE = "アカウント登録";
export const LOGIN_ID_LABEL = "ログインID";
export const PASSWORD_LABEL = "パスワード";
export const PASSWORD_CONFIRM_LABEL = "パスワード(確認)";
export const DISPLAY_NAME_LABEL = "表示名(任意)";
export const LOGIN_ID_HINT = "3〜32文字の半角英小文字・数字・_・-";
export const PASSWORD_HINT = "8〜128文字。ログインIDと同じものは使えません";
export const LOGIN_SUBMIT_LABEL = "ログインする";
export const LOGGING_IN_LABEL = "ログイン中…";
export const REGISTER_SUBMIT_LABEL = "登録する";
export const REGISTERING_LABEL = "登録中…";
export const LOGIN_REQUIRED = "ログインIDとパスワードを入力してください。";
export const LOGIN_ID_INVALID = "ログインIDは3〜32文字の半角英小文字・数字・_・- で入力してください。";
export const PASSWORD_TOO_SHORT = "パスワードは8文字以上で入力してください。";
export const PASSWORD_TOO_LONG = "パスワードは128文字以内で入力してください。";
export const PASSWORD_SAME_AS_LOGIN_ID = "パスワードにログインIDと同じ文字列は使えません。";
export const PASSWORD_MISMATCH = "確認用のパスワードが一致しません。";
export const DISPLAY_NAME_TOO_LONG = "表示名は50文字以内で入力してください。";
export const LOGIN_FAILED = "ログインIDまたはパスワードが違います。";
export const LOGIN_ID_TAKEN = "このログインIDは使用されています。";
export const TOO_MANY_ATTEMPTS = "試行回数が多すぎます。しばらく待ってから再度お試しください。";
export const INPUT_INVALID = "入力内容を確認してください。";
export const ACCOUNT_REQUEST_FAILED = "通信に失敗しました。時間をおいて再度お試しください。";
export const LOGOUT_FAILED = "ログアウトできませんでした。";
export const RECOVERY_CODE_TITLE = "リカバリーコード";
export const RECOVERY_CODE_HELP =
  "パスワードを忘れたときに必要です。この画面を閉じると二度と表示されません。安全な場所に保存してください。";
export const COPY_LABEL = "コピー";
export const COPIED_LABEL = "コピーしました";
export const COPY_FAILED = "コピーできませんでした。手で書き写してください。";
export const RECOVERY_CODE_SAVED_LABEL = "リカバリーコードを保存しました";
export const CLOSE_LABEL = "閉じる";

/**
 * API のエラーを文言にする。code で振り分ける(ApiClientError でなければ ACCOUNT_REQUEST_FAILED)
 * UNAUTHORIZED → LOGIN_FAILED、CONFLICT → LOGIN_ID_TAKEN、TOO_MANY_REQUESTS → TOO_MANY_ATTEMPTS、
 * VALIDATION → INPUT_INVALID、それ以外 → ACCOUNT_REQUEST_FAILED
 */
export function accountErrorMessage(error: unknown): string;

/** ログイン中の表示名。displayName があればそれ、無ければ loginId */
export function accountDisplayLabel(account: { loginId: string; displayName: string | null }): string;

/**
 * 登録フォームの検証。問題が無ければ null、あれば次の順で最初に当たった文言を返す
 * 1. LoginIdSchema で失敗 → LOGIN_ID_INVALID
 * 2. password が MIN_PASSWORD_LENGTH 未満 → PASSWORD_TOO_SHORT / MAX_PASSWORD_LENGTH 超 → PASSWORD_TOO_LONG
 * 3. passwordEqualsLoginId(password, 正規化後の loginId) → PASSWORD_SAME_AS_LOGIN_ID
 * 4. password !== passwordConfirm → PASSWORD_MISMATCH
 * 5. displayName.trim() が MAX_NAME_LENGTH 超 → DISPLAY_NAME_TOO_LONG
 */
export function validateRegisterForm(input: {
  loginId: string;
  password: string;
  passwordConfirm: string;
  displayName: string;
}): string | null;
```

### コンポーネント

```tsx
// AccountMenu.tsx
export function AccountMenu({ onAccountChange }: { onAccountChange: () => void }): ReactElement | null;

// LoginDialog.tsx(API 呼び出しと busy・エラー表示をダイアログ自身が持つ)
export function LoginDialog({ onSuccess, onCancel }: {
  onSuccess: (account: Account) => void;
  onCancel: () => void;
}): ReactElement;

// RegisterDialog.tsx
export function RegisterDialog({ onSuccess, onCancel }: {
  onSuccess: (result: AccountWithRecoveryCode) => void;
  onCancel: () => void;
}): ReactElement;

// RecoveryCodeDialog.tsx
export function RecoveryCodeDialog({ code, onClose }: { code: string; onClose: () => void }): ReactElement;
```

AccountMenu の描画:
- マウント時に `getAccount()` を呼ぶ。解決前と失敗時は `null` を描画する
  - 失敗は `console.error` に記録する
  - アンマウント後に解決・失敗しても state を更新しない
- 匿名のとき:`<div className="account-menu">` の中に、`LOGIN_LABEL` と `REGISTER_LABEL` のボタンをこの順で置く
- ログイン中のとき:`<div className="account-menu">` の中に、次をこの順で置く
  - `<span className="account-menu__name">{accountDisplayLabel(account)}</span>`
  - `<span className="account-menu__id">@{loginId}</span>`
  - `LOGOUT_LABEL` のボタン

入力欄の属性:
- ログインID:`autoComplete="username"`・`autoCapitalize="none"`・`spellCheck={false}`
- パスワード:`type="password"`・`maxLength={MAX_PASSWORD_LENGTH}`
  - autoComplete はログインで `"current-password"`、登録で `"new-password"`
- 表示名:`maxLength={MAX_NAME_LENGTH}`

### `web/src/features/projects/ProjectListPage.tsx`
見出しの右側を `<div className="projects__head-actions">` で包み、`<AccountMenu onAccountChange={...} />` と
既存の新規作成リンクをこの順で置く。onAccountChange では、一覧の再読み込み(`reloadSeq` の加算)を行う。
projects.css に `.projects__head-actions`(flex、`gap: var(--space-3)`、`align-items: center`)を足す。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `getAccount()` | `fetch("/api/account", { method: "GET" })`。応答が AccountSchema に合わなければ `ApiClientError(200, "VALIDATION", ...)` |
| `registerAccount({ loginId: "a", password: "b" })` | `POST /api/account/register`。本体 JSON は `{"loginId":"a","password":"b"}`(displayName キーなし)、Content-Type は application/json |
| `login(...)` / `updateDisplayName("x")` / `logout()` | それぞれ POST `/api/account/login` / PATCH `/api/account` 本体 `{"displayName":"x"}` / POST `/api/account/logout`(204 で解決) |
| 401 応答 `{"error":{"code":"UNAUTHORIZED",...}}` | `ApiClientError(401, "UNAUTHORIZED", message)` |
| `accountErrorMessage(new ApiClientError(401,"UNAUTHORIZED","x"))` / 409 CONFLICT / 429 / 400 / 500 INTERNAL / `new Error()` | LOGIN_FAILED / LOGIN_ID_TAKEN / TOO_MANY_ATTEMPTS / INPUT_INVALID / ACCOUNT_REQUEST_FAILED / ACCOUNT_REQUEST_FAILED |
| `accountDisplayLabel({ loginId: "tanaka", displayName: null })` / `displayName: "田中"` | `"tanaka"` / `"田中"` |
| `validateRegisterForm` に loginId `"ab"` | LOGIN_ID_INVALID |
| loginId `" Tanaka "`、password `"tanaka"`(6 文字) | PASSWORD_TOO_SHORT |
| loginId `"Tanaka12"`、password `"tanaka12"` | PASSWORD_SAME_AS_LOGIN_ID |
| password と確認が違う | PASSWORD_MISMATCH |
| displayName が空白を除いて 51 文字 | DISPLAY_NAME_TOO_LONG |
| すべて正しい(displayName 空) | null |
| AccountMenu、`getAccount` が匿名を返す | `.account-menu` にボタンが「ログイン」「アカウント登録」の順に 2 つ |
| AccountMenu、`getAccount` が `{ loginId: "tanaka", displayName: "田中" }` を返す | 「田中」「@tanaka」と「ログアウト」ボタン |
| AccountMenu、`getAccount` が拒否 | 何も描画しない。`console.error` が呼ばれ、未処理の拒否が出ない |
| 「ログイン」→ LoginDialog で ID・パスワードを空のまま送信 | API を呼ばず、`role="alert"` に LOGIN_REQUIRED |
| LoginDialog で送信し、`login` が 401 | ダイアログは開いたまま、`role="alert"` に LOGIN_FAILED。パスワード欄は空に戻り、ID は残る |
| `login` が 429 | TOO_MANY_ATTEMPTS |
| `login` の解決待ちの間 | 送信ボタンは LOGGING_IN_LABEL で disabled、キャンセルも disabled |
| ログイン成功(`displayName: "田中"`) | ダイアログが閉じ、メニューが「田中」「@tanaka」に変わる。`onAccountChange` が 1 回呼ばれ、`saveName("田中")` で localStorage の表示名が "田中" になる |
| ログイン成功(`displayName: null`) | `saveName` は呼ばれない(localStorage は変わらない) |
| 「アカウント登録」→ RegisterDialog で検証エラーになる入力 | API を呼ばず、`validateRegisterForm` の文言を `role="alert"` に出す |
| 登録で表示名が空白だけ | `registerAccount` に displayName を渡さない |
| 登録が 409 | ダイアログは開いたまま LOGIN_ID_TAKEN |
| 登録成功 | 登録ダイアログが閉じて RecoveryCodeDialog が開き、コードが `<code>` に表示される。メニューはログイン中の表示になり、`onAccountChange` が 1 回呼ばれる |
| RecoveryCodeDialog の初期状態 | 「閉じる」は disabled。RECOVERY_CODE_SAVED_LABEL のチェックボックスを入れると enabled になり、押すと閉じる |
| 「コピー」で `navigator.clipboard.writeText(code)` が解決 | ボタンの文言が COPIED_LABEL に変わる |
| `writeText` が拒否 / `navigator.clipboard` が無い(HTTP の LAN 運用では無い) | ダイアログ内に COPY_FAILED を表示する。例外は外に出ない |
| 「ログアウト」 | `logout()` の後に `getAccount()` を呼び直し、メニューが匿名の表示に戻る。`onAccountChange` が 1 回呼ばれる |
| `logout()` が失敗 | メニュー内の `role="alert"` に LOGOUT_FAILED。表示はログイン中のまま |
| ProjectListPage で、ログイン成功による `onAccountChange` | `listProjects` がもう一度呼ばれ、その結果で一覧が描き直される(`web/tests/project-list-account.test.ts`) |
| `project-list-page.test.ts` の既存テスト | 期待値を変えずに通る(`getAccount` のモックは解決しない Promise) |
| `theme-effect.test.ts` | 変更せずに通る |

## やらないこと
- パスワード変更・リカバリーコード再発行・「パスワードを忘れた」(188)
- 入室ダイアログ・レビュー画面の変更(189)
- アカウントの削除、ログイン ID の変更
- `shared/`・`server/` の変更
- ルーティング(`/login` などの専用ページ)の追加

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] account_Summary.md を新規作成し、web_Summary.md(api/account.ts と client.ts の export)と
      projects_Summary.md(AccountMenu の配置)を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
