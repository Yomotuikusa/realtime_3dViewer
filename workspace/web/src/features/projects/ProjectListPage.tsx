import { useEffect, useState, type ReactElement } from "react";
import { listProjects } from "../../api/client";
import { APP_NAME } from "../../app/upload-labels";
import { isPlainLeftClick, navigate, NEW_PROJECT_PATH } from "../../app/routes";
import type { ProjectSummary } from "@shared/project-list";
import {
  NEW_PROJECT_LABEL,
  PROJECTS_EMPTY,
  PROJECTS_EMPTY_HINT,
  PROJECTS_HEADING,
  PROJECTS_LOAD_FAILED,
  PROJECTS_LOADING,
  PROJECTS_RETRY_LABEL,
} from "./projects-labels";
import { ProjectListItem } from "./ProjectListItem";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { RenameProjectDialog } from "./RenameProjectDialog";
import { useProjectActions } from "./useProjectActions";
import "./projects.css";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; projects: ProjectSummary[] };

export function ProjectListPage(): ReactElement {
  const [reloadSeq, setReloadSeq] = useState(0);
  const [state, setState] = useState<ListState>({ status: "loading" });
  const actions = useProjectActions((update) => {
    setState((current) => current.status === "ready"
      ? { ...current, projects: update(current.projects) }
      : current);
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void listProjects()
      .then((projects) => {
        if (!cancelled) setState({ status: "ready", projects });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadSeq]);

  const handleNewProjectClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!isPlainLeftClick(event)) return;
    event.preventDefault();
    navigate(NEW_PROJECT_PATH);
  };

  return (
    <main className="projects">
      <header className="projects__head">
        <div>
          <h1 className="projects__title">{APP_NAME}</h1>
          <h2 className="projects__heading">{PROJECTS_HEADING}</h2>
        </div>
        <a className="btn btn--primary" href={NEW_PROJECT_PATH} onClick={handleNewProjectClick}>
          {NEW_PROJECT_LABEL}
        </a>
      </header>
      {state.status === "loading" && <p role="status">{PROJECTS_LOADING}</p>}
      {state.status === "error" && (
        <div className="alert" role="alert">
          <p>{PROJECTS_LOAD_FAILED}</p>
          <button className="btn" type="button" onClick={() => setReloadSeq((seq) => seq + 1)}>
            {PROJECTS_RETRY_LABEL}
          </button>
        </div>
      )}
      {actions.pageError && <div className="alert" role="alert">{actions.pageError}</div>}
      {state.status === "ready" && state.projects.length === 0 && (
        <div className="projects__empty">
          <p>{PROJECTS_EMPTY}</p>
          <p className="projects__meta">{PROJECTS_EMPTY_HINT}</p>
        </div>
      )}
      {state.status === "ready" && state.projects.length > 0 && (
        <ul className="projects__list">
          {state.projects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              onRename={actions.openRename}
              onDelete={actions.openDelete}
              onLeave={actions.leave}
            />
          ))}
        </ul>
      )}
      {actions.dialog?.kind === "rename" && (
        <RenameProjectDialog
          project={actions.dialog.project}
          busy={actions.busy}
          error={actions.dialogError}
          onSubmit={(name) => void actions.submitRename(name)}
          onCancel={actions.closeDialog}
        />
      )}
      {actions.dialog?.kind === "delete" && (
        <DeleteProjectDialog
          project={actions.dialog.project}
          busy={actions.busy}
          error={actions.dialogError}
          onConfirm={() => void actions.confirmDelete()}
          onCancel={actions.closeDialog}
        />
      )}
    </main>
  );
}
