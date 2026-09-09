export const APP_NAME = "3D Reviewer";
export const UPLOAD_LEAD = "glTF / GLB をアップロードすると、共有用のレビュー URL が発行されます。";
export const PROJECT_NAME_LABEL = "プロジェクト名";
export const MODEL_FILE_LABEL = "モデルファイル";
export const SUBMIT_LABEL = "レビューを開始";
export const SUBMITTING_LABEL = "アップロード中…";
export const NOT_FOUND_TITLE = "ページが見つかりません";
export const NOT_FOUND_HOME = "アップロード画面へ";
export const FILE_TOO_LARGE = "ファイルサイズが上限を超えています。";

const KIBIBYTE = 1024;
const MEBIBYTE = KIBIBYTE * KIBIBYTE;

export function fileHelp(extensions: readonly string[], maxBytes: number): string {
  const maximumMegabytes = Math.round(maxBytes / MEBIBYTE);
  return `${extensions.join(" / ")}、${maximumMegabytes} MB まで`;
}

export function fileSummary(name: string, bytes: number): string {
  const unit = bytes < MEBIBYTE ? "KB" : "MB";
  const size = bytes < MEBIBYTE ? bytes / KIBIBYTE : bytes / MEBIBYTE;
  return `${name}(${size.toFixed(1)} ${unit})`;
}
