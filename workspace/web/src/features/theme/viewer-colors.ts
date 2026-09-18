import type { ResolvedThemeMode } from "./theme-mode";

/** 3D ビュー上で色を変えられる対象。 */
export type ViewerColorKey =
  | "background"
  | "selection"
  | "wireframe"
  | "joint"
  | "jointLink"
  | "jointSelected"
  | "trailLine"
  | "trailPoint"
  | "trailCurrent"
  | "compareOutside"
  | "compareInside";

/** 設定画面に並べる順。 */
export const VIEWER_COLOR_ORDER: readonly ViewerColorKey[] = [
  "background",
  "selection",
  "wireframe",
  "joint",
  "jointLink",
  "jointSelected",
  "trailLine",
  "trailPoint",
  "trailCurrent",
  "compareOutside",
  "compareInside",
];

/** 既定値からの差分。値は #rrggbb。 */
export type ViewerColorOverrides = Readonly<Partial<Record<ViewerColorKey, string>>>;
/** 全キーの実効色。 */
export type ViewerColors = Readonly<Record<ViewerColorKey, string>>;

/** 16 進入力欄の最大文字数。normalizeHex が受理する最長の形 "#rrggbb" */
export const HEX_INPUT_MAX_LENGTH = 7;

/** テーマごとの既定色。 */
export const VIEWER_COLOR_DEFAULTS: Readonly<Record<ResolvedThemeMode, ViewerColors>> = {
  light: {
    background: "#f5f7fa",
    selection: "#f97316",
    wireframe: "#c026d3",
    joint: "#22d3ee",
    jointLink: "#0e7490",
    jointSelected: "#f97316",
    trailLine: "#facc15",
    trailPoint: "#fef3c7",
    trailCurrent: "#f97316",
    compareOutside: "#dc2626",
    compareInside: "#2563eb",
  },
  dark: {
    background: "#14171f",
    selection: "#fb923c",
    wireframe: "#e879f9",
    joint: "#22d3ee",
    jointLink: "#38bdf8",
    jointSelected: "#fb923c",
    trailLine: "#facc15",
    trailPoint: "#fde68a",
    trailCurrent: "#fb923c",
    compareOutside: "#f87171",
    compareInside: "#60a5fa",
  },
};

/** 各種の #RGB 表記を小文字の #rrggbb へ正規化する。 */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return null;
  const expanded = trimmed.length === 3
    ? trimmed.split("").map((digit) => `${digit}${digit}`).join("")
    : trimmed;
  return `#${expanded.toLowerCase()}`;
}

/** #rrggbb を three の material 用の数値へ変換する。 */
export function hexToNumber(hex: string): number {
  const normalized = normalizeHex(hex);
  return normalized === null ? 0x000000 : Number.parseInt(normalized.slice(1), 16);
}

/** three の色の数値を #rrggbb へ変換する。 */
export function numberToHex(value: number): string {
  if (Number.isNaN(value)) return "#000000";
  const clamped = Math.min(0xffffff, Math.max(0, value));
  const rounded = Math.round(clamped);
  return `#${rounded.toString(16).padStart(6, "0")}`;
}

/** 既定値からの差分を含めた 1 色を返す。 */
export function resolveViewerColor(
  mode: ResolvedThemeMode,
  overrides: ViewerColorOverrides,
  key: ViewerColorKey,
): string {
  return Object.hasOwn(overrides, key) ? overrides[key]! : VIEWER_COLOR_DEFAULTS[mode][key];
}

/** 既定値からの差分を含めた全色を返す。 */
export function resolveViewerColors(
  mode: ResolvedThemeMode,
  overrides: ViewerColorOverrides,
): ViewerColors {
  const colors = {} as Record<ViewerColorKey, string>;
  for (const key of VIEWER_COLOR_ORDER) {
    colors[key] = resolveViewerColor(mode, overrides, key);
  }
  return colors;
}
