import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { MAX_PASSWORD_LENGTH } from "@shared/account";
import { changePassword, regenerateRecoveryCode } from "../../api/account";
import {
  ACCOUNT_SETTINGS_TITLE,
  CHANGE_PASSWORD_HEADING,
  CHANGE_PASSWORD_SUBMIT_LABEL,
  CHANGING_PASSWORD_LABEL,
  CLOSE_LABEL,
  CURRENT_PASSWORD_INCORRECT,
  CURRENT_PASSWORD_LABEL,
  CURRENT_PASSWORD_REQUIRED,
  NEW_PASSWORD_CONFIRM_LABEL,
  NEW_PASSWORD_LABEL,
  PASSWORD_CHANGED,
  REGENERATE_HEADING,
  REGENERATE_HELP,
  REGENERATE_SUBMIT_LABEL,
  REGENERATING_LABEL,
  SIGN_IN_REQUIRED,
  accountErrorMessage,
  validateNewPassword,
} from "./account-labels";
import "../../app/review.css";

export function AccountSettingsDialog({
  account,
  onRecoveryCode,
  onClose,
}: {
  account: { loginId: string; displayName: string | null };
  onRecoveryCode: (code: string) => void;
  onClose: () => void;
}): ReactElement {
  const titleId = useId();
  const changeErrorId = useId();
  const regenerateErrorId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [changeBusy, setChangeBusy] = useState(false);
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const submitChange = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!currentPassword) {
      setChangeError(CURRENT_PASSWORD_REQUIRED);
      return;
    }
    const validationError = validateNewPassword({
      loginId: account.loginId,
      password: newPassword,
      passwordConfirm,
    });
    if (validationError) {
      setChangeError(validationError);
      return;
    }
    setChangeBusy(true);
    setChangeError(null);
    void changePassword({ currentPassword, newPassword })
      .then(() => {
        setCurrentPassword("");
        setNewPassword("");
        setPasswordConfirm("");
        setChanged(true);
      })
      .catch((reason: unknown) => setChangeError(accountErrorMessage(reason, {
        FORBIDDEN: CURRENT_PASSWORD_INCORRECT,
        UNAUTHORIZED: SIGN_IN_REQUIRED,
      })))
      .finally(() => setChangeBusy(false));
  };

  const submitRegenerate = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!regeneratePassword) {
      setRegenerateError(CURRENT_PASSWORD_REQUIRED);
      return;
    }
    setRegenerateBusy(true);
    setRegenerateError(null);
    void regenerateRecoveryCode({ password: regeneratePassword })
      .then((result) => onRecoveryCode(result.recoveryCode))
      .catch((reason: unknown) => setRegenerateError(accountErrorMessage(reason, {
        FORBIDDEN: CURRENT_PASSWORD_INCORRECT,
      })))
      .finally(() => {
        if (mountedRef.current) setRegenerateBusy(false);
      });
  };

  return (
    <div className="review-backdrop account-dialog__backdrop">
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{ACCOUNT_SETTINGS_TITLE}</h2>
        <form onSubmit={submitChange}>
          <h3>{CHANGE_PASSWORD_HEADING}</h3>
          <label className="field">
            <span className="field__label">{CURRENT_PASSWORD_LABEL}</span>
            <input className="input" type="password" value={currentPassword} autoComplete="current-password"
              maxLength={MAX_PASSWORD_LENGTH} disabled={changeBusy} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">{NEW_PASSWORD_LABEL}</span>
            <input className="input" type="password" value={newPassword} autoComplete="new-password"
              maxLength={MAX_PASSWORD_LENGTH} disabled={changeBusy} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">{NEW_PASSWORD_CONFIRM_LABEL}</span>
            <input className="input" type="password" value={passwordConfirm} autoComplete="new-password"
              maxLength={MAX_PASSWORD_LENGTH} disabled={changeBusy} onChange={(event) => setPasswordConfirm(event.target.value)} />
          </label>
          {changeError && <p className="alert" role="alert" id={changeErrorId}>{changeError}</p>}
          {changed && <p className="account-dialog__success" role="status">{PASSWORD_CHANGED}</p>}
          <div className="account-dialog__actions">
            <button className="btn btn--primary" type="submit" disabled={changeBusy}>
              {changeBusy ? CHANGING_PASSWORD_LABEL : CHANGE_PASSWORD_SUBMIT_LABEL}
            </button>
          </div>
        </form>
        <form onSubmit={submitRegenerate}>
          <h3>{REGENERATE_HEADING}</h3>
          <p className="account-dialog__help">{REGENERATE_HELP}</p>
          <label className="field">
            <span className="field__label">{CURRENT_PASSWORD_LABEL}</span>
            <input className="input" type="password" value={regeneratePassword} autoComplete="current-password"
              maxLength={MAX_PASSWORD_LENGTH} disabled={regenerateBusy} onChange={(event) => setRegeneratePassword(event.target.value)} />
          </label>
          {regenerateError && <p className="alert" role="alert" id={regenerateErrorId}>{regenerateError}</p>}
          <div className="account-dialog__actions">
            <button className="btn btn--primary" type="submit" disabled={regenerateBusy}>
              {regenerateBusy ? REGENERATING_LABEL : REGENERATE_SUBMIT_LABEL}
            </button>
          </div>
        </form>
        <div className="account-dialog__actions">
          <button className="btn btn--quiet" type="button" onClick={onClose} disabled={changeBusy || regenerateBusy}>
            {CLOSE_LABEL}
          </button>
        </div>
      </section>
    </div>
  );
}
