import { create } from "zustand";
import {
  clampPitch,
  DEFAULT_LIGHT_ANGLES,
  normalizeYaw,
  rotateLight,
  type LightAngles,
} from "../features/viewer/lighting";

/** 直近の angles 更新の出どころ。061 の送信側がエコー防止に使う */
export type LightAnglesOrigin = "local" | "remote";

export interface LightingStoreState {
  angles: LightAngles;
  /** 直近の angles 更新の出どころ。061 の送信側がエコー防止に使う */
  origin: LightAnglesOrigin;
  /** サーバから受け取った向きを正規化して適用する。origin は "remote" */
  applyRemote(angles: LightAngles): void;
  /** rotateLight の規則でライトを回す。origin は "local" */
  rotate(deltaX: number, deltaY: number): void;
  /** DEFAULT_LIGHT_ANGLES へ戻す。origin は "local" */
  reset(): void;
}

function defaultAngles(): LightAngles {
  return { ...DEFAULT_LIGHT_ANGLES };
}

export const useLightingStore = create<LightingStoreState>((set) => ({
  angles: defaultAngles(),
  origin: "local",

  applyRemote(angles) {
    set({
      angles: { yaw: normalizeYaw(angles.yaw), pitch: clampPitch(angles.pitch) },
      origin: "remote",
    });
  },

  rotate(deltaX, deltaY) {
    set((state) => ({ angles: rotateLight(state.angles, deltaX, deltaY), origin: "local" }));
  },

  reset() {
    set({ angles: defaultAngles(), origin: "local" });
  },
}));
