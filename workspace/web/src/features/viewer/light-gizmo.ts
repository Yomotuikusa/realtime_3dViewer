import type { Vec3 } from "@shared/types";
import { lightPosition, type LightAngles } from "./lighting";

/** ギズモ Canvas の一辺(px)。CSS の幅と合わせる */
export const GIZMO_SIZE_PX = 112;
/** 立方体の一辺 */
export const GIZMO_BOX_SIZE = 1.4;
/** ライトマーカーが回る軌道半径と、マーカー球の半径 */
export const GIZMO_ORBIT_RADIUS = 2.2;
export const GIZMO_MARKER_RADIUS = 0.16;
/** ギズモを見る固定カメラの位置と画角(度)。メインカメラには連動しない */
export const GIZMO_CAMERA_POSITION: Vec3 = [0, 2.4, 4.6];
export const GIZMO_CAMERA_FOV = 40;
/** 矢印キー1回ぶんの水平移動量(px 相当)。rotate(deltaX, 0) に渡す */
export const GIZMO_KEY_STEP_PX = 20;

/** ライトマーカーのワールド座標。lightPosition(angles, GIZMO_ORBIT_RADIUS) と同じ */
export function gizmoMarkerPosition(angles: LightAngles): Vec3 {
  return lightPosition(angles, GIZMO_ORBIT_RADIUS);
}

/** ギズモ内の水平ドラッグ状態。 */
export interface GizmoDrag {
  pointerId: number;
  clientX: number;
}

/** pointermove 1回ぶんの水平ドラッグを回転量へ変換する。 */
export function gizmoDragStep(
  drag: GizmoDrag | null,
  pointerId: number,
  clientX: number,
): { deltaX: number; drag: GizmoDrag } | null {
  if (drag === null || drag.pointerId !== pointerId) {
    return null;
  }
  return { deltaX: clientX - drag.clientX, drag: { pointerId, clientX } };
}

/** 左右矢印キーの水平回転量。 */
export function gizmoKeyDeltaX(key: string): number | null {
  if (key === "ArrowLeft") {
    return -GIZMO_KEY_STEP_PX;
  }
  if (key === "ArrowRight") {
    return GIZMO_KEY_STEP_PX;
  }
  return null;
}

/** aria-valuenow 用の yaw の度数。 */
export function yawDegrees(yaw: number): number {
  return Math.round((yaw * 180) / Math.PI);
}

/** aria-valuetext 用の yaw 表示。 */
export function yawText(yaw: number): string {
  return `${yawDegrees(yaw)}°`;
}
