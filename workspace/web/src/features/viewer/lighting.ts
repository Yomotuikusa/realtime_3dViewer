import type { Vec3 } from "@shared/types";

/** ワールド固定のライトの向き。 */
export interface LightAngles {
  /** 方位角(ラジアン)。[-π, π) に正規化して保持する */
  yaw: number;
  /** 仰角(ラジアン)。0 が水平、正が上方 */
  pitch: number;
}

export const DEFAULT_LIGHT_ANGLES: LightAngles = { yaw: Math.PI / 4, pitch: Math.PI / 4 };
export const MAX_LIGHT_PITCH = (85 * Math.PI) / 180;
export const LIGHT_ROTATE_SPEED = 0.008;
export const LIGHT_DISTANCE = 10;
export const AMBIENT_LIGHT_INTENSITY = 0.9;
export const KEY_LIGHT_INTENSITY = 2.2;
export const FILL_LIGHT_INTENSITY = 0.5;

const TAU = Math.PI * 2;

/** yaw を [-π, π) へ畳む。有限数でなければ 0。 */
export function normalizeYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) {
    return 0;
  }
  return ((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

/** pitch を ±MAX_LIGHT_PITCH に丸める。有限数でなければ 0。 */
export function clampPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) {
    return 0;
  }
  return Math.min(MAX_LIGHT_PITCH, Math.max(-MAX_LIGHT_PITCH, pitch));
}

/** ドラッグ量(px)ぶんライトを回した新しい角度を返す。 */
export function rotateLight(angles: LightAngles, deltaX: number, deltaY: number): LightAngles {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    return { ...angles };
  }
  return {
    yaw: normalizeYaw(angles.yaw + deltaX * LIGHT_ROTATE_SPEED),
    pitch: clampPitch(angles.pitch - deltaY * LIGHT_ROTATE_SPEED),
  };
}

/** 主ライトのワールド座標。 */
export function lightPosition(angles: LightAngles, distance = LIGHT_DISTANCE): Vec3 {
  const horizontal = distance * Math.cos(angles.pitch);
  return [
    horizontal * Math.sin(angles.yaw),
    distance * Math.sin(angles.pitch),
    horizontal * Math.cos(angles.yaw),
  ];
}

/** 補助ライトのワールド座標。 */
export function fillLightPosition(angles: LightAngles, distance = LIGHT_DISTANCE): Vec3 {
  return lightPosition(angles, distance).map((component) => -component) as Vec3;
}
