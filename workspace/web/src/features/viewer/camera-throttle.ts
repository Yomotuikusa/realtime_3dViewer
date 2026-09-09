import { cameraEquals, cloneCamera } from "@shared/camera";
import { CAMERA_SEND_INTERVAL_MS } from "@shared/protocol";
import type { CameraState } from "@shared/types";

export interface CameraThrottleDeps {
  /** 送信。false なら未送信扱い(次の機会に再送) */
  send: (camera: CameraState) => boolean;
  now: () => number;
  /** delayMs 後に fn を呼ぶ。戻り値はキャンセル関数 */
  schedule: (fn: () => void, delayMs: number) => () => void;
  intervalMs?: number;
}

export interface CameraThrottle {
  /** 最新のカメラを通知する。間隔内なら保持し、窓明けに最新値だけを送る */
  update(camera: CameraState): void;
  /** 保留中の送信とタイマーを破棄する */
  dispose(): void;
}

export function createCameraThrottle(deps: CameraThrottleDeps): CameraThrottle {
  const intervalMs = deps.intervalMs ?? CAMERA_SEND_INTERVAL_MS;
  let lastSentCamera: CameraState | null = null;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let pendingCamera: CameraState | null = null;
  let cancelScheduled: (() => void) | null = null;
  let disposed = false;

  const clearSchedule = (): void => {
    cancelScheduled?.();
    cancelScheduled = null;
  };

  const schedulePending = (delayMs: number): void => {
    if (cancelScheduled !== null || disposed) {
      return;
    }
    cancelScheduled = deps.schedule(() => {
      cancelScheduled = null;
      trySendPending();
    }, delayMs);
  };

  const trySendPending = (): void => {
    if (disposed || pendingCamera === null) {
      return;
    }

    const now = deps.now();
    if (now - lastSentAt < intervalMs) {
      schedulePending(intervalMs - (now - lastSentAt));
      return;
    }

    const camera = cloneCamera(pendingCamera);
    if (lastSentCamera !== null && cameraEquals(lastSentCamera, camera)) {
      pendingCamera = null;
      return;
    }
    if (deps.send(camera)) {
      lastSentCamera = cloneCamera(camera);
      lastSentAt = now;
      pendingCamera = null;
      clearSchedule();
      return;
    }
    schedulePending(intervalMs);
  };

  const update = (camera: CameraState): void => {
    if (disposed) {
      return;
    }
    const nextCamera = cloneCamera(camera);
    if (lastSentCamera !== null && cameraEquals(lastSentCamera, nextCamera)) {
      pendingCamera = null;
      clearSchedule();
      return;
    }
    pendingCamera = nextCamera;
    const now = deps.now();
    if (now - lastSentAt < intervalMs) {
      schedulePending(intervalMs - (now - lastSentAt));
      return;
    }
    trySendPending();
  };

  return {
    update,
    dispose() {
      disposed = true;
      pendingCamera = null;
      clearSchedule();
    },
  };
}
