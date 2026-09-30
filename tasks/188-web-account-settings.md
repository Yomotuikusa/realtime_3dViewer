---
id: 188
title: アカウント設定(パスワード変更・リカバリーコード再発行)と「パスワードを忘れた場合」の再設定画面を追加する
feature: account
depends_on: [186, 187]
owns: [web/src/api/account.ts, web/web_Summary.md, web/tests/api-account-password.test.ts, web/src/features/account/AccountMenu.tsx, web/src/features/account/LoginDialog.tsx, web/src/features/account/AccountSettingsDialog.tsx, web/src/features/account/ForgotPasswordDialog.tsx, web/src/features/account/account-labels.ts, web/src/features/account/account.css, web/src/features/account/account_Summary.md, web/tests/account-labels.test.ts, web/tests/account-menu.test.ts, web/tests/account-dialogs.test.ts, web/tests/account-settings.test.ts, web/tests/forgot-password.test.ts]
reads: [shared/src/account.ts, shared/src/api.ts, web/src/api/client.ts, web/src/app/display-name.ts, web/src/features/account/RegisterDialog.tsx, web/src/features/account/RecoveryCodeDialog.tsx, web/src/features/projects/ProjectListPage.tsx, web/tests/project-list-page.test.ts, web/tests/project-list-account.test.ts, web/tests/api-account.test.ts]
verify: npm run typecheck && npm run test
status: todo
---

## 目的
186 の API を画面から使えるようにする。
- ログイン中のユーザーは、アカウント設定からパスワードの変更とリカバリーコードの再発行ができる
- パスワードを忘れた人は、ログインダイアログの「パスワードを忘れた場合」から、ログインID・リカバリーコード・
  新しいパスワードを入力して再設定できる。再設定後はログイン状態になり、新しいリカバリーコードを 1 回だけ表示する

## 前提
- API(186。同一オリジン)
  | メソッドとパス | 本体 | 成功 | 主なエラー |
  | --- | --- | --- | --- |
  | `POST /api/account/password` | `{ currentPassword, newPassword }` | 200 `Account`(新しい Cookie が発行され、ほかの端末はログアウトされる) | 401 `UNAUTHORIZED`(未ログイン)、403 `FORBIDDEN`(現在のパスワード違い)、429、400 |
  | `POST /api/account/password-reset` | `{ loginId, recoveryCode, newPassword }` | 200 `AccountWithRecoveryCode`(ログイン状態になる) | 401 `UNAUTHORIZED`(ID かコードの誤り)、429、400 |
  | `POST /api/account/recovery-code` | `{ password }` | 200 `AccountWithRecoveryCode` | 401、403(パスワード違い)、429、400 |
- 187 で次ができている
  - `web/src/api/account.ts`:getAccount / updateDisplayName / registerAccount / login / logout
  - `AccountMenu`・`LoginDialog`・`RegisterDialog`・`RecoveryCodeDialog`・`account-labels.ts`(`accountErrorMessage`・`validateRegisterForm`)
  - `web/src/features/account/`
- `web/src/api/client.ts` の `requestJson` は 187 で export 済み。本タスクでは client.ts を変更しない
- `RecoveryCodeInputSchema`・`LoginIdSchema`・`passwordEqualsLoginId` は `shared/src/account.ts` にある
- 187 のテスト(`account-menu.test.ts`・`account-dialogs.test.ts`)は、ログイン中のメニューのボタンや LoginDialog の props を
  前提にしている。本タスクでメニューにボタンを足し、LoginDialog に必須の prop を足すので、これらのテストも更新する
- `project-list-page.test.ts` と `project-list-account.test.ts` は AccountMenu を含む一覧画面を描画する。
  本タスクの変更後も、変更せずに通ること(メニューが匿名のときのボタン構成は変えない)

## インターフェイス契約

### `web/src/api/account.ts`(追加)

```ts
/** POST /api/account/password。AccountSchema で検証 */
export function changePassword(input: { currentPassword: string; newPassword: string }): Promise<Account>;
/** POST /api/account/password-reset。AccountWithRecoveryCodeSchema で検証 */
export function resetPassword(input: {
  loginId: string;
  recoveryCode: string;
  newPassword: string;
}): Promise<AccountWithRecoveryCode>;
/** POST /api/account/recovery-code。AccountWithRecoveryCodeSchema で検証 */
export function regenerateRecoveryCode(input: { password: string }): Promise<AccountWithRecoveryCode>;
```

### `web/src/features/account/account-labels.ts`(追加・変更)

