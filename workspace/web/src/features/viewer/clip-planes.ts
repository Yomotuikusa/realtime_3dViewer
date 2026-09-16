/** near = モデルの最大辺長 * この比 */
export const NEAR_PLANE_RATIO = 0.01;
/** far = モデルの最大辺長 * この比。far / near = 2×10^4 で three 既定と同じ深度精度を保つ */
export const FAR_PLANE_RATIO = 200;

export interface ClipPlanes {
  near: number;
  far: number;
}

/** modelSize が正の有限数でなければ 1 として扱う。 */
export function clipPlanesFor(modelSize: number): ClipPlanes {
  const size = Number.isFinite(modelSize) && modelSize > 0 ? modelSize : 1;
  return {
    near: size * NEAR_PLANE_RATIO,
    far: size * FAR_PLANE_RATIO,
  };
}
