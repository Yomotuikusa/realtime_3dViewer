import type { ProjectSummary } from "@shared/project-list";

export const PROJECTS_HEADING = "プロジェクト";
export const NEW_PROJECT_LABEL = "新規プロジェクト";
export const PROJECTS_LOADING = "読み込み中…";
export const PROJECTS_EMPTY = "まだプロジェクトがありません。";
export const PROJECTS_EMPTY_HINT = "モデルをアップロードして、最初のプロジェクトを作成しましょう。";
export const PROJECTS_LOAD_FAILED = "プロジェクト一覧を読み込めませんでした。";
export const PROJECTS_RETRY_LABEL = "再読み込み";
export const SHARED_BADGE_LABEL = "共有";
export const RENAME_LABEL = "名前を変更";
export const DELETE_LABEL = "削除";
export const LEAVE_LABEL = "一覧から外す";
export const RENAME_DIALOG_TITLE = "プロジェクト名を変更";
export const RENAME_CONFIRM_LABEL = "変更する";
export const RENAMING_LABEL = "変更中…";
export const NAME_REQUIRED = "プロジェクト名を入力してください。";
export const DELETE_DIALOG_TITLE = "プロジェクトを削除";
export const DELETE_CONFIRM_LABEL = "削除する";
export const DELETING_LABEL = "削除中…";
export const FORBIDDEN_MESSAGE = "この操作はプロジェクトの作成者だけが行えます。";
export const RENAME_FAILED = "名前を変更できませんでした。";
export const DELETE_FAILED = "プロジェクトを削除できませんでした。";
export const LEAVE_FAILED = "一覧から外せませんでした。";

export function actionAriaLabel(action: string, name: string): string {
  const particle = action === RENAME_LABEL ? "の" : "を";
  return `「${name}」${particle}${action}`;
}

export function deleteProjectMessage(
  project: Pick<ProjectSummary, "name" | "versionCount">,
): string {
  return `「${project.name}」を削除します。オブジェクト ${project.versionCount} 個とコメントもすべて削除され、元に戻せません。`;
}

export function projectActionErrorMessage(error: unknown, fallback: string): string {
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  return code === "FORBIDDEN" ? FORBIDDEN_MESSAGE : fallback;
}

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
