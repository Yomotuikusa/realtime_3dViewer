import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CameraState } from "@shared/types";
import { cameraEquals, lerpVec3, vec3Equals } from "@shared/camera";
import {
  CAMERA_ANIMATION_DURATION_MS,
  easeOutCubic,
  startCameraAnimation,
  stepCameraAnimation,
} from "../src/features/viewer/camera-animation";

function readViewerSource(sourceUrl: URL, fileName: string): string {
  const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
    ? join(process.cwd(), "web", "src")
    : join(process.cwd(), "src");
  const sourcePath = sourceUrl.protocol === "file:"
    ? fileURLToPath(sourceUrl)
    : join(sourceRoot, "features/viewer", fileName);
  return readFileSync(sourcePath, "utf8");
}

describe("camera animation", () => {
  it("uses the ease-out cubic curve", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBe(0.875);
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
    expect(easeOutCubic(0.25)).toBeLessThan(1);
  });

  it("clones both cameras when starting", () => {
    const inputFrom: CameraState = { position: [0, 0, 10], target: [0, 0, 0] };
    const inputTo: CameraState = { position: [10, 0, 0], target: [1, 2, 3] };
    const animation = startCameraAnimation(inputFrom, inputTo, 100);
    expect(animation.startedAt).toBe(100);
    expect(cameraEquals(animation.from, inputFrom, 0)).toBe(true);
    expect(cameraEquals(animation.to, inputTo, 0)).toBe(true);
    expect(animation.from.position).not.toBe(inputFrom.position);
    expect(animation.from.target).not.toBe(inputFrom.target);
    expect(animation.to.position).not.toBe(inputTo.position);
    expect(animation.to.target).not.toBe(inputTo.target);

    inputFrom.position[0] = -1;
    inputTo.target[0] = -1;
    expect(animation.from.position[0]).toBe(0);
    expect(animation.to.target[0]).toBe(1);
  });

  it("steps from the captured start to the exact target by elapsed time", () => {
    const animation = startCameraAnimation(
      { position: [0, 0, 10], target: [0, 0, 0] },
      { position: [10, 0, 0], target: [0, 0, 0] },
      1000,
    );
    const atStart = stepCameraAnimation(animation, 1000);
    const beforeStart = stepCameraAnimation(animation, 900);
    const halfway = stepCameraAnimation(animation, 1150);
    const atEnd = stepCameraAnimation(animation, 1300);
    const afterEnd = stepCameraAnimation(animation, 5000);
    const invalidTime = stepCameraAnimation(animation, Number.NaN);

    expect(cameraEquals(atStart.camera, animation.from, 0)).toBe(true);
    expect(atStart.done).toBe(false);
    expect(cameraEquals(beforeStart.camera, animation.from, 0)).toBe(true);
    expect(beforeStart.done).toBe(false);
    expect(vec3Equals(halfway.camera.position, lerpVec3([0, 0, 10], [10, 0, 0], 0.875), 1e-9)).toBe(true);
    expect(halfway.done).toBe(false);
    expect(cameraEquals(atEnd.camera, animation.to, 0)).toBe(true);
    expect(atEnd.done).toBe(true);
    expect(cameraEquals(afterEnd.camera, animation.to, 0)).toBe(true);
    expect(afterEnd.done).toBe(true);
    expect(cameraEquals(invalidTime.camera, animation.from, 0)).toBe(true);
    expect(invalidTime.done).toBe(false);
    expect(atEnd.camera.position).not.toBe(animation.to.position);
    expect(atEnd.camera.target).not.toBe(animation.to.target);
    expect(animation.startedAt).toBe(1000);
    expect(animation.from.position).toEqual([0, 0, 10]);
  });

  it("disables OrbitControls damping in CameraRig", () => {
    const source = readViewerSource(
      new URL("../src/features/viewer/CameraRig.tsx", import.meta.url),
      "CameraRig.tsx",
    );

    expect(source).toContain("enableDamping={false}");
  });

  it("does not keep an inertia flush in CameraRig", () => {
    const source = readViewerSource(
      new URL("../src/features/viewer/CameraRig.tsx", import.meta.url),
      "CameraRig.tsx",
    );
    const inertiaFlush = "flushControls" + "Inertia";

    expect(source).not.toContain(inertiaFlush);
  });

  it("does not expose damping or inertia flush helpers", () => {
    const source = readViewerSource(
      new URL("../src/features/viewer/camera-animation.ts", import.meta.url),
      "camera-animation.ts",
    );
    const inertiaFlush = "flushControls" + "Inertia";
    const dampedControls = "Damped" + "ControlsLike";

    expect(source).not.toContain(inertiaFlush);
    expect(source).not.toContain(dampedControls);
  });

  it("uses the documented duration", () => {
    expect(CAMERA_ANIMATION_DURATION_MS).toBe(300);
  });
});
