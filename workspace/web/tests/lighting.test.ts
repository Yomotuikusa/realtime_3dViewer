import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_ANGLES,
  FILL_LIGHT_INTENSITY,
  KEY_LIGHT_INTENSITY,
  LIGHT_DISTANCE,
  MAX_LIGHT_PITCH,
  AMBIENT_LIGHT_INTENSITY,
  clampPitch,
  fillLightPosition,
  lightPosition,
  normalizeYaw,
  rotateLight,
  scaledLightIntensities,
} from "../src/features/viewer/lighting";

describe("lighting calculations", () => {
  it("normalizes yaw to [-pi, pi)", () => {
    expect(normalizeYaw(0)).toBe(0);
    expect(normalizeYaw(Math.PI / 4)).toBeCloseTo(Math.PI / 4, 10);
    expect(normalizeYaw(Math.PI)).toBeCloseTo(-Math.PI, 10);
    expect(normalizeYaw(-Math.PI)).toBeCloseTo(-Math.PI, 10);
    expect(normalizeYaw(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 10);
    expect(normalizeYaw(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2, 10);
    expect(normalizeYaw(Math.PI * 2)).toBe(0);
    expect(normalizeYaw(Math.PI * 5)).toBeCloseTo(-Math.PI, 10);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(normalizeYaw(value)).toBe(0);
    }
    for (const value of [-100, -Math.PI * 9, 0, Math.PI * 9, 100]) {
      const result = normalizeYaw(value);
      expect(result).toBeGreaterThanOrEqual(-Math.PI);
      expect(result).toBeLessThan(Math.PI);
    }
  });

  it("clamps pitch while rejecting non-finite values", () => {
    expect(clampPitch(0)).toBe(0);
    expect(clampPitch(Math.PI / 4)).toBeCloseTo(Math.PI / 4, 10);
    expect(clampPitch(MAX_LIGHT_PITCH)).toBe(MAX_LIGHT_PITCH);
    expect(clampPitch(-MAX_LIGHT_PITCH)).toBe(-MAX_LIGHT_PITCH);
    expect(clampPitch(Math.PI / 2)).toBe(MAX_LIGHT_PITCH);
    expect(clampPitch(-Math.PI / 2)).toBe(-MAX_LIGHT_PITCH);
    expect(clampPitch(100)).toBe(MAX_LIGHT_PITCH);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(clampPitch(value)).toBe(0);
    }
  });

  it("rotates without mutating angles", () => {
    const base = { yaw: 0, pitch: 0 };
    expect(rotateLight(base, 100, 0)).toMatchObject({ yaw: expect.closeTo(0.8, 10), pitch: 0 });
    expect(rotateLight(base, -100, 0)).toMatchObject({ yaw: expect.closeTo(-0.8, 10), pitch: 0 });
    expect(rotateLight(base, 0, -100)).toMatchObject({ yaw: 0, pitch: expect.closeTo(0.8, 10) });
    expect(rotateLight(base, 0, 100)).toMatchObject({ yaw: 0, pitch: expect.closeTo(-0.8, 10) });
    expect(rotateLight(base, 0, -1000).pitch).toBe(MAX_LIGHT_PITCH);
    expect(rotateLight(base, 0, 1000).pitch).toBe(-MAX_LIGHT_PITCH);
    expect(rotateLight({ yaw: 3, pitch: 0 }, 100, 0).yaw).toBeCloseTo(3.8 - Math.PI * 2, 10);
    const unchanged = rotateLight(base, 0, 0);
    expect(unchanged).toEqual(base);
    expect(unchanged).not.toBe(base);
    expect(rotateLight(base, Number.NaN, 0)).toEqual(base);
    expect(rotateLight(base, 0, Number.POSITIVE_INFINITY)).toEqual(base);
    expect(base).toEqual({ yaw: 0, pitch: 0 });
  });

  it("calculates fixed-world key and fill light positions", () => {
    expect([AMBIENT_LIGHT_INTENSITY, KEY_LIGHT_INTENSITY, FILL_LIGHT_INTENSITY]).toEqual([0.9, 2.2, 0.5]);
    expect(lightPosition({ yaw: 0, pitch: 0 })).toEqual([0, 0, LIGHT_DISTANCE]);
    expect(lightPosition({ yaw: Math.PI / 2, pitch: 0 })[0]).toBeCloseTo(LIGHT_DISTANCE, 10);
    expect(lightPosition({ yaw: Math.PI / 2, pitch: 0 })[2]).toBeCloseTo(0, 10);
    expect(lightPosition({ yaw: -Math.PI / 2, pitch: 0 })[0]).toBeCloseTo(-LIGHT_DISTANCE, 10);
    expect(lightPosition({ yaw: -Math.PI / 2, pitch: 0 })[2]).toBeCloseTo(0, 10);
    expect(lightPosition({ yaw: Math.PI, pitch: 0 })[2]).toBeCloseTo(-LIGHT_DISTANCE, 10);
    expect(lightPosition({ yaw: 0, pitch: Math.PI / 2 })[1]).toBeCloseTo(LIGHT_DISTANCE, 10);
    const defaultPosition = lightPosition(DEFAULT_LIGHT_ANGLES);
    expect(defaultPosition[0]).toBeCloseTo(5, 10);
    expect(defaultPosition[1]).toBeCloseTo(7.0710678, 7);
    expect(defaultPosition[2]).toBeCloseTo(5, 10);
    expect(lightPosition({ yaw: 0, pitch: 0 }, 2)).toEqual([0, 0, 2]);
    expect(Math.hypot(...lightPosition({ yaw: 0.3, pitch: -0.7}))).toBeCloseTo(LIGHT_DISTANCE, 10);
    const position = lightPosition({ yaw: 0.3, pitch: -0.7 });
    expect(fillLightPosition({ yaw: 0.3, pitch: -0.7 })).toEqual(position.map((value) => -value));
    const fillAtOrigin = fillLightPosition({ yaw: 0, pitch: 0 }, 2);
    expect(fillAtOrigin[0]).toBeCloseTo(0, 10);
    expect(fillAtOrigin[1]).toBeCloseTo(0, 10);
    expect(fillAtOrigin[2]).toBeCloseTo(-2, 10);
  });

  it("scales all three light intensities and falls back for invalid brightness", () => {
    expect(scaledLightIntensities(1)).toEqual({ ambient: 0.9, key: 2.2, fill: 0.5 });
    expect(scaledLightIntensities(2)).toEqual({ ambient: 1.8, key: 4.4, fill: 1 });
    expect(scaledLightIntensities(Number.NaN)).toEqual(scaledLightIntensities(1));
  });
});
