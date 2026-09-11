export const OBJECTS_HEADING = "オブジェクト";
export const VISIBLE_LABEL = "表示中";
export const HIDDEN_LABEL = "非表示";
export const ADD_FILES_LABEL = "ファイルを追加";
export const ADDING_LABEL = "追加中…";
export const ADD_FAILED = "ファイルの追加に失敗しました。";
export const COMPARE_HEADING = "比較";
export const COMPARE_BASE_LABEL = "基準";
export const COMPARE_TARGET_LABEL = "対象";
export const COMPARE_NONE_LABEL = "なし";
export const COMPARE_THRESHOLD_LABEL = "しきい値";
export const COMPARE_LEGEND = "赤: 対象が基準から飛び出し / 青: へこみ";

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

/** "v<number> · <fileName>" */
export function compareOptionLabel(version: { number: number; fileName: string }): string {
  return `v${version.number} · ${version.fileName}`;
}

/** 千分率を小数1桁の百分率で表す。 */
export function thresholdPermilleText(permille: number): string {
  return `${(permille / 10).toFixed(1)}%`;
}
