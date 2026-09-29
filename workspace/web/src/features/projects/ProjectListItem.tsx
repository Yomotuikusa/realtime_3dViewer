import type { ReactElement, MouseEvent } from "react";
import type { ProjectSummary } from "@shared/project-list";
import { isPlainLeftClick, navigate, projectPath } from "../../app/routes";
import {
  actionAriaLabel,
  DELETE_LABEL,
  LEAVE_LABEL,
  projectMeta,
  RENAME_LABEL,
  SHARED_BADGE_LABEL,
} from "./projects-labels";

export function ProjectListItem({
  project,
  onRename,
  onDelete,
  onLeave,
}: {
  project: ProjectSummary;
  onRename: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
  onLeave: (project: ProjectSummary) => void;
}): ReactElement {
  const href = projectPath(project.id);
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <li className="projects__item">
      <a className="projects__name" href={href} onClick={handleClick}>{project.name}</a>
      {project.role === "member" && <span className="badge">{SHARED_BADGE_LABEL}</span>}
      <span className="projects__meta">{projectMeta(project)}</span>
      <div className="projects__actions">
        {project.canManage && (
          <>
            <button
              className="btn btn--quiet"
              type="button"
              aria-label={actionAriaLabel(RENAME_LABEL, project.name)}
              onClick={() => onRename(project)}
            >
              {RENAME_LABEL}
            </button>
            <button
              className="btn btn--quiet"
              type="button"
              aria-label={actionAriaLabel(DELETE_LABEL, project.name)}
              onClick={() => onDelete(project)}
            >
              {DELETE_LABEL}
            </button>
          </>
        )}
        {project.role === "member" && (
          <button
            className="btn btn--quiet"
            type="button"
            aria-label={actionAriaLabel(LEAVE_LABEL, project.name)}
            onClick={() => onLeave(project)}
          >
            {LEAVE_LABEL}
          </button>
        )}
      </div>
    </li>
  );
}
