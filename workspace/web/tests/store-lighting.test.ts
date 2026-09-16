import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_BRIGHTNESS,
  MAX_LIGHT_BRIGHTNESS,
  MIN_LIGHT_BRIGHTNESS,
} from "@shared/types";
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
    expect(useLightingStore.getState().brightness).toBe(DEFAULT_LIGHT_BRIGHTNESS);
    expect(useLightingStore.getState().brightnessOrigin).toBe("local");
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

  it("tracks local updates with a local origin", () => {
    expect(useLightingStore.getState().origin).toBe("local");
    useLightingStore.getState().rotate(100, 0);
    expect(useLightingStore.getState().origin).toBe("local");
    useLightingStore.getState().reset();
    expect(useLightingStore.getState().origin).toBe("local");
  });

  it("normalizes and clones remote angles", () => {
    const input = { yaw: 1, pitch: 0.5 };
    useLightingStore.getState().applyRemote(input);
    expect(useLightingStore.getState().angles).toEqual(input);
    expect(useLightingStore.getState().origin).toBe("remote");
    expect(useLightingStore.getState().angles).not.toBe(input);

    useLightingStore.getState().applyRemote({ yaw: Math.PI * 1.5, pitch: 100 });
    expect(useLightingStore.getState().angles.yaw).toBeCloseTo(-Math.PI / 2, 10);
    expect(useLightingStore.getState().angles.pitch).toBe(MAX_LIGHT_PITCH);
    const invalid = { yaw: Number.NaN, pitch: Number.NaN };
    useLightingStore.getState().applyRemote(invalid);
    expect(invalid).toEqual({ yaw: Number.NaN, pitch: Number.NaN });
    expect(useLightingStore.getState().angles).toEqual({ yaw: 0, pitch: 0 });
  });

  it("continues local rotation from remote angles and resets locally", () => {
    useLightingStore.getState().applyRemote({ yaw: 1, pitch: 0.5 });
    useLightingStore.getState().rotate(100, 0);
    expect(useLightingStore.getState().angles.yaw).toBeCloseTo(1.8, 10);
    expect(useLightingStore.getState().origin).toBe("local");
    useLightingStore.getState().reset();
    expect(useLightingStore.getState().angles).toEqual(DEFAULT_LIGHT_ANGLES);
    expect(useLightingStore.getState().origin).toBe("local");
  });

  it("updates brightness independently and preserves the angle state", () => {
    useLightingStore.getState().applyRemote({ yaw: 1, pitch: 0.5 });
    const beforeAngles = useLightingStore.getState().angles;
    useLightingStore.getState().setBrightness(2);

    expect(useLightingStore.getState().brightness).toBe(2);
    expect(useLightingStore.getState().brightnessOrigin).toBe("local");
    expect(useLightingStore.getState().angles).toBe(beforeAngles);
    expect(useLightingStore.getState().origin).toBe("remote");
  });

  it("clamps brightness and ignores non-finite local values", () => {
    useLightingStore.getState().setBrightness(10);
    expect(useLightingStore.getState().brightness).toBe(MAX_LIGHT_BRIGHTNESS);
    useLightingStore.getState().setBrightness(0);
    expect(useLightingStore.getState().brightness).toBe(MIN_LIGHT_BRIGHTNESS);

    const before = useLightingStore.getState();
    useLightingStore.getState().setBrightness(Number.NaN);
    useLightingStore.getState().setBrightness(Number.POSITIVE_INFINITY);
    expect(useLightingStore.getState()).toBe(before);
    expect(useLightingStore.getState().brightnessOrigin).toBe("local");
  });

  it("does not replace state for an equal brightness and tracks remote brightness", () => {
    useLightingStore.getState().setBrightness(2);
    const before = useLightingStore.getState();
    useLightingStore.getState().setBrightness(2);
    expect(useLightingStore.getState()).toBe(before);

    useLightingStore.getState().applyRemoteBrightness(3);
    expect(useLightingStore.getState().brightness).toBe(3);
    expect(useLightingStore.getState().brightnessOrigin).toBe("remote");
    expect(useLightingStore.getState().origin).toBe("local");
    useLightingStore.getState().applyRemoteBrightness(9);
    expect(useLightingStore.getState().brightness).toBe(MAX_LIGHT_BRIGHTNESS);
  });

  it("keeps brightness origin independent during rotation and resets both values", () => {
    useLightingStore.getState().applyRemoteBrightness(2);
    useLightingStore.getState().rotate(10, 0);
    expect(useLightingStore.getState().origin).toBe("local");
    expect(useLightingStore.getState().brightnessOrigin).toBe("remote");

    useLightingStore.getState().reset();
    expect(useLightingStore.getState().angles).toEqual(DEFAULT_LIGHT_ANGLES);
    expect(useLightingStore.getState().brightness).toBe(DEFAULT_LIGHT_BRIGHTNESS);
    expect(useLightingStore.getState().origin).toBe("local");
    expect(useLightingStore.getState().brightnessOrigin).toBe("local");
  });
});
