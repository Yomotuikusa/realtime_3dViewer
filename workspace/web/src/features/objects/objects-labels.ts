export const OBJECTS_HEADING = "オブジェクト";
export const VISIBLE_LABEL = "表示中";
export const HIDDEN_LABEL = "非表示";
export const ADD_FILES_LABEL = "ファイルを追加";
export const ADDING_LABEL = "追加中…";
export const ADD_FAILED = "ファイルの追加に失敗しました。";

/** "オブジェクト (N)" */
export function objectsHeading(count: number): string {
  return `${OBJECTS_HEADING} (${count})`;
}

/** "v<number>" */
export function versionTag(version: { number: number }): string {
  return `v${version.number}`;
}

/** "<fileName> の表示を切り替え" */
export function toggleAriaLabel(version: { fileName: string }): string {
  return `${version.fileName} の表示を切り替え`;
}
