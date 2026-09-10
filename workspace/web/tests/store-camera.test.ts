import { beforeEach, describe, expect, it } from "vitest";
import type { CameraState } from "@shared/types";
import { cameraEquals, DEFAULT_CAMERA } from "@shared/camera";
import { useCameraStore } from "../src/store/camera";

const camera: CameraState = { position: [1, 2, 3], target: [0.5, 0.25, -1] };

describe("camera store", () => {
  beforeEach(() => {
    useCameraStore.getState().reset();
  });

  it("starts with the default camera and initial counters", () => {
    const state = useCameraStore.getState();
    expect(cameraEquals(state.selfCamera, DEFAULT_CAMERA)).toBe(true);
    expect(state.pendingCamera).toBeNull();
    expect(state.resetSeq).toBe(0);
    expect(state.fitSeq).toBe(0);
    expect(state.modelSize).toBe(1);
    expect(state.focalLength).toBe(50);
  });

  it("clones a changed self camera", () => {
    useCameraStore.getState().setSelfCamera(camera);
    const stateCamera = useCameraStore.getState().selfCamera;
    expect(cameraEquals(stateCamera, camera)).toBe(true);
    expect(stateCamera).not.toBe(camera);
  });

  it("does not replace the self camera for equal values", () => {
    useCameraStore.getState().setSelfCamera(camera);
    const firstReference = useCameraStore.getState().selfCamera;
    useCameraStore.getState().setSelfCamera({
      position: [...camera.position],
      target: [...camera.target],
    });
    expect(useCameraStore.getState().selfCamera).toBe(firstReference);
  });

  it("ignores differences within the default epsilon", () => {
    useCameraStore.getState().setSelfCamera(camera);
    const firstReference = useCameraStore.getState().selfCamera;
    const slightlyDifferent: CameraState = {
      position: [camera.position[0] + 1e-6, camera.position[1], camera.position[2]],
      target: [...camera.target],
    };
    useCameraStore.getState().setSelfCamera(slightlyDifferent);
    expect(useCameraStore.getState().selfCamera).toBe(firstReference);
  });

  it("updates for a meaningful camera difference", () => {
    useCameraStore.getState().setSelfCamera(camera);
    const firstReference = useCameraStore.getState().selfCamera;
    const changed: CameraState = {
      position: [camera.position[0] + 0.01, camera.position[1], camera.position[2]],
      target: [...camera.target],
    };
    useCameraStore.getState().setSelfCamera(changed);
    expect(useCameraStore.getState().selfCamera).not.toBe(firstReference);
    expect(cameraEquals(useCameraStore.getState().selfCamera, changed)).toBe(true);
  });

  it("queues and consumes a cloned pending camera", () => {
    useCameraStore.getState().requestCamera(camera);
    const pending = useCameraStore.getState().consumePendingCamera();
    expect(pending).not.toBeNull();
    expect(pending).not.toBe(camera);
    expect(cameraEquals(pending!, camera)).toBe(true);
    expect(useCameraStore.getState().consumePendingCamera()).toBeNull();
  });

  it("does not change state when consuming an empty queue", () => {
    const before = useCameraStore.getState();
    expect(before.consumePendingCamera()).toBeNull();
    expect(useCameraStore.getState()).toBe(before);
  });

  it("uses the latest camera for consecutive requests", () => {
    const latest: CameraState = { position: [9, 8, 7], target: [1, 1, 1] };
    useCameraStore.getState().requestCamera(camera);
    useCameraStore.getState().requestCamera(latest);
    expect(cameraEquals(useCameraStore.getState().pendingCamera!, latest)).toBe(true);
  });

  it("increments reset and fit triggers", () => {
    useCameraStore.getState().requestReset();
    useCameraStore.getState().requestReset();
    useCameraStore.getState().requestReset();
    useCameraStore.getState().requestFit();
    useCameraStore.getState().requestFit();
    expect(useCameraStore.getState().resetSeq).toBe(3);
    expect(useCameraStore.getState().fitSeq).toBe(2);
  });

  it("sets and clamps focal length without changing camera state", () => {
    const initial = useCameraStore.getState();
    useCameraStore.getState().setFocalLength(85);
    expect(useCameraStore.getState().focalLength).toBe(85);
    useCameraStore.getState().setFocalLength(14);
    expect(useCameraStore.getState().focalLength).toBe(14);
    useCameraStore.getState().setFocalLength(300);
    expect(useCameraStore.getState().focalLength).toBe(300);
    useCameraStore.getState().setFocalLength(5);
    expect(useCameraStore.getState().focalLength).toBe(14);
    useCameraStore.getState().setFocalLength(1000);
    expect(useCameraStore.getState().focalLength).toBe(300);
    useCameraStore.getState().setFocalLength(Number.NaN);
    expect(useCameraStore.getState().focalLength).toBe(50);
    expect(useCameraStore.getState().selfCamera).toBe(initial.selfCamera);
    expect(useCameraStore.getState().pendingCamera).toBe(initial.pendingCamera);
    expect(useCameraStore.getState().modelSize).toBe(initial.modelSize);
  });

  it("does not replace state for an equal focal length", () => {
    useCameraStore.getState().setFocalLength(85);
    const firstReference = useCameraStore.getState();
    useCameraStore.getState().setFocalLength(85);
    expect(useCameraStore.getState()).toBe(firstReference);
  });

  it("resets focal length and preserves fit behavior", () => {
    useCameraStore.getState().setFocalLength(85);
    useCameraStore.getState().requestReset();
    expect(useCameraStore.getState().focalLength).toBe(50);
    expect(useCameraStore.getState().resetSeq).toBe(1);
    useCameraStore.getState().requestReset();
    expect(useCameraStore.getState().resetSeq).toBe(2);
    useCameraStore.getState().setFocalLength(85);
    useCameraStore.getState().requestFit();
    expect(useCameraStore.getState().focalLength).toBe(85);
    expect(useCameraStore.getState().fitSeq).toBe(1);
  });

  it("only accepts positive model sizes", () => {
    useCameraStore.getState().setModelSize(12.5);
    useCameraStore.getState().setModelSize(0);
    useCameraStore.getState().setModelSize(-1);
    expect(useCameraStore.getState().modelSize).toBe(12.5);
  });

  it("resets every field to its initial value", () => {
    useCameraStore.getState().setSelfCamera(camera);
    useCameraStore.getState().requestCamera(camera);
    useCameraStore.getState().requestReset();
    useCameraStore.getState().requestFit();
    useCameraStore.getState().setModelSize(12.5);
    useCameraStore.getState().setFocalLength(85);
    expect(useCameraStore.getState().focalLength).toBe(85);
    useCameraStore.getState().reset();
    const state = useCameraStore.getState();
    expect(cameraEquals(state.selfCamera, DEFAULT_CAMERA)).toBe(true);
    expect(state.pendingCamera).toBeNull();
    expect(state.resetSeq).toBe(0);
    expect(state.fitSeq).toBe(0);
    expect(state.modelSize).toBe(1);
    expect(state.focalLength).toBe(50);
  });
});
