import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA,
  cameraEquals,
  cloneCamera,
  lerpCamera,
  lerpVec3,
  vec3Distance,
  vec3Equals,
} from "../src/camera";
import type { CameraState } from "../src/types";

const cameraA: CameraState = { position: [0, 1, 2], target: [3, 4, 5] };
const cameraB: CameraState = { position: [10, 11, 12], target: [13, 14, 15] };

describe("camera helpers", () => {
  it("compares vectors within the default epsilon", () => {
    expect(vec3Equals([0, 0, 0], [0.00005, 0, 0])).toBe(true);
    expect(vec3Equals([0, 0, 0], [0.001, 0, 0])).toBe(false);
    expect(vec3Equals([0, 0, 0], [0.2, 0, 0], 0.2)).toBe(true);
  });

  it("calculates vector distance and interpolation", () => {
    expect(vec3Distance([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(lerpVec3([0, 0, 0], [10, 10, 10], 0.5)).toEqual([5, 5, 5]);
  });

  it("compares both camera vectors", () => {
    expect(cameraEquals(cameraA, cameraA)).toBe(true);
    const differentTarget: CameraState = { ...cameraA, target: [3, 4.001, 5] };
    expect(cameraEquals(cameraA, differentTarget)).toBe(false);
  });

  it("lerps cameras, clamps t, and returns fresh objects", () => {
    const atStart = lerpCamera(cameraA, cameraB, 0);
    const atEnd = lerpCamera(cameraA, cameraB, 1);
    expect(cameraEquals(atStart, cameraA)).toBe(true);
    expect(cameraEquals(atEnd, cameraB)).toBe(true);
    expect(atStart).not.toBe(cameraA);
    expect(atStart.position).not.toBe(cameraA.position);
    expect(atStart.target).not.toBe(cameraA.target);
    expect(atEnd).not.toBe(cameraB);
    expect(atEnd.position).not.toBe(cameraB.position);
    expect(atEnd.target).not.toBe(cameraB.target);
    expect(lerpCamera(cameraA, cameraB, -1)).toEqual(atStart);
    expect(lerpCamera(cameraA, cameraB, 2)).toEqual(atEnd);
  });

  it("clones camera arrays and preserves the default camera", () => {
    const clone = cloneCamera(cameraA);
    expect(cameraEquals(clone, cameraA)).toBe(true);
    expect(clone.position).not.toBe(cameraA.position);
    expect(clone.target).not.toBe(cameraA.target);
    expect(DEFAULT_CAMERA).toEqual({ position: [3, 3, 3], target: [0, 0, 0] });
  });
});
