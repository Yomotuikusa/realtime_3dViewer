import { hexToHsv, hexToRgb, hsvToHex } from "./color-convert";

/** canvas の一辺(px)。正方形 */
export const WHEEL_SIZE = 176;
/** 色相リングの外半径 */
export const WHEEL_RING_OUTER = 88;
/** 色相リングの内半径 */
export const WHEEL_RING_INNER = 66;
/** 中央の彩度明度の四角の一辺。内半径の円に収まる大きさ */
export const WHEEL_SQUARE = 92;
/** 四角の左上の座標 */
export const WHEEL_SQUARE_ORIGIN = 42;

const WHEEL_CENTER = WHEEL_SIZE / 2;
const WHEEL_RING_RADIUS = (WHEEL_RING_OUTER + WHEEL_RING_INNER) / 2;

/** canvas 座標 */
export interface WheelPoint {
  x: number;
  y: number;
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeHue(hue: number): number {
  return Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : 0;
}

/** 中心から見た向きを色相へ変換する。 */
export function hueAtPoint(point: WheelPoint): number {
  const dx = point.x - WHEEL_CENTER;
  const dy = point.y - WHEEL_CENTER;
  if (dx === 0 && dy === 0) return 0;
  return normalizeHue((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/** 色相をリング中央上の canvas 座標へ変換する。 */
export function pointAtHue(hue: number): WheelPoint {
  const radians = (normalizeHue(hue) * Math.PI) / 180;
  return {
    x: WHEEL_CENTER + Math.sin(radians) * WHEEL_RING_RADIUS,
    y: WHEEL_CENTER - Math.cos(radians) * WHEEL_RING_RADIUS,
  };
}

/** 中心からの距離がリング内かを返す。 */
export function isInRing(point: WheelPoint): boolean {
  const distanceSquared = (point.x - WHEEL_CENTER) ** 2 + (point.y - WHEEL_CENTER) ** 2;
  return distanceSquared >= WHEEL_RING_INNER ** 2 && distanceSquared <= WHEEL_RING_OUTER ** 2;
}

/** 四角の内側かを返す。 */
export function isInSquare(point: WheelPoint): boolean {
  const end = WHEEL_SQUARE_ORIGIN + WHEEL_SQUARE;
  return point.x >= WHEEL_SQUARE_ORIGIN && point.x <= end
    && point.y >= WHEEL_SQUARE_ORIGIN && point.y <= end;
}

/** 座標から彩度と明度を求める。 */
export function saturationValueAtPoint(point: WheelPoint): { s: number; v: number } {
  return {
    s: clampUnit((point.x - WHEEL_SQUARE_ORIGIN) / WHEEL_SQUARE),
    v: clampUnit(1 - (point.y - WHEEL_SQUARE_ORIGIN) / WHEEL_SQUARE),
  };
}

/** 彩度と明度を四角の座標へ変換する。 */
export function pointAtSaturationValue(s: number, v: number): WheelPoint {
  return {
    x: WHEEL_SQUARE_ORIGIN + clampUnit(s) * WHEEL_SQUARE,
    y: WHEEL_SQUARE_ORIGIN + (1 - clampUnit(v)) * WHEEL_SQUARE,
  };
}

/** 押された座標に対応する新しい色を返す。 */
export function colorAtPoint(point: WheelPoint, hex: string): string | null {
  const current = hexToHsv(hex);
  if (isInRing(point)) {
    const isAchromatic = current.s === 0 || current.v === 0;
    return hsvToHex({ h: hueAtPoint(point), s: isAchromatic ? 1 : current.s, v: isAchromatic ? 1 : current.v });
  }
  if (isInSquare(point)) {
    const { s, v } = saturationValueAtPoint(point);
    return hsvToHex({ h: current.h, s, v });
  }
  return null;
}

/** 色相を反映したホイール画像を生成する。 */
export function renderWheelImage(hue: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WHEEL_SIZE * WHEEL_SIZE * 4);
  for (let y = 0; y < WHEEL_SIZE; y += 1) {
    for (let x = 0; x < WHEEL_SIZE; x += 1) {
      const point = { x, y };
      const inRing = isInRing(point);
      if (!inRing && !isInSquare(point)) continue;
      const hsv = inRing
        ? { h: hueAtPoint(point), s: 1, v: 1 }
        : { h: hue, ...saturationValueAtPoint(point) };
      const offset = (y * WHEEL_SIZE + x) * 4;
      const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
      pixels[offset] = rgb.r;
      pixels[offset + 1] = rgb.g;
      pixels[offset + 2] = rgb.b;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function hsvToRgb(hue: number, saturation: number, value: number): { r: number; g: number; b: number } {
  return hexToRgb(hsvToHex({ h: hue, s: saturation, v: value }));
}
