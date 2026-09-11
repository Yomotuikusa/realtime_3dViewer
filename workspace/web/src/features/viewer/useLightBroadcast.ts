import { useEffect } from "react";
import { LIGHT_SEND_INTERVAL_MS, type ClientMessage } from "@shared/protocol";
import type { LightAngles } from "@shared/types";
import { useLightingStore, type LightAnglesOrigin } from "../../store/lighting";
import { createSendThrottle, type SendThrottle } from "./send-throttle";

/** yaw と pitch が厳密に等しいか。 */
export function lightAnglesEqual(a: LightAngles, b: LightAngles): boolean {
  return a.yaw === b.yaw && a.pitch === b.pitch;
}

/** lighting ストアの変化1回ぶんの入力。 */
export interface LightingChange {
  angles: LightAngles;
  origin: LightAnglesOrigin;
}

/** lighting ストアの局所的な変更を throttle へ伝える。 */
export function onLightingChange(
  throttle: SendThrottle<LightAngles>,
  change: LightingChange,
): void {
  if (change.origin === "remote") {
    throttle.markSent(change.angles);
    return;
  }
  throttle.update(change.angles);
}

/** lighting ストアの局所的な変更を light メッセージとして送る。 */
export function useLightBroadcast(send: (msg: ClientMessage) => boolean): void {
  useEffect(() => {
    const throttle = createSendThrottle<LightAngles>({
      send: (angles) => send({ type: "light", angles }),
      now: () => performance.now(),
      schedule: (fn, delayMs) => {
        const timeout = setTimeout(fn, delayMs);
        return () => clearTimeout(timeout);
      },
      equals: lightAnglesEqual,
      clone: (angles) => ({ ...angles }),
      intervalMs: LIGHT_SEND_INTERVAL_MS,
    });

    const unsubscribe = useLightingStore.subscribe((state) => onLightingChange(throttle, state));
    return () => {
      throttle.dispose();
      unsubscribe();
    };
  }, [send]);
}
