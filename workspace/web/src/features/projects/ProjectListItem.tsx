import type { ReactElement, MouseEvent } from "react";
import type { ProjectSummary } from "@shared/project-list";
import { isPlainLeftClick, navigate, projectPath } from "../../app/routes";
import { projectMeta, SHARED_BADGE_LABEL } from "./projects-labels";

export function ProjectListItem({ project }: { project: ProjectSummary }): ReactElement {
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
    </li>
  );
}
