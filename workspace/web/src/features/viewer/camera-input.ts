import { MOUSE } from "three";
import type { Vec3 } from "@shared/types";

/** OrbitControls の mouseButtons と構造的に互換な最小型。 */
export interface ViewerMouseButtons {
  LEFT?: MOUSE;
  MIDDLE?: MOUSE;
  RIGHT?: MOUSE;
}

/** Alt 押下中の割り当て。RIGHT は自前 dolly が処理するため OrbitControls では無効。 */
export const MOUSE_BUTTONS_ALT: Readonly<ViewerMouseButtons> = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.PAN,
  RIGHT: undefined,
};

/** Alt 非押下中の割り当て。すべて無効で、左ドラッグはペン/コメントへ届く。 */
export const MOUSE_BUTTONS_IDLE: Readonly<ViewerMouseButtons> = {
  LEFT: undefined,
  MIDDLE: undefined,
  RIGHT: undefined,
};

export function mouseButtonsFor(altKey: boolean): Readonly<ViewerMouseButtons> {
  return altKey ? MOUSE_BUTTONS_ALT : MOUSE_BUTTONS_IDLE;
}

/** 右ドラッグ 1px あたりの dolly 係数。 */
export const DOLLY_SPEED = 0.005;
/** target とカメラの最小距離。これ以上は寄れない。 */
export const MIN_DOLLY_DISTANCE = 0.001;

/** 右ドラッグの水平移動量から target からの距離を変えた位置を返す。 */
export function dollyPosition(position: Vec3, target: Vec3, deltaX: number): Vec3 {
  if (deltaX === 0) {
    return [...position];
  }
  const offsetX = position[0] - target[0];
  const offsetY = position[1] - target[1];
  const offsetZ = position[2] - target[2];
  const distance = Math.hypot(offsetX, offsetY, offsetZ);
  if (distance === 0) {
    return [...position];
  }

  const nextDistance = Math.max(MIN_DOLLY_DISTANCE, distance * Math.exp(-DOLLY_SPEED * deltaX));
  const scale = nextDistance / distance;
  return [
    target[0] + offsetX * scale,
    target[1] + offsetY * scale,
    target[2] + offsetZ * scale,
  ];
}
