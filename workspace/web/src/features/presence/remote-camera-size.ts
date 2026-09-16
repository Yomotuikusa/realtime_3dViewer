/** 錐の底面半径 = モデルの最大辺長 * この比 */
export const REMOTE_CAMERA_RADIUS_RATIO = 0.12;
/** 錐の高さ = モデルの最大辺長 * この比 */
export const REMOTE_CAMERA_HEIGHT_RATIO = 0.3;
/** 名札の y オフセット = モデルの最大辺長 * この比 */
export const REMOTE_CAMERA_TAG_OFFSET_RATIO = 0.28;
/** 錐の分割数 */
export const REMOTE_CAMERA_SEGMENTS = 8;

export interface RemoteCameraSize {
  radius: number;
  height: number;
  tagOffset: number;
}

function scaledSize(modelSize: number, ratio: number): number {
  return Number.parseFloat((modelSize * ratio).toPrecision(15));
}

/** modelSize が正の有限数でなければ 1 として扱う。 */
export function remoteCameraSize(modelSize: number): RemoteCameraSize {
  const size = Number.isFinite(modelSize) && modelSize > 0 ? modelSize : 1;
  return {
    radius: scaledSize(size, REMOTE_CAMERA_RADIUS_RATIO),
    height: scaledSize(size, REMOTE_CAMERA_HEIGHT_RATIO),
    tagOffset: scaledSize(size, REMOTE_CAMERA_TAG_OFFSET_RATIO),
  };
}
