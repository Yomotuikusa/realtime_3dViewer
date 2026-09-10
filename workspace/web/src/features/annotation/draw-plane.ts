import type { Vec3 } from "@shared/types";

/** レイと平面が平行と見なす閾値。 */
export const PARALLEL_EPSILON = 1e-6;

/** 描画の基準平面。normal は単位ベクトル。 */
export interface DrawPlane {
  origin: Vec3;
  normal: Vec3;
}

/** direction は正規化済みのレイ。 */
export interface DrawRay {
  origin: Vec3;
  direction: Vec3;
}

export function viewPlaneAt(position: Vec3, target: Vec3): DrawPlane | null {
  const x = target[0] - position[0];
  const y = target[1] - position[1];
  const z = target[2] - position[2];
  const length = Math.hypot(x, y, z);
  if (length === 0) {
    return null;
  }
  return {
    origin: [target[0], target[1], target[2]],
    normal: [x / length, y / length, z / length],
  };
}

export function intersectPlane(ray: DrawRay, plane: DrawPlane): Vec3 | null {
  const denominator = ray.direction[0] * plane.normal[0]
    + ray.direction[1] * plane.normal[1]
    + ray.direction[2] * plane.normal[2];
  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return null;
  }

  const t = ((plane.origin[0] - ray.origin[0]) * plane.normal[0]
    + (plane.origin[1] - ray.origin[1]) * plane.normal[1]
    + (plane.origin[2] - ray.origin[2]) * plane.normal[2]) / denominator;
  if (t <= 0) {
    return null;
  }
  return [
    ray.origin[0] + ray.direction[0] * t,
    ray.origin[1] + ray.direction[1] * t,
    ray.origin[2] + ray.direction[2] * t,
  ];
}
