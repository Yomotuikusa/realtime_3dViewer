import {
  DEFAULT_FOCAL_LENGTH_MM,
  MAX_FOCAL_LENGTH_MM,
  MIN_FOCAL_LENGTH_MM,
  type CameraState,
  type Vec3,
} from "./types";

/** モデルロード前の初期視点 */
export const DEFAULT_CAMERA: CameraState = { position: [3, 3, 3], target: [0, 0, 0] };

const DEFAULT_EPSILON = 1e-4;

export function vec3Equals(a: Vec3, b: Vec3, eps = DEFAULT_EPSILON): boolean {
  return (
    Math.abs(a[0] - b[0]) <= eps &&
    Math.abs(a[1] - b[1]) <= eps &&
    Math.abs(a[2] - b[2]) <= eps
  );
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function cameraEquals(a: CameraState, b: CameraState, eps = DEFAULT_EPSILON): boolean {
  return vec3Equals(a.position, b.position, eps) && vec3Equals(a.target, b.target, eps);
}

export function lerpCamera(from: CameraState, to: CameraState, t: number): CameraState {
  const clampedT = Number.isNaN(t) ? 0 : Math.max(0, Math.min(1, t));
  return {
    position: lerpVec3(from.position, to.position, clampedT),
    target: lerpVec3(from.target, to.target, clampedT),
  };
}

export function cloneCamera(c: CameraState): CameraState {
  return { position: [...c.position], target: [...c.target] };
}

/**
 * 焦点距離(mm)を [MIN_FOCAL_LENGTH_MM, MAX_FOCAL_LENGTH_MM] に丸める。
 * 有限数でない値は DEFAULT_FOCAL_LENGTH_MM を返す。
 */
export function clampFocalLength(focalLengthMm: number): number {
  if (!Number.isFinite(focalLengthMm)) return DEFAULT_FOCAL_LENGTH_MM;
  return Math.max(MIN_FOCAL_LENGTH_MM, Math.min(MAX_FOCAL_LENGTH_MM, focalLengthMm));
}
