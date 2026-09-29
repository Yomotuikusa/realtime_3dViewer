import type { ProjectSummary } from "@shared/project-list";

export const PROJECTS_HEADING = "プロジェクト";
export const NEW_PROJECT_LABEL = "新規プロジェクト";
export const PROJECTS_LOADING = "読み込み中…";
export const PROJECTS_EMPTY = "まだプロジェクトがありません。";
export const PROJECTS_EMPTY_HINT = "モデルをアップロードして、最初のプロジェクトを作成しましょう。";
export const PROJECTS_LOAD_FAILED = "プロジェクト一覧を読み込めませんでした。";
export const PROJECTS_RETRY_LABEL = "再読み込み";
export const SHARED_BADGE_LABEL = "共有";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ローカル時刻の "YYYY/MM/DD HH:mm" */
export function formatOpenedAt(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "オブジェクト N 個 · 最終オープン YYYY/MM/DD HH:mm" */
export function projectMeta(project: Pick<ProjectSummary, "versionCount" | "lastOpenedAt">): string {
  return `オブジェクト ${project.versionCount} 個 · 最終オープン ${formatOpenedAt(project.lastOpenedAt)}`;
}
