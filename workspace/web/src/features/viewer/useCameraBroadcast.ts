import { useEffect } from "react";
import { cameraEquals, cloneCamera } from "@shared/camera";
import { CAMERA_SEND_INTERVAL_MS, type ClientMessage } from "@shared/protocol";
import type { CameraState } from "@shared/types";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";

export function shouldSendCamera(
  prev: CameraState | null,
  next: CameraState,
  lastSentAt: number,
  now: number,
): boolean {
  if (now - lastSentAt < CAMERA_SEND_INTERVAL_MS) {
    return false;
  }
  return prev === null || !cameraEquals(prev, next);
}

export function useCameraBroadcast(send: (msg: ClientMessage) => boolean): void {
  useEffect(() => {
    let previousSentCamera: CameraState | null = null;
    let lastSentAt = 0;

    return useCameraStore.subscribe((state) => {
      const now = performance.now();
      if (!shouldSendCamera(previousSentCamera, state.selfCamera, lastSentAt, now)) {
        return;
      }
      const camera = cloneCamera(state.selfCamera);
      if (send({ type: "camera", camera })) {
        previousSentCamera = camera;
        lastSentAt = now;
        const selfId = useSessionStore.getState().selfId;
        if (selfId !== null) {
          usePresenceStore.getState().updateCamera(selfId, camera);
        }
      }
    });
  }, [send]);
}
