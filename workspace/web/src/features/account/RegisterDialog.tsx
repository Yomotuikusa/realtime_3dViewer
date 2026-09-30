import { useId, useState, type FormEvent, type ReactElement } from "react";
import type { AccountWithRecoveryCode } from "@shared/account";
import { MAX_PASSWORD_LENGTH } from "@shared/account";
import { MAX_NAME_LENGTH } from "@shared/protocol";
import { registerAccount } from "../../api/account";
import { CANCEL_LABEL } from "../comments/comment-labels";
import {
  DISPLAY_NAME_LABEL,
  LOGIN_ID_HINT,
  LOGIN_ID_LABEL,
  PASSWORD_CONFIRM_LABEL,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  REGISTER_DIALOG_TITLE,
  REGISTER_SUBMIT_LABEL,
  REGISTERING_LABEL,
  accountErrorMessage,
  validateRegisterForm,
} from "./account-labels";
import "../../app/review.css";

export function RegisterDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: (result: AccountWithRecoveryCode) => void;
  onCancel: () => void;
}): ReactElement {
  const titleId = useId();
  const errorId = useId();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const validationError = validateRegisterForm({ loginId, password, passwordConfirm, displayName });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    const normalizedDisplayName = displayName.trim();
    const input = normalizedDisplayName
      ? { loginId, password, displayName: normalizedDisplayName }
      : { loginId, password };
    void registerAccount(input)
      .then(onSuccess)
      .catch((reason: unknown) => setError(accountErrorMessage(reason)))
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
        <h2 id={titleId}>{REGISTER_DIALOG_TITLE}</h2>
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
            autoComplete="new-password"
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="account-dialog__hint">{PASSWORD_HINT}</span>
        </label>
        <label className="field">
          <span className="field__label">{PASSWORD_CONFIRM_LABEL}</span>
          <input
            className="input"
            type="password"
            value={passwordConfirm}
            maxLength={MAX_PASSWORD_LENGTH}
            autoComplete="new-password"
            disabled={busy}
            onChange={(event) => setPasswordConfirm(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{DISPLAY_NAME_LABEL}</span>
          <input
            className="input"
            value={displayName}
            maxLength={MAX_NAME_LENGTH}
            disabled={busy}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        {error && <p className="alert" role="alert" id={errorId}>{error}</p>}
        <div className="account-dialog__actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? REGISTERING_LABEL : REGISTER_SUBMIT_LABEL}
          </button>
          <button className="btn btn--quiet" type="button" onClick={onCancel} disabled={busy}>
            {CANCEL_LABEL}
          </button>
        </div>
      </form>
    </div>
  );
}
