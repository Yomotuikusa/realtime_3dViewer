import {
  VIEW_SETTING_SPECS,
  type ViewSettingGroup,
  type ViewSettingKey,
} from "./view-settings";

export const VIEW_SETTINGS_TITLE = "表示と操作";
export const VIEW_SETTINGS_HELP = "この端末だけに保存され、他の参加者の見え方は変わりません。";
export const VIEW_SETTING_GROUP_LABELS: Readonly<Record<ViewSettingGroup, string>> = {
  annotation: "注釈",
  viewer: "3D ビュー",
  input: "操作",
  joint: "ジョイント",
  outliner: "アウトライナ",
};
export const VIEW_SETTING_LABELS: Readonly<Record<ViewSettingKey, string>> = {
  strokeWidth: "線の太さ",
  overlayOpacityRatio: "透過線の濃さ",
  selectionOpacity: "選択の重ね描きの濃さ",
  wireframeOverlayOpacity: "ワイヤーの重ね描きの濃さ",
  dollySensitivity: "寄り引き(Alt+右ドラッグ)の感度",
  lightRotateSensitivity: "ライト回転の感度",
  jointRadiusScale: "ジョイント球の大きさ",
  jointPickRadiusPx: "ジョイントを拾う半径",
  outlinerRowHeightRem: "行の高さ",
  outlinerIndentPx: "階層の字下げ",
};
export const RESET_VIEW_SETTING_LABEL = "既定に戻す";
export const RESET_VIEW_SETTINGS_LABEL = "すべて既定に戻す";

export function formatViewSetting(key: ViewSettingKey, value: number): string {
  const unit = VIEW_SETTING_SPECS[key].unit;
  if (unit === "px") return `${Number(value.toFixed(1))}px`;
  if (unit === "rem") return `${Number(value.toFixed(3))}rem`;
  if (unit === "ratio") return `${Math.round(value * 100)}%`;
  return `×${value.toFixed(2)}`;
}