```ts
export const ACCOUNT_SETTINGS_LABEL = "アカウント設定";
export const ACCOUNT_SETTINGS_TITLE = "アカウント設定";
export const CHANGE_PASSWORD_HEADING = "パスワードの変更";
export const CURRENT_PASSWORD_LABEL = "現在のパスワード";
export const NEW_PASSWORD_LABEL = "新しいパスワード";
export const NEW_PASSWORD_CONFIRM_LABEL = "新しいパスワード(確認)";
export const CHANGE_PASSWORD_SUBMIT_LABEL = "パスワードを変更";
export const CHANGING_PASSWORD_LABEL = "変更中…";
export const PASSWORD_CHANGED = "パスワードを変更しました。ほかの端末ではログアウトされます。";
export const REGENERATE_HEADING = "リカバリーコードの再発行";
export const REGENERATE_HELP = "新しいコードを発行すると、今のコードは使えなくなります。";
export const REGENERATE_SUBMIT_LABEL = "再発行する";
export const REGENERATING_LABEL = "発行中…";
export const CURRENT_PASSWORD_REQUIRED = "現在のパスワードを入力してください。";
export const CURRENT_PASSWORD_INCORRECT = "現在のパスワードが違います。";
export const SIGN_IN_REQUIRED = "ログインし直してください。";
export const FORGOT_PASSWORD_LABEL = "パスワードを忘れた場合";
export const FORGOT_PASSWORD_TITLE = "パスワードの再設定";
export const FORGOT_PASSWORD_HELP = "登録時に表示されたリカバリーコードを入力してください。";
export const RECOVERY_CODE_LABEL = "リカバリーコード";
export const RECOVERY_CODE_INVALID = "リカバリーコードは32桁の英数字(0-9・a-f、区切りの - は省略可)で入力してください。";
export const RESET_SUBMIT_LABEL = "再設定する";
export const RESETTING_LABEL = "再設定中…";
export const RESET_FAILED = "ログインIDまたはリカバリーコードが違います。";

/** 187 の関数に省略可能な overrides を足す。error の code が overrides にあればその文言を優先する */
export function accountErrorMessage(
  error: unknown,
  overrides?: Partial<Record<ErrorCode, string>>,
): string;

/**
 * 新しいパスワードの検証。次の順で最初に当たった文言、無ければ null
 * PASSWORD_TOO_SHORT / PASSWORD_TOO_LONG → PASSWORD_SAME_AS_LOGIN_ID(loginId は LoginIdSchema で正規化してから比べる。
 * 正規化できなければ、trim して小文字にした値と比べる)→ PASSWORD_MISMATCH
 * validateRegisterForm の 2〜4 はこの関数を使うように書き換えてよい(結果は変えない)
 */
export function validateNewPassword(input: {
  loginId: string;
  password: string;
  passwordConfirm: string;
}): string | null;

/** LoginIdSchema 失敗 → LOGIN_ID_INVALID、RecoveryCodeInputSchema 失敗 → RECOVERY_CODE_INVALID、その後 validateNewPassword */
export function validateResetForm(input: {
  loginId: string;
  recoveryCode: string;
  password: string;
  passwordConfirm: string;
}): string | null;
```

### コンポーネント

```tsx
// AccountSettingsDialog.tsx(新規)
export function AccountSettingsDialog({ account, onRecoveryCode, onClose }: {
  account: { loginId: string; displayName: string | null };
  /** 再発行に成功したら新しいコードを渡す(呼び出し側が RecoveryCodeDialog を開く) */
  onRecoveryCode: (code: string) => void;
  onClose: () => void;
}): ReactElement;

// ForgotPasswordDialog.tsx(新規)
export function ForgotPasswordDialog({ onSuccess, onCancel }: {
  onSuccess: (result: AccountWithRecoveryCode) => void;
  onCancel: () => void;
}): ReactElement;

// LoginDialog.tsx(prop を追加)
export function LoginDialog({ onSuccess, onCancel, onForgotPassword }: {
  onSuccess: (account: Account) => void;
  onCancel: () => void;
  /** FORGOT_PASSWORD_LABEL のボタン(btn--quiet、type="button"、busy 中は disabled)で呼ぶ */
  onForgotPassword: () => void;
}): ReactElement;
```

- AccountSettingsDialog は `role="dialog"` の中に、次の 2 つの `<form>` と `CLOSE_LABEL` ボタンを持つ
  - パスワード変更(`CHANGE_PASSWORD_HEADING`)
  - 再発行(`REGENERATE_HEADING`)
