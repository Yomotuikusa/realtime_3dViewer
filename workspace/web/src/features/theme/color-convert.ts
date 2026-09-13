import { hexToNumber, normalizeHex, numberToHex } from "./viewer-colors";

/** h: 0 以上 360 未満、s / v: 0〜1 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** r / g / b: 0〜255 の整数 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 正規化できない値は黒として扱う。 */
export function hexToRgb(hex: string): Rgb {
  const trimmed = hex.trim();
  if (!trimmed.startsWith("#") && trimmed.length !== 6) return { r: 0, g: 0, b: 0 };
  const normalized = normalizeHex(hex);
  if (normalized === null) return { r: 0, g: 0, b: 0 };
  const value = hexToNumber(normalized);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function clampRgbComponent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.round(Math.min(255, Math.max(0, value)));
}

/** 各成分を丸めて #rrggbb へ変換する。 */
export function rgbToHex(rgb: Rgb): string {
  const r = clampRgbComponent(rgb.r);
  const g = clampRgbComponent(rgb.g);
  const b = clampRgbComponent(rgb.b);
  return numberToHex(r * 0x10000 + g * 0x100 + b);
}

/** #rrggbb を HSV へ変換する。 */
export function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, v: max };

  let hue: number;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** HSV を #rrggbb へ変換する。 */
export function hsvToHex(hsv: Hsv): string {
  const hue = Number.isFinite(hsv.h) ? ((hsv.h % 360) + 360) % 360 : 0;
  const saturation = clampUnit(hsv.s);
  const value = clampUnit(hsv.v);
  const chroma = value * saturation;
  const sector = hue / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector < 1) {
    red = chroma;
    green = secondary;
  } else if (sector < 2) {
    red = secondary;
    green = chroma;
  } else if (sector < 3) {
    green = chroma;
    blue = secondary;
  } else if (sector < 4) {
    green = secondary;
    blue = chroma;
  } else if (sector < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return rgbToHex({ r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 });
}

/** sRGB の相対輝度を返す。 */
export function relativeLuminance(hex: string): number {
  const linearize = (component: number): number => {
    const normalized = component / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const rgb = hexToRgb(hex);
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** 相対輝度が 0.35 未満かを返す。 */
export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.3;
}
