import { LoginIdSchema, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordEqualsLoginId } from "@shared/account";
import { MAX_NAME_LENGTH } from "@shared/protocol";
import { ApiClientError } from "../../api/client";

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

export function accountErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) return ACCOUNT_REQUEST_FAILED;
  if (error.code === "UNAUTHORIZED") return LOGIN_FAILED;
  if (error.code === "CONFLICT") return LOGIN_ID_TAKEN;
  if (error.code === "TOO_MANY_REQUESTS") return TOO_MANY_ATTEMPTS;
  if (error.code === "VALIDATION") return INPUT_INVALID;
  return ACCOUNT_REQUEST_FAILED;
}

export function accountDisplayLabel(account: { loginId: string; displayName: string | null }): string {
  return account.displayName ?? account.loginId;
}

export function validateRegisterForm(input: {
  loginId: string;
  password: string;
  passwordConfirm: string;
  displayName: string;
}): string | null {
  const parsedLoginId = LoginIdSchema.safeParse(input.loginId);
  if (!parsedLoginId.success) return LOGIN_ID_INVALID;
  if (input.password.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT;
  if (input.password.length > MAX_PASSWORD_LENGTH) return PASSWORD_TOO_LONG;
  if (passwordEqualsLoginId(input.password, parsedLoginId.data)) return PASSWORD_SAME_AS_LOGIN_ID;
  if (input.password !== input.passwordConfirm) return PASSWORD_MISMATCH;
  if (input.displayName.trim().length > MAX_NAME_LENGTH) return DISPLAY_NAME_TOO_LONG;
  return null;
}