- 各フォームは自分の busy とエラー(`role="alert"`)を持つ
- パスワード欄はすべて `type="password"`
  - 現在のパスワード:`autoComplete="current-password"`
  - 新しいパスワード:`"new-password"`
- ForgotPasswordDialog のリカバリーコード欄:`autoComplete="off"`・`autoCapitalize="none"`・`spellCheck={false}`
- AccountMenu のログイン中の表示は、名前・`@loginId` の後に、`ACCOUNT_SETTINGS_LABEL` と `LOGOUT_LABEL` のボタンをこの順で置く
- AccountMenu のフロー
  - LoginDialog の「パスワードを忘れた場合」:LoginDialog を閉じて、ForgotPasswordDialog を開く
  - 再設定に成功した場合:ログイン成功と同じ後処理を行う
    - account を更新する
    - displayName があれば `saveName`
    - `onAccountChange()` を 1 回呼ぶ
    - その上で RecoveryCodeDialog を開く
  - 設定の再発行に成功した場合:設定ダイアログを閉じて、RecoveryCodeDialog を開く
  - パスワード変更の場合:利用者は変わらないので、`onAccountChange` を呼ばない

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `changePassword` / `resetPassword` / `regenerateRecoveryCode` の fetch | それぞれ POST `/api/account/password` / `/api/account/password-reset` / `/api/account/recovery-code`、Content-Type application/json、本体は引数の JSON |
| `accountErrorMessage(403 FORBIDDEN のエラー, { FORBIDDEN: CURRENT_PASSWORD_INCORRECT })` | CURRENT_PASSWORD_INCORRECT |
| `accountErrorMessage(401 UNAUTHORIZED のエラー)`(overrides なし) | LOGIN_FAILED(187 と同じ) |
| `validateNewPassword({ loginId: "Tanaka12", password: "tanaka12", passwordConfirm: "tanaka12" })` | PASSWORD_SAME_AS_LOGIN_ID |
| `validateResetForm` で recoveryCode `"ABCD-EF01-2345-6789-ABCD-EF01-2345-6789"` と正しいパスワード | null |
| `validateResetForm` で recoveryCode が 31 桁 | RECOVERY_CODE_INVALID |
| 187 の `validateRegisterForm` の振る舞い | 変わらない(187 のテストが通る) |
| ログイン中のメニュー | ボタンは「アカウント設定」「ログアウト」の順 |
| 匿名のメニュー | ボタンは「ログイン」「アカウント登録」のまま |
| 設定でパスワード変更を、現在のパスワードを空のまま送信 | API を呼ばず CURRENT_PASSWORD_REQUIRED |
| 新しいパスワードが短い・ログインIDと同じ・確認違い | API を呼ばず、`validateNewPassword` の文言 |
| `changePassword` が成功 | `role="status"` に PASSWORD_CHANGED。3 つのパスワード欄が空になる。ダイアログは開いたまま |
| `changePassword` が 403 / 401 / 429 | CURRENT_PASSWORD_INCORRECT / SIGN_IN_REQUIRED / TOO_MANY_ATTEMPTS |
| 変更の送信中 | 送信ボタンは CHANGING_PASSWORD_LABEL で disabled |
| 再発行でパスワードを空のまま送信 | API を呼ばず CURRENT_PASSWORD_REQUIRED |
| `regenerateRecoveryCode` が成功 | 設定ダイアログが閉じ、新しいコードの RecoveryCodeDialog が開く |
| `regenerateRecoveryCode` が 403 | CURRENT_PASSWORD_INCORRECT |
| ログインダイアログの「パスワードを忘れた場合」 | ログインダイアログが閉じ、ForgotPasswordDialog が開く |
| 再設定で入力不正 | API を呼ばず、`validateResetForm` の文言 |
| `resetPassword` が 401 / 429 | RESET_FAILED / TOO_MANY_ATTEMPTS。ダイアログは開いたまま |
| `resetPassword` が成功(`displayName: "田中"`) | 再設定ダイアログが閉じる。メニューがログイン中の表示になり、`onAccountChange` が 1 回呼ばれ、`saveName("田中")` が行われ、新しいコードの RecoveryCodeDialog が開く |
| 再設定のキャンセル | ダイアログが閉じ、メニューは匿名の表示のまま |

## やらないこと
- メールによる再設定(将来)
- ログイン ID・表示名の変更 UI(表示名は 189 の入室ダイアログで更新される)
- アカウント削除
- `shared/`・`server/`・`web/src/api/client.ts`・`web/src/features/projects/` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] account_Summary.md と web_Summary.md を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
