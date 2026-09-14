import { useId, type ReactElement } from "react";
import type { ModelVersion } from "@shared/types";
import { CANCEL_LABEL } from "../comments/comment-labels";
import {
  DELETE_CONFIRM_LABEL,
  DELETE_DIALOG_TITLE,
  DELETING_LABEL,
  deleteConfirmMessage,
} from "./objects-labels";

export function DeleteObjectDialog({
  version,
  commentCount,
  busy,
  onConfirm,
  onCancel,
}: {
  version: ModelVersion;
  commentCount: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement {
  const titleId = useId();
  const messageId = useId();

  return (
    <div className="review-backdrop objects-delete__backdrop">
      <div
        className="review-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 id={titleId}>{DELETE_DIALOG_TITLE}</h2>
        <p id={messageId}>{deleteConfirmMessage(version.fileName, commentCount)}</p>
        <div className="objects-delete__actions">
          <button className="btn btn--danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? DELETING_LABEL : DELETE_CONFIRM_LABEL}
          </button>
          <button className="btn btn--quiet" type="button" onClick={onCancel} disabled={busy} autoFocus>
            {CANCEL_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
