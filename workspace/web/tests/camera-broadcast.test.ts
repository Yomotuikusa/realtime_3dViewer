import { describe, expect, it } from "vitest";
import type { CameraState } from "@shared/types";
import { shouldSendCamera } from "../src/features/viewer/useCameraBroadcast";

const camera: CameraState = { position: [1, 2, 3], target: [0, 1, 0] };

describe("shouldSendCamera", () => {
  it("requires the send interval even for the first camera", () => {
    expect(shouldSendCamera(null, camera, 0, 49)).toBe(false);
    expect(shouldSendCamera(null, camera, 0, 50)).toBe(true);
  });

  it("requires a camera change after the interval", () => {
    expect(shouldSendCamera(camera, camera, 0, 1000)).toBe(false);
    expect(shouldSendCamera(camera, { ...camera, position: [1.01, 2, 3] }, 0, 1000)).toBe(true);
    expect(shouldSendCamera(camera, { ...camera, position: [1.000001, 2, 3] }, 0, 1000)).toBe(false);
  });

  it("checks the interval before comparing values", () => {
    expect(shouldSendCamera(camera, { ...camera, position: [1.01, 2, 3] }, 0, 49)).toBe(false);
  });
});
