import { useEffect } from "react";
import { LIGHT_SEND_INTERVAL_MS, type ClientMessage } from "@shared/protocol";
import { useLightingStore, type LightAnglesOrigin } from "../../store/lighting";
import { createSendThrottle, type SendThrottle } from "./send-throttle";

export interface LightBrightnessChange {
  brightness: number;
  brightnessOrigin: LightAnglesOrigin;
}

/** 明るさの更新元に応じて送信 throttle を更新する。 */
export function onLightBrightnessChange(
  throttle: SendThrottle<number>,
  change: LightBrightnessChange,
): void {
  if (change.brightnessOrigin === "remote") {
    throttle.markSent(change.brightness);
    return;
  }
  throttle.update(change.brightness);
}

/** lighting ストアの局所的な明るさ変更を light:brightness メッセージとして送る。 */
export function useLightBrightnessBroadcast(send: (msg: ClientMessage) => boolean): void {
  useEffect(() => {
    const throttle = createSendThrottle<number>({
      send: (brightness) => send({ type: "light:brightness", brightness }),
      now: () => performance.now(),
      schedule: (fn, delayMs) => {
        const timeout = setTimeout(fn, delayMs);
        return () => clearTimeout(timeout);
      },
      equals: Object.is,
      clone: (brightness) => brightness,
      intervalMs: LIGHT_SEND_INTERVAL_MS,
    });

    const unsubscribe = useLightingStore.subscribe((state) => {
      onLightBrightnessChange(throttle, {
        brightness: state.brightness,
        brightnessOrigin: state.brightnessOrigin,
      });
    });
    return () => {
      throttle.dispose();
      unsubscribe();
    };
  }, [send]);
}
