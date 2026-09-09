import { useEffect } from "react";
import { cameraEquals } from "@shared/camera";
import { CAMERA_SEND_INTERVAL_MS, type ClientMessage } from "@shared/protocol";
import type { CameraState } from "@shared/types";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { createCameraThrottle } from "./camera-throttle";

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
    const throttle = createCameraThrottle({
      send: (camera) => {
        if (!send({ type: "camera", camera })) {
          return false;
        }
        const selfId = useSessionStore.getState().selfId;
        if (selfId !== null) {
          usePresenceStore.getState().updateCamera(selfId, camera);
        }
        return true;
      },
      now: () => performance.now(),
      schedule: (fn, delayMs) => {
        const timeout = setTimeout(fn, delayMs);
        return () => clearTimeout(timeout);
      },
    });

    const unsubscribe = useCameraStore.subscribe((state) => {
      throttle.update(state.selfCamera);
    });
    return () => {
      throttle.dispose();
      unsubscribe();
    };
  }, [send]);
}
