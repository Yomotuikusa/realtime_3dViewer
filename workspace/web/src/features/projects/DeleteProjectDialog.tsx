import { useId, type ReactElement } from "react";
import type { ProjectSummary } from "@shared/project-list";
import { CANCEL_LABEL } from "../comments/comment-labels";
import {
  DELETE_CONFIRM_LABEL,
  DELETE_DIALOG_TITLE,
  DELETING_LABEL,
  deleteProjectMessage,
} from "./projects-labels";
import "../../app/review.css";

export function DeleteProjectDialog({
  project,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  project: ProjectSummary;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement {
  const titleId = useId();
  const messageId = useId();

  return (
    <div className="review-backdrop projects-dialog__backdrop">
      <div
        className="review-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 id={titleId}>{DELETE_DIALOG_TITLE}</h2>
        <p id={messageId}>{deleteProjectMessage(project)}</p>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="projects-dialog__actions">
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
