import { cameraEquals, cloneCamera, lerpCamera } from "@shared/camera";
import type { CameraState, PresenceUser } from "@shared/types";

/** 1 フレームあたりの補間係数(§16.2 の t≈0.2) */
export const FOLLOW_LERP_T = 0.2;

/** 追従先の視点情報。 */
export interface FollowTarget {
  camera: CameraState;
  /** 追従先がまだ焦点距離を送っていなければ null */
  focalLength: number | null;
}

/** 追従対象が有効な場合だけ、対象カメラの独立した複製を返す。 */
export function followTargetCamera(
  users: Record<string, PresenceUser>,
  followingUserId: string | null,
  selfId: string | null,
): FollowTarget | null {
  if (followingUserId === null || (selfId !== null && followingUserId === selfId)) {
    return null;
  }

  const user = users[followingUserId];
  if (user === undefined || user.camera === null) {
    return null;
  }
  return { camera: cloneCamera(user.camera), focalLength: user.focalLength ?? null };
}

/** 現在のカメラを対象へ 1 フレーム分近づける。 */
export function followStep(
  current: CameraState,
  target: CameraState,
): { camera: CameraState; arrived: boolean } {
  const camera = lerpCamera(current, target, FOLLOW_LERP_T);
  return { camera, arrived: cameraEquals(camera, target) };
}
