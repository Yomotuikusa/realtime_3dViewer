import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Vec3 } from "@shared/types";
import { FIT_DIRECTION, fitCamera } from "../src/features/viewer/fit-camera";
import { MIN_PRESET_DISTANCE, matchViewPreset } from "../src/features/viewer/view-presets";

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function readViewerSource(sourceUrl: URL, fileName: string): string {
  const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
    ? join(process.cwd(), "web", "src")
    : join(process.cwd(), "src");
  const sourcePath = sourceUrl.protocol === "file:"
    ? fileURLToPath(sourceUrl)
    : join(sourceRoot, "features/viewer", fileName);
  return readFileSync(sourcePath, "utf8");
}

describe("fit camera", () => {
  it("uses the normalized default camera direction", () => {
    expect(FIT_DIRECTION[0]).toBeCloseTo(1 / Math.sqrt(3), 12);
    expect(FIT_DIRECTION[1]).toBeCloseTo(1 / Math.sqrt(3), 12);
    expect(FIT_DIRECTION[2]).toBeCloseTo(1 / Math.sqrt(3), 12);
    expect(Math.hypot(...FIT_DIRECTION)).toBeCloseTo(1, 12);
  });

  it("places an origin-centered fit at the requested diagonal distance", () => {
    const camera = fitCamera([0, 0, 0], 10);
    expect(camera.target).toEqual([0, 0, 0]);
    for (const component of camera.position) {
      expect(component).toBeCloseTo(10 / Math.sqrt(3), 9);
    }
  });

  it("centers the target and places the camera at the requested distance", () => {
    const camera = fitCamera([1, 2, 3], 6);
    expect(camera.target).toEqual([1, 2, 3]);
    expect(camera.position[0]).toBeCloseTo(1 + FIT_DIRECTION[0] * 6, 9);
    expect(camera.position[1]).toBeCloseTo(2 + FIT_DIRECTION[1] * 6, 9);
    expect(camera.position[2]).toBeCloseTo(3 + FIT_DIRECTION[2] * 6, 9);
    expect(distance(camera.position, camera.target)).toBeCloseTo(6, 9);
  });

  it("uses the minimum distance for invalid or too-small distances", () => {
    for (const invalidDistance of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const camera = fitCamera([0, 0, 0], invalidDistance);
      expect(distance(camera.position, camera.target)).toBeCloseTo(MIN_PRESET_DISTANCE, 12);
    }
  });

  it("does not mutate or reuse the center array", () => {
    const center: Vec3 = [1, 2, 3];
    const camera = fitCamera(center, 10);
    expect(center).toEqual([1, 2, 3]);
    expect(camera.target).not.toBe(center);
  });

  it("does not match a cardinal view preset after fitting", () => {
    expect(matchViewPreset(fitCamera([0, 0, 0], 10))).toBeNull();
  });

  it("routes fit through CameraRig's camera request without Bounds animation", () => {
    const source = readViewerSource(
      new URL("../src/features/viewer/CameraRig.tsx", import.meta.url),
      "CameraRig.tsx",
    );
    expect(source).toContain("fitCamera(");
    expect(source).toContain("getModelTarget()");
    expect(source).not.toContain(".fit()");
    expect(source).not.toContain(".reset()");
    expect(source).toContain(".clip()");
  });
});
