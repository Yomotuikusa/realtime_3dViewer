import type { CameraState, Vec3 } from "@shared/types";
import { DEFAULT_CAMERA } from "@shared/camera";
import { MIN_PRESET_DISTANCE } from "./view-presets";

/**
 * 全体表示で使う、注視点からカメラへ向かう単位方向。
 * DEFAULT_CAMERA の position - target を正規化した値。
 */
const defaultDirection: Vec3 = [
  DEFAULT_CAMERA.position[0] - DEFAULT_CAMERA.target[0],
  DEFAULT_CAMERA.position[1] - DEFAULT_CAMERA.target[1],
  DEFAULT_CAMERA.position[2] - DEFAULT_CAMERA.target[2],
];
const defaultDistance = Math.hypot(...defaultDirection);

export const FIT_DIRECTION: Vec3 = [
  defaultDirection[0] / defaultDistance,
  defaultDirection[1] / defaultDistance,
  defaultDirection[2] / defaultDistance,
];

/** 注視点を中心に、初期視点と同じ斜め方向から全体を見るカメラを作る。 */
export function fitCamera(center: Vec3, distance: number): CameraState {
  const safeDistance = Number.isFinite(distance) && distance >= MIN_PRESET_DISTANCE
    ? distance
    : MIN_PRESET_DISTANCE;
  return {
    position: [
      center[0] + FIT_DIRECTION[0] * safeDistance,
      center[1] + FIT_DIRECTION[1] * safeDistance,
      center[2] + FIT_DIRECTION[2] * safeDistance,
    ],
    target: [center[0], center[1], center[2]],
  };
}
