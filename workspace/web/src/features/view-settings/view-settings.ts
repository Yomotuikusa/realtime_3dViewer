import {
  BASE_LINE_WIDTH,
  OVERLAY_OPACITY_RATIO,
} from "../annotation/stroke-overlay";

export type ViewSettingKey =
  | "strokeWidth"
  | "overlayOpacityRatio"
  | "selectionOpacity"
  | "wireframeOverlayOpacity"
  | "dollySensitivity"
  | "lightRotateSensitivity"
  | "jointRadiusScale"
  | "jointPickRadiusPx"
  | "outlinerRowHeightRem"
  | "outlinerIndentPx";

export type ViewSettingGroup = "annotation" | "viewer" | "input" | "joint" | "outliner";
export type ViewSettingUnit = "px" | "rem" | "ratio" | "scale";

export interface ViewSettingSpec {
  group: ViewSettingGroup;
  unit: ViewSettingUnit;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}

export const VIEW_SETTING_GROUP_ORDER: readonly ViewSettingGroup[] = [
  "annotation", "viewer", "input", "joint", "outliner",
];

export const VIEW_SETTING_ORDER: readonly ViewSettingKey[] = [
  "strokeWidth",
  "overlayOpacityRatio",
  "selectionOpacity",
  "wireframeOverlayOpacity",
  "dollySensitivity",
  "lightRotateSensitivity",
  "jointRadiusScale",
  "jointPickRadiusPx",
  "outlinerRowHeightRem",
  "outlinerIndentPx",
];

export const VIEW_SETTING_SPECS: Readonly<Record<ViewSettingKey, ViewSettingSpec>> = {
  strokeWidth: { group: "annotation", unit: "px", defaultValue: BASE_LINE_WIDTH, min: 1, max: 8, step: 0.5 },
  overlayOpacityRatio: { group: "annotation", unit: "ratio", defaultValue: OVERLAY_OPACITY_RATIO, min: 0.05, max: 1, step: 0.05 },
  selectionOpacity: { group: "viewer", unit: "ratio", defaultValue: 0.6, min: 0.1, max: 1, step: 0.05 },
  wireframeOverlayOpacity: { group: "viewer", unit: "ratio", defaultValue: 0.6, min: 0.1, max: 1, step: 0.05 },
  dollySensitivity: { group: "input", unit: "scale", defaultValue: 1, min: 0.25, max: 4, step: 0.25 },
  lightRotateSensitivity: { group: "input", unit: "scale", defaultValue: 1, min: 0.25, max: 4, step: 0.25 },
  jointRadiusScale: { group: "joint", unit: "scale", defaultValue: 1, min: 0.25, max: 4, step: 0.25 },
  jointPickRadiusPx: { group: "joint", unit: "px", defaultValue: 12, min: 4, max: 32, step: 1 },
  outlinerRowHeightRem: { group: "outliner", unit: "rem", defaultValue: 1.75, min: 1.25, max: 2.5, step: 0.125 },
  outlinerIndentPx: { group: "outliner", unit: "px", defaultValue: 16, min: 8, max: 32, step: 4 },
};

export type ViewSettings = Readonly<Record<ViewSettingKey, number>>;

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  strokeWidth: VIEW_SETTING_SPECS.strokeWidth.defaultValue,
  overlayOpacityRatio: VIEW_SETTING_SPECS.overlayOpacityRatio.defaultValue,
  selectionOpacity: VIEW_SETTING_SPECS.selectionOpacity.defaultValue,
  wireframeOverlayOpacity: VIEW_SETTING_SPECS.wireframeOverlayOpacity.defaultValue,
  dollySensitivity: VIEW_SETTING_SPECS.dollySensitivity.defaultValue,
  lightRotateSensitivity: VIEW_SETTING_SPECS.lightRotateSensitivity.defaultValue,
  jointRadiusScale: VIEW_SETTING_SPECS.jointRadiusScale.defaultValue,
  jointPickRadiusPx: VIEW_SETTING_SPECS.jointPickRadiusPx.defaultValue,
  outlinerRowHeightRem: VIEW_SETTING_SPECS.outlinerRowHeightRem.defaultValue,
  outlinerIndentPx: VIEW_SETTING_SPECS.outlinerIndentPx.defaultValue,
};

export function isViewSettingKey(value: unknown): value is ViewSettingKey {
  return typeof value === "string" && VIEW_SETTING_ORDER.includes(value as ViewSettingKey);
}

export function clampViewSetting(key: ViewSettingKey, value: number): number {
  const spec = VIEW_SETTING_SPECS[key];
  if (!Number.isFinite(value)) return spec.defaultValue;
  return Math.min(spec.max, Math.max(spec.min, value));
}
