import { useId, useState, type ReactElement } from "react";
import {
  CLOSE_LABEL,
  COPIED_LABEL,
  COPY_FAILED,
  COPY_LABEL,
  RECOVERY_CODE_HELP,
  RECOVERY_CODE_SAVED_LABEL,
  RECOVERY_CODE_TITLE,
} from "./account-labels";
import "../../app/review.css";

export function RecoveryCodeDialog({ code, onClose }: { code: string; onClose: () => void }): ReactElement {
  const titleId = useId();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copy = (): void => {
    setCopyError(false);
    if (!navigator.clipboard) {
      setCopyError(true);
      return;
    }
    try {
      void navigator.clipboard.writeText(code)
        .then(() => setCopied(true))
        .catch(() => setCopyError(true));
    } catch {
      setCopyError(true);
    }
  };

  return (
    <div className="review-backdrop account-dialog__backdrop">
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{RECOVERY_CODE_TITLE}</h2>
        <p className="account-dialog__help">{RECOVERY_CODE_HELP}</p>
        <code className="account-dialog__code">{code}</code>
        <button className="btn account-dialog__copy" type="button" onClick={copy}>
          {copied ? COPIED_LABEL : COPY_LABEL}
        </button>
        {copyError && <p className="alert" role="alert">{COPY_FAILED}</p>}
        <label className="field">
          <span>
            <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            {RECOVERY_CODE_SAVED_LABEL}
          </span>
        </label>
        <div className="account-dialog__actions">
          <button className="btn btn--primary" type="button" onClick={onClose} disabled={!saved}>
            {CLOSE_LABEL}
          </button>
        </div>
      </section>
    </div>
  );
}
