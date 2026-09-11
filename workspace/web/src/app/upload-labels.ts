export const APP_NAME = "3D Reviewer";
export const UPLOAD_LEAD = "glTF / GLB をアップロードすると、共有用のレビュー URL が発行されます。";
export const PROJECT_NAME_LABEL = "プロジェクト名";
export const MODEL_FILE_LABEL = "モデルファイル";
export const MODEL_FILES_HELP_SUFFIX = "複数選択できます";
export const SUBMIT_LABEL = "レビューを開始";
export const SUBMITTING_LABEL = "アップロード中…";
export const NOT_FOUND_TITLE = "ページが見つかりません";
export const NOT_FOUND_HOME = "アップロード画面へ";
export const NO_FILE_SELECTED = "モデルファイルを選択してください。";
export const UNSUPPORTED_EXTENSION = "対応しているモデル形式は .glb と .gltf です。";
export const FILE_TOO_LARGE = "ファイルサイズが上限を超えています。";

export interface FileLike {
  name: string;
  size: number;
}

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

export function validateModelFiles(
  files: readonly FileLike[],
  extensions: readonly string[],
  maxBytes: number,
): string | null {
  if (files.length === 0) {
    return NO_FILE_SELECTED;
  }

  const hasUnsupportedExtension = files.some((file) => {
    const dotIndex = file.name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : "";
    return !extensions.some((allowed) => allowed === extension);
  });
  if (hasUnsupportedExtension) {
    return UNSUPPORTED_EXTENSION;
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  return totalBytes > maxBytes ? FILE_TOO_LARGE : null;
}

export function filesSummary(files: readonly FileLike[]): string {
  if (files.length === 1) {
    const file = files[0];
    if (file) {
      return fileSummary(file.name, file.size);
    }
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const unit = totalBytes < MEBIBYTE ? "KB" : "MB";
  const size = totalBytes < MEBIBYTE ? totalBytes / KIBIBYTE : totalBytes / MEBIBYTE;
  return `${files.length} ファイル(合計 ${size.toFixed(1)} ${unit})`;
}
