import { cameraEquals, cloneCamera } from "@shared/camera";
import { CAMERA_SEND_INTERVAL_MS } from "@shared/protocol";
import type { CameraState } from "@shared/types";
import { createSendThrottle, type SendThrottle } from "./send-throttle";

/** 1回の送信で運ぶ視点情報。 */
export interface CameraPayload {
  camera: CameraState;
  /** 送信時点の焦点距離(mm) */
  focalLength: number;
}

/** camera が同値、かつ焦点距離が厳密に等しいかを判定する。 */
export function payloadEquals(a: CameraPayload, b: CameraPayload): boolean {
  return cameraEquals(a.camera, b.camera) && a.focalLength === b.focalLength;
}

export interface CameraThrottleDeps {
  /** 送信。false なら未送信扱い(次の機会に再送) */
  send: (payload: CameraPayload) => boolean;
  now: () => number;
  /** delayMs 後に fn を呼ぶ。戻り値はキャンセル関数 */
  schedule: (fn: () => void, delayMs: number) => () => void;
  intervalMs?: number;
}

export type CameraThrottle = SendThrottle<CameraPayload>;

export function createCameraThrottle(deps: CameraThrottleDeps): CameraThrottle {
  return createSendThrottle<CameraPayload>({
    ...deps,
    intervalMs: deps.intervalMs ?? CAMERA_SEND_INTERVAL_MS,
    equals: payloadEquals,
    clone: clonePayload,
  });
}

function clonePayload(payload: CameraPayload): CameraPayload {
  return { camera: cloneCamera(payload.camera), focalLength: payload.focalLength };
}
