import { describe, expect, it } from "vitest";
import { cameraEquals, lerpCamera } from "@shared/camera";
import type { CameraState, PresenceUser } from "@shared/types";
import { FOLLOW_LERP_T, followStep, followTargetCamera } from "../src/features/viewer/follow";

const cameraA: CameraState = { position: [0, 1, 2], target: [3, 4, 5] };
const cameraB: CameraState = { position: [10, 11, 12], target: [13, 14, 15] };

function user(id: string, camera: CameraState | null): PresenceUser {
  return { id, name: id, color: "#112233", camera };
}

describe("followTargetCamera", () => {
  const users = {
    a: user("a", cameraA),
    empty: user("empty", null),
  };

  it.each([
    [null, "me", "no following user"],
    ["nope", "me", "an unknown user"],
    ["me", "me", "the current user"],
    ["empty", "me", "a user without a camera"],
  ])("returns null for %s (%s)", (followingUserId, selfId, _label) => {
    expect(followTargetCamera(users, followingUserId, selfId)).toBeNull();
  });

  it("returns a cloned target camera", () => {
    const result = followTargetCamera(users, "a", "me");
    expect(result).not.toBeNull();
    expect(cameraEquals(result!, cameraA)).toBe(true);
    expect(result).not.toBe(users.a.camera);
    expect(result!.position).not.toBe(users.a.camera!.position);
  });

  it("does not reject the target when selfId is not known", () => {
    const result = followTargetCamera(users, "a", null);
    expect(result).not.toBeNull();
    expect(cameraEquals(result!, cameraA)).toBe(true);
  });
});

describe("followStep", () => {
  it("lerps a distant camera without arriving", () => {
    const result = followStep(cameraA, cameraB);
    expect(cameraEquals(result.camera, lerpCamera(cameraA, cameraB, FOLLOW_LERP_T))).toBe(true);
    expect(result.arrived).toBe(false);
  });

  it("arrives when cameras are equal or within the default epsilon", () => {
    expect(followStep(cameraA, cameraA).arrived).toBe(true);
    const almostTarget: CameraState = {
      position: [cameraA.position[0] + 1e-6, cameraA.position[1], cameraA.position[2]],
      target: [...cameraA.target],
    };
    expect(followStep(cameraA, almostTarget).arrived).toBe(true);
  });

  it("converges to a distant target within 60 frames", () => {
    let current = cameraA;
    let arrived = false;
    for (let frame = 0; frame < 60; frame += 1) {
      const step = followStep(current, cameraB);
      current = step.camera;
      arrived = step.arrived;
    }
    expect(arrived).toBe(true);
  });
});

it("uses the specified follow interpolation coefficient", () => {
  expect(FOLLOW_LERP_T).toBe(0.2);
});
