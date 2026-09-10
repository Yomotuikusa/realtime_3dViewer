import { cameraEquals, cloneCamera } from "@shared/camera";
import { CAMERA_SEND_INTERVAL_MS } from "@shared/protocol";
import type { CameraState } from "@shared/types";

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

export interface CameraThrottle {
  /** 最新の視点情報を通知する。間隔内なら保持し、窓明けに最新値だけを送る */
  update(payload: CameraPayload): void;
  /** 保留中の送信とタイマーを破棄する */
  dispose(): void;
}

export function createCameraThrottle(deps: CameraThrottleDeps): CameraThrottle {
  const intervalMs = deps.intervalMs ?? CAMERA_SEND_INTERVAL_MS;
  let lastSentPayload: CameraPayload | null = null;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let pendingPayload: CameraPayload | null = null;
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
    if (disposed || pendingPayload === null) {
      return;
    }

    const now = deps.now();
    if (now - lastSentAt < intervalMs) {
      schedulePending(intervalMs - (now - lastSentAt));
      return;
    }

    const payload = clonePayload(pendingPayload);
    if (lastSentPayload !== null && payloadEquals(lastSentPayload, payload)) {
      pendingPayload = null;
      return;
    }
    if (deps.send(payload)) {
      lastSentPayload = clonePayload(payload);
      lastSentAt = now;
      pendingPayload = null;
      clearSchedule();
      return;
    }
    schedulePending(intervalMs);
  };

  const update = (payload: CameraPayload): void => {
    if (disposed) {
      return;
    }
    const nextPayload = clonePayload(payload);
    if (lastSentPayload !== null && payloadEquals(lastSentPayload, nextPayload)) {
      pendingPayload = null;
      clearSchedule();
      return;
    }
    pendingPayload = nextPayload;
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
      pendingPayload = null;
      clearSchedule();
    },
  };
}

function clonePayload(payload: CameraPayload): CameraPayload {
  return { camera: cloneCamera(payload.camera), focalLength: payload.focalLength };
}
