import { clampFocalLength } from "@shared/camera";
import { DEFAULT_FOCAL_LENGTH_MM } from "@shared/types";

/** フルサイズ相当のセンサー高(mm)。焦点距離と垂直画角の換算に使う */
export const SENSOR_HEIGHT_MM = 24;

/** スライダーの刻み(mm) */
export const FOCAL_LENGTH_STEP_MM = 1;

/** 焦点距離(mm)から three.js の垂直画角(度)へ換算する。 */
export function fovFromFocalLength(focalLengthMm: number): number {
  const focalLength = clampFocalLength(focalLengthMm);
  return 2 * Math.atan((SENSOR_HEIGHT_MM / 2) / focalLength) * 180 / Math.PI;
}

/** three.js の垂直画角(度)から焦点距離(mm)へ換算する。 */
export function focalLengthFromFov(fovDeg: number): number {
  if (!Number.isFinite(fovDeg)) {
    return clampFocalLength(Number.NaN);
  }
  const focalLength = (SENSOR_HEIGHT_MM / 2) / Math.tan(fovDeg * Math.PI / 180 / 2);
  const clampableFocalLength = focalLength === Number.POSITIVE_INFINITY
    ? Number.MAX_VALUE
    : focalLength === Number.NEGATIVE_INFINITY
      ? -Number.MAX_VALUE
      : focalLength;
  return clampFocalLength(clampableFocalLength);
}

/** DEFAULT_FOCAL_LENGTH_MM に対応する既定の垂直画角(度)。 */
export const DEFAULT_FOV = fovFromFocalLength(DEFAULT_FOCAL_LENGTH_MM);
