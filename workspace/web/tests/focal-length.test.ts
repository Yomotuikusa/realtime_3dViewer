import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOV,
  FOCAL_LENGTH_STEP_MM,
  focalLengthFromFov,
  fovFromFocalLength,
  SENSOR_HEIGHT_MM,
} from "../src/features/viewer/focal-length";

describe("focal length conversion", () => {
  it("defines the full-frame sensor and slider step", () => {
    expect(SENSOR_HEIGHT_MM).toBe(24);
    expect(FOCAL_LENGTH_STEP_MM).toBe(1);
  });

  it("converts focal length to vertical field of view", () => {
    expect(fovFromFocalLength(50)).toBeCloseTo(2 * Math.atan(12 / 50) * 180 / Math.PI, 6);
    expect(fovFromFocalLength(14)).toBeCloseTo(2 * Math.atan(12 / 14) * 180 / Math.PI, 6);
    expect(fovFromFocalLength(300)).toBeCloseTo(2 * Math.atan(12 / 300) * 180 / Math.PI, 6);
    expect(fovFromFocalLength(5)).toBe(fovFromFocalLength(14));
    expect(fovFromFocalLength(1000)).toBe(fovFromFocalLength(300));
    expect(fovFromFocalLength(Number.NaN)).toBe(fovFromFocalLength(50));
    expect(fovFromFocalLength(0)).toBe(fovFromFocalLength(14));
    expect(fovFromFocalLength(-50)).toBe(fovFromFocalLength(14));
    expect(DEFAULT_FOV).toBe(fovFromFocalLength(50));
  });

  it("is monotonically narrower at longer focal lengths", () => {
    expect(fovFromFocalLength(14)).toBeGreaterThan(fovFromFocalLength(25));
    expect(fovFromFocalLength(25)).toBeGreaterThan(fovFromFocalLength(50));
    expect(fovFromFocalLength(50)).toBeGreaterThan(fovFromFocalLength(135));
    expect(fovFromFocalLength(135)).toBeGreaterThan(fovFromFocalLength(300));
  });

  it("converts field of view back to a clamped focal length", () => {
    for (const focalLength of [14, 25, 50, 135, 300]) {
      expect(focalLengthFromFov(fovFromFocalLength(focalLength))).toBeCloseTo(focalLength, 6);
    }
    expect(focalLengthFromFov(0)).toBe(300);
    expect(focalLengthFromFov(179)).toBe(14);
    expect(focalLengthFromFov(Number.NaN)).toBe(50);

    for (const fov of [-90, 0, 10, 90, 179, 360]) {
      const focalLength = focalLengthFromFov(fov);
      expect(focalLength).toBeGreaterThanOrEqual(14);
      expect(focalLength).toBeLessThanOrEqual(300);
    }
  });
});
