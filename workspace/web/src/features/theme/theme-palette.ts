import { isDarkColor } from "./color-convert";

export interface PaletteSwatch {
  /** "#rrggbb" の小文字 */
  hex: string;
  /** 日本語の色名 */
  name: string;
}

/** 表示色設定で選べる固定パレット。 */
export const THEME_PALETTE: readonly PaletteSwatch[] = [
  { hex: "#ffffff", name: "白" },
  { hex: "#d0d5dd", name: "明るい灰" },
  { hex: "#fca5a5", name: "明るい赤" },
  { hex: "#fdba74", name: "明るい橙" },
  { hex: "#fde68a", name: "明るい黄" },
  { hex: "#86efac", name: "明るい緑" },
  { hex: "#67e8f9", name: "明るい水" },
  { hex: "#93c5fd", name: "明るい青" },
  { hex: "#d8b4fe", name: "明るい紫" },
  { hex: "#98a2b3", name: "灰" },
  { hex: "#667085", name: "暗い灰" },
  { hex: "#dc2626", name: "赤" },
  { hex: "#f97316", name: "橙" },
  { hex: "#facc15", name: "黄" },
  { hex: "#16a34a", name: "緑" },
  { hex: "#22d3ee", name: "水" },
  { hex: "#2563eb", name: "青" },
  { hex: "#9333ea", name: "紫" },
  { hex: "#101828", name: "墨" },
  { hex: "#000000", name: "黒" },
  { hex: "#7f1d1d", name: "暗い赤" },
  { hex: "#9a3412", name: "暗い橙" },
  { hex: "#a16207", name: "暗い黄" },
  { hex: "#14532d", name: "暗い緑" },
  { hex: "#0e7490", name: "暗い水" },
  { hex: "#1e3a8a", name: "暗い青" },
  { hex: "#581c87", name: "暗い紫" },
];

/** THEME_PALETTE を並べるときの 1 行の数。 */
export const THEME_PALETTE_COLUMNS = 9;

/** 明るい色の上に置く印の色。 */
export const SWATCH_MARK_DARK = "#101828";
/** 暗い色の上に置く印の色。 */
export const SWATCH_MARK_LIGHT = "#ffffff";

/** 暗色のスウォッチには明るい印を、それ以外には暗い印を返す。 */
export function swatchMarkColor(hex: string): string {
  return isDarkColor(hex) ? SWATCH_MARK_LIGHT : SWATCH_MARK_DARK;
}
