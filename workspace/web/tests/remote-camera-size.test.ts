import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REMOTE_CAMERA_HEIGHT_RATIO,
  REMOTE_CAMERA_RADIUS_RATIO,
  REMOTE_CAMERA_SEGMENTS,
  REMOTE_CAMERA_TAG_OFFSET_RATIO,
  remoteCameraSize,
} from "../src/features/presence/remote-camera-size";

describe("remote camera size", () => {
  it("exports the camera size ratios and cone segments", () => {
    expect(REMOTE_CAMERA_RADIUS_RATIO).toBe(0.12);
    expect(REMOTE_CAMERA_HEIGHT_RATIO).toBe(0.3);
    expect(REMOTE_CAMERA_TAG_OFFSET_RATIO).toBe(0.28);
    expect(REMOTE_CAMERA_SEGMENTS).toBe(8);
  });

  it("uses the existing dimensions when modelSize is one", () => {
    expect(remoteCameraSize(1)).toEqual({ radius: 0.12, height: 0.3, tagOffset: 0.28 });
  });

  it("scales all dimensions by the model maximum edge", () => {
    expect(remoteCameraSize(100)).toEqual({ radius: 12, height: 30, tagOffset: 28 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back to modelSize one for invalid size %s",
    (modelSize) => {
      expect(remoteCameraSize(modelSize)).toEqual(remoteCameraSize(1));
    },
  );

  it("uses the calculated dimensions in the remote camera component", () => {
    const sourcePath = [
      join(process.cwd(), "web/src/features/presence/RemoteCameras.tsx"),
      join(process.cwd(), "src/features/presence/RemoteCameras.tsx"),
    ].find((path) => existsSync(path));
    expect(sourcePath).toBeDefined();
    const source = readFileSync(sourcePath!, "utf8");
    expect(source).toContain("remoteCameraSize(");
    expect(source).toContain("REMOTE_CAMERA_SEGMENTS");
    expect(source).toContain("useCameraStore((state) => state.modelSize)");
    expect(source).not.toMatch(/\b0\.12\b/);
    expect(source).not.toMatch(/\b0\.3\b/);
    expect(source).not.toMatch(/\b0\.28\b/);
  });
});
