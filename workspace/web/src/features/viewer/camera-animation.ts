import type { CameraState } from "@shared/types";
import { cloneCamera, lerpCamera } from "@shared/camera";

/** 既定視点・視点再現の補間にかける時間(ms)。 */
export const CAMERA_ANIMATION_DURATION_MS = 300;

/** 進行中の補間。from / to は開始時に複製した独立の値。 */
export interface CameraAnimation {
  from: CameraState;
  to: CameraState;
  /** performance.now() 基準の開始時刻(ms) */
  startedAt: number;
}

/** 0→1 を減速しながら進む。1 - (1 - t)^3 */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** from / to を複製して補間を開始する。 */
export function startCameraAnimation(
  from: CameraState,
  to: CameraState,
  startedAt: number,
): CameraAnimation {
  return { from: cloneCamera(from), to: cloneCamera(to), startedAt };
}

/** 指定時刻の補間結果を返す。animation 自体は変更しない。 */
export function stepCameraAnimation(
  animation: CameraAnimation,
  now: number,
): { camera: CameraState; done: boolean } {
  const t = (now - animation.startedAt) / CAMERA_ANIMATION_DURATION_MS;
  if (t >= 1) {
    return { camera: cloneCamera(animation.to), done: true };
  }
  return {
    camera: lerpCamera(animation.from, animation.to, easeOutCubic(Math.max(0, t))),
    done: false,
  };
}

/** OrbitControls の減衰の残りを一度に適用して打ち切る。 */
export interface DampedControlsLike {
  enableDamping: boolean;
  update(): boolean | void;
}

export function flushControlsInertia(controls: DampedControlsLike): void {
  const originalEnableDamping = controls.enableDamping;
  try {
    controls.enableDamping = false;
    controls.update();
  } finally {
    controls.enableDamping = originalEnableDamping;
  }
}
