import { useCallback, useState } from "react";
import type { ProjectSummary } from "@shared/project-list";
import { deleteProject, leaveProject, renameProject } from "../../api/client";
import {
  DELETE_FAILED,
  LEAVE_FAILED,
  NAME_REQUIRED,
  projectActionErrorMessage,
  RENAME_FAILED,
} from "./projects-labels";

function hasStatus(error: unknown, status: number): boolean {
  return error !== null && typeof error === "object" && "status" in error
    && (error as { status?: unknown }).status === status;
}

export type ProjectDialog =
  | { kind: "rename"; project: ProjectSummary }
  | { kind: "delete"; project: ProjectSummary }
  | null;

export interface ProjectActions {
  dialog: ProjectDialog;
  busy: boolean;
  dialogError: string | null;
  pageError: string | null;
  openRename(project: ProjectSummary): void;
  openDelete(project: ProjectSummary): void;
  closeDialog(): void;
  submitRename(name: string): Promise<void>;
  confirmDelete(): Promise<void>;
  leave(project: ProjectSummary): Promise<void>;
}

export function useProjectActions(
  updateProjects: (update: (projects: ProjectSummary[]) => ProjectSummary[]) => void,
): ProjectActions {
  const [dialog, setDialog] = useState<ProjectDialog>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const openDialog = useCallback((next: ProjectDialog): void => {
    setDialog(next);
    setDialogError(null);
  }, []);
  const closeDialog = useCallback((): void => {
    if (!busy) {
      setDialog(null);
      setDialogError(null);
    }
  }, [busy]);
  const removeProject = useCallback((projectId: string): void => {
    updateProjects((projects) => projects.filter((project) => project.id !== projectId));
  }, [updateProjects]);

  const submitRename = useCallback(async (name: string): Promise<void> => {
    if (!dialog || dialog.kind !== "rename" || busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setDialogError(NAME_REQUIRED);
      return;
    }
    if (trimmedName === dialog.project.name) {
      setDialog(null);
      setDialogError(null);
      return;
    }
    setBusy(true);
    setDialogError(null);
    try {
      const project = await renameProject(dialog.project.id, trimmedName);
      updateProjects((projects) => projects.map((item) =>
        item.id === project.id ? { ...item, name: project.name } : item));
      setDialog(null);
    } catch (error) {
      if (hasStatus(error, 404)) {
        removeProject(dialog.project.id);
        setDialog(null);
      } else {
        setDialogError(projectActionErrorMessage(error, RENAME_FAILED));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, dialog, removeProject, updateProjects]);

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!dialog || dialog.kind !== "delete" || busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      await deleteProject(dialog.project.id);
      removeProject(dialog.project.id);
      setDialog(null);
    } catch (error) {
      if (hasStatus(error, 404)) {
        removeProject(dialog.project.id);
        setDialog(null);
      } else {
        setDialogError(projectActionErrorMessage(error, DELETE_FAILED));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, dialog, removeProject]);

  const leave = useCallback(async (project: ProjectSummary): Promise<void> => {
    if (busy) return;
    setPageError(null);
    setBusy(true);
    try {
      await leaveProject(project.id);
      removeProject(project.id);
    } catch (error) {
      if (hasStatus(error, 404)) {
        removeProject(project.id);
      } else {
        setPageError(projectActionErrorMessage(error, LEAVE_FAILED));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, removeProject]);

  return {
    dialog,
    busy,
    dialogError,
    pageError,
    openRename: (project) => openDialog({ kind: "rename", project }),
    openDelete: (project) => openDialog({ kind: "delete", project }),
    closeDialog,
    submitRename,
    confirmDelete,
    leave,
  };
}
