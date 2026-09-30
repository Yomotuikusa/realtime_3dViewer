import { useId, useState, type FormEvent, type ReactElement } from "react";
import type { Account } from "@shared/account";
import { MAX_PASSWORD_LENGTH } from "@shared/account";
import { login } from "../../api/account";
import { CANCEL_LABEL } from "../comments/comment-labels";
import {
  LOGIN_DIALOG_TITLE,
  LOGIN_FAILED,
  LOGIN_ID_HINT,
  LOGIN_ID_LABEL,
  LOGIN_REQUIRED,
  FORGOT_PASSWORD_LABEL,
  LOGIN_SUBMIT_LABEL,
  LOGGING_IN_LABEL,
  PASSWORD_LABEL,
  accountErrorMessage,
} from "./account-labels";
import "../../app/review.css";

export function LoginDialog({
  onSuccess,
  onCancel,
  onForgotPassword,
}: {
  onSuccess: (account: Account) => void;
  onCancel: () => void;
  onForgotPassword: () => void;
}): ReactElement {
  const titleId = useId();
  const errorId = useId();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!loginId.trim() || !password) {
      setError(LOGIN_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    void login({ loginId, password })
      .then(onSuccess)
      .catch((reason: unknown) => {
        setPassword("");
        setError(accountErrorMessage(reason) || LOGIN_FAILED);
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="review-backdrop account-dialog__backdrop">
      <form
        className="review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
      >
        <h2 id={titleId}>{LOGIN_DIALOG_TITLE}</h2>
        <label className="field">
          <span className="field__label">{LOGIN_ID_LABEL}</span>
          <input
            className="input"
            value={loginId}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            disabled={busy}
            onChange={(event) => setLoginId(event.target.value)}
          />
          <span className="account-dialog__hint">{LOGIN_ID_HINT}</span>
        </label>
        <label className="field">
          <span className="field__label">{PASSWORD_LABEL}</span>
          <input
            className="input"
            type="password"
            value={password}
            maxLength={MAX_PASSWORD_LENGTH}
            autoComplete="current-password"
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="alert" role="alert" id={errorId}>{error}</p>}
        <div className="account-dialog__actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? LOGGING_IN_LABEL : LOGIN_SUBMIT_LABEL}
          </button>
          <button className="btn btn--quiet" type="button" onClick={onCancel} disabled={busy}>
            {CANCEL_LABEL}
          </button>
          <button className="btn btn--quiet" type="button" onClick={onForgotPassword} disabled={busy}>
            {FORGOT_PASSWORD_LABEL}
          </button>
        </div>
      </form>
    </div>
  );
}
