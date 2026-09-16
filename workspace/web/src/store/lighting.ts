import { create } from "zustand";
import {
  clampPitch,
  DEFAULT_LIGHT_ANGLES,
  normalizeYaw,
  rotateLight,
  type LightAngles,
} from "../features/viewer/lighting";
import {
  DEFAULT_LIGHT_BRIGHTNESS,
  MAX_LIGHT_BRIGHTNESS,
  MIN_LIGHT_BRIGHTNESS,
} from "@shared/types";

/** 直近の angles 更新の出どころ。061 の送信側がエコー防止に使う */
export type LightAnglesOrigin = "local" | "remote";

export interface LightingStoreState {
  angles: LightAngles;
  /** 直近の angles 更新の出どころ。061 の送信側がエコー防止に使う */
  origin: LightAnglesOrigin;
  /** ルーム共有の明るさ(倍率)。既定 DEFAULT_LIGHT_BRIGHTNESS */
  brightness: number;
  /** 直近の brightness 更新の出どころ。angles の origin とは独立 */
  brightnessOrigin: LightAnglesOrigin;
  /** サーバから受け取った向きを正規化して適用する。origin は "remote" */
  applyRemote(angles: LightAngles): void;
  /** MIN〜MAX に丸めて brightnessOrigin を "remote" にする */
  applyRemoteBrightness(brightness: number): void;
  /** rotateLight の規則でライトを回す。origin は "local" */
  rotate(deltaX: number, deltaY: number): void;
  /** 有限数でなければ無視し、MIN〜MAX に丸めて brightnessOrigin を "local" にする */
  setBrightness(brightness: number): void;
  /** DEFAULT_LIGHT_ANGLES へ戻す。origin は "local" */
  reset(): void;
}

function defaultAngles(): LightAngles {
  return { ...DEFAULT_LIGHT_ANGLES };
}

function clampBrightness(brightness: number): number {
  if (!Number.isFinite(brightness)) {
    return DEFAULT_LIGHT_BRIGHTNESS;
  }
  return Math.min(MAX_LIGHT_BRIGHTNESS, Math.max(MIN_LIGHT_BRIGHTNESS, brightness));
}

export const useLightingStore = create<LightingStoreState>((set) => ({
  angles: defaultAngles(),
  origin: "local",
  brightness: DEFAULT_LIGHT_BRIGHTNESS,
  brightnessOrigin: "local",

  applyRemote(angles) {
    set({
      angles: { yaw: normalizeYaw(angles.yaw), pitch: clampPitch(angles.pitch) },
      origin: "remote",
    });
  },

  applyRemoteBrightness(brightness) {
    set({ brightness: clampBrightness(brightness), brightnessOrigin: "remote" });
  },

  rotate(deltaX, deltaY) {
    set((state) => ({ angles: rotateLight(state.angles, deltaX, deltaY), origin: "local" }));
  },

  setBrightness(brightness) {
    if (!Number.isFinite(brightness)) {
      return;
    }
    set((state) => {
      const nextBrightness = clampBrightness(brightness);
      if (state.brightness === nextBrightness) {
        return state;
      }
      return { brightness: nextBrightness, brightnessOrigin: "local" };
    });
  },

  reset() {
    set({
      angles: defaultAngles(),
      origin: "local",
      brightness: DEFAULT_LIGHT_BRIGHTNESS,
      brightnessOrigin: "local",
    });
  },
}));
