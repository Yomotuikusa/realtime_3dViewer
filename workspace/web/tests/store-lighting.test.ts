import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_ANGLES,
  MAX_LIGHT_PITCH,
} from "../src/features/viewer/lighting";
import { useLightingStore } from "../src/store/lighting";

describe("lighting store", () => {
  beforeEach(() => {
    useLightingStore.getState().reset();
  });

  it("starts at independent default angles", () => {
    const angles = useLightingStore.getState().angles;
    expect(angles).toEqual(DEFAULT_LIGHT_ANGLES);
    expect(angles).not.toBe(DEFAULT_LIGHT_ANGLES);
  });

  it("accumulates rotations and clamps pitch", () => {
    useLightingStore.getState().rotate(100, 0);
    expect(useLightingStore.getState().angles.yaw).toBeCloseTo(DEFAULT_LIGHT_ANGLES.yaw + 0.8, 10);
    expect(useLightingStore.getState().angles.pitch).toBe(DEFAULT_LIGHT_ANGLES.pitch);
    useLightingStore.getState().rotate(100, 0);
    expect(useLightingStore.getState().angles.yaw).toBeCloseTo(DEFAULT_LIGHT_ANGLES.yaw + 1.6, 10);
    useLightingStore.getState().rotate(0, -1000);
    expect(useLightingStore.getState().angles.pitch).toBe(MAX_LIGHT_PITCH);
  });

  it("keeps valid values, clones state, and resets defaults", () => {
    const initialAngles = useLightingStore.getState().angles;
    useLightingStore.getState().rotate(0, 0);
    expect(useLightingStore.getState().angles.yaw).toBeCloseTo(initialAngles.yaw, 10);
    expect(useLightingStore.getState().angles.pitch).toBe(initialAngles.pitch);
    expect(useLightingStore.getState().angles).not.toBe(initialAngles);
    const rotatedAngles = useLightingStore.getState().angles;
    useLightingStore.getState().rotate(Number.NaN, 0);
    expect(useLightingStore.getState().angles.yaw).toBeCloseTo(rotatedAngles.yaw, 10);
    expect(useLightingStore.getState().angles.pitch).toBe(rotatedAngles.pitch);
    expect(useLightingStore.getState().angles).not.toBe(rotatedAngles);
    useLightingStore.getState().rotate(100, 100);
    useLightingStore.getState().reset();
    expect(useLightingStore.getState().angles).toEqual(DEFAULT_LIGHT_ANGLES);
    expect(DEFAULT_LIGHT_ANGLES).toEqual({ yaw: Math.PI / 4, pitch: Math.PI / 4 });
  });
});
