import { useId, useState, type FormEvent, type ReactElement } from "react";
import type { ProjectSummary } from "@shared/project-list";
import { MAX_PROJECT_NAME_LENGTH } from "@shared/types";
import { CANCEL_LABEL } from "../comments/comment-labels";
import {
  RENAME_CONFIRM_LABEL,
  RENAME_DIALOG_TITLE,
  RENAMING_LABEL,
} from "./projects-labels";
import "../../app/review.css";

export function RenameProjectDialog({
  project,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  project: ProjectSummary;
  busy: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}): ReactElement {
  const titleId = useId();
  const errorId = useId();
  const [name, setName] = useState(project.name);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit(name);
  };

  return (
    <div className="review-backdrop projects-dialog__backdrop">
      <form
        className="review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
      >
        <h2 id={titleId}>{RENAME_DIALOG_TITLE}</h2>
        <label className="field">
          <span className="field__label">プロジェクト名</span>
          <input
            className="input"
            value={name}
            maxLength={MAX_PROJECT_NAME_LENGTH}
            autoFocus
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error && <p className="alert" role="alert" id={errorId}>{error}</p>}
        <div className="projects-dialog__actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? RENAMING_LABEL : RENAME_CONFIRM_LABEL}
          </button>
          <button className="btn btn--quiet" type="button" onClick={onCancel} disabled={busy}>
            {CANCEL_LABEL}
          </button>
        </div>
      </form>
    </div>
  );
}
