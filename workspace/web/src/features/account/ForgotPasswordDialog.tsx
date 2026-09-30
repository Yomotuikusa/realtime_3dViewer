import { useId, useState, type FormEvent, type ReactElement } from "react";
import type { AccountWithRecoveryCode } from "@shared/account";
import { MAX_PASSWORD_LENGTH } from "@shared/account";
import { resetPassword } from "../../api/account";
import { CANCEL_LABEL } from "../comments/comment-labels";
import {
  FORGOT_PASSWORD_HELP,
  FORGOT_PASSWORD_TITLE,
  LOGIN_ID_HINT,
  LOGIN_ID_LABEL,
  RECOVERY_CODE_LABEL,
  NEW_PASSWORD_CONFIRM_LABEL,
  NEW_PASSWORD_LABEL,
  RESET_FAILED,
  RESET_SUBMIT_LABEL,
  RESETTING_LABEL,
  accountErrorMessage,
  validateResetForm,
} from "./account-labels";
import "../../app/review.css";

export function ForgotPasswordDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: AccountWithRecoveryCode) => void;
  onCancel: () => void;
}): ReactElement {
  const titleId = useId();
  const errorId = useId();
  const [loginId, setLoginId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const validationError = validateResetForm({ loginId, recoveryCode, password, passwordConfirm });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    void resetPassword({ loginId, recoveryCode, newPassword: password })
      .then(onSuccess)
      .catch((reason: unknown) => setError(accountErrorMessage(reason, { UNAUTHORIZED: RESET_FAILED })))
      .finally(() => setBusy(false));
  };

  return (
    <div className="review-backdrop account-dialog__backdrop">
      <form className="review-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <h2 id={titleId}>{FORGOT_PASSWORD_TITLE}</h2>
        <p className="account-dialog__help">{FORGOT_PASSWORD_HELP}</p>
        <label className="field">
          <span className="field__label">{LOGIN_ID_LABEL}</span>
          <input className="input" value={loginId} autoComplete="username" autoCapitalize="none" spellCheck={false}
            autoFocus disabled={busy} onChange={(event) => setLoginId(event.target.value)} />
          <span className="account-dialog__hint">{LOGIN_ID_HINT}</span>
        </label>
        <label className="field">
          <span className="field__label">{RECOVERY_CODE_LABEL}</span>
          <input className="input" value={recoveryCode} autoComplete="off" autoCapitalize="none" spellCheck={false}
            disabled={busy} onChange={(event) => setRecoveryCode(event.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{NEW_PASSWORD_LABEL}</span>
          <input className="input" type="password" value={password} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password"
            disabled={busy} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{NEW_PASSWORD_CONFIRM_LABEL}</span>
          <input className="input" type="password" value={passwordConfirm} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password"
            disabled={busy} onChange={(event) => setPasswordConfirm(event.target.value)} />
        </label>
        {error && <p className="alert" role="alert" id={errorId}>{error}</p>}
        <div className="account-dialog__actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? RESETTING_LABEL : RESET_SUBMIT_LABEL}
          </button>
          <button className="btn btn--quiet" type="button" onClick={onCancel} disabled={busy}>{CANCEL_LABEL}</button>
        </div>
      </form>
    </div>
  );
}
