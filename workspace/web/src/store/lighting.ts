import { create } from "zustand";
import {
  DEFAULT_LIGHT_ANGLES,
  rotateLight,
  type LightAngles,
} from "../features/viewer/lighting";

export interface LightingStoreState {
  angles: LightAngles;
  /** rotateLight の規則でライトを回す */
  rotate(deltaX: number, deltaY: number): void;
  /** DEFAULT_LIGHT_ANGLES へ戻す */
  reset(): void;
}

function defaultAngles(): LightAngles {
  return { ...DEFAULT_LIGHT_ANGLES };
}

export const useLightingStore = create<LightingStoreState>((set) => ({
  angles: defaultAngles(),

  rotate(deltaX, deltaY) {
    set((state) => ({ angles: rotateLight(state.angles, deltaX, deltaY) }));
  },

  reset() {
    set({ angles: defaultAngles() });
  },
}));
