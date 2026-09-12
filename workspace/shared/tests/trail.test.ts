import { describe, expect, it } from "vitest";
import {
  cloneMotionTrail,
  DEFAULT_MOTION_TRAIL,
  MotionTrailSchema,
  motionTrailEquals,
  type MotionTrail,
} from "../src";

const target = { versionId: "v1", objectPath: "0/2" };

describe("motion trail", () => {
  it("compares visible and object-part target values", () => {
    expect(motionTrailEquals({ visible: true, target: null }, { visible: true, target: null })).toBe(true);
    expect(motionTrailEquals({ visible: true, target: null }, { visible: true, target })).toBe(false);
    expect(motionTrailEquals({ visible: true, target }, { visible: false, target })).toBe(false);
    expect(motionTrailEquals({ visible: true, target }, { visible: true, target: { ...target } })).toBe(true);
    expect(motionTrailEquals({ visible: true, target }, { visible: true, target: { versionId: "v2", objectPath: "0/2" } })).toBe(false);
    expect(motionTrailEquals({ visible: true, target }, { visible: true, target: { versionId: "v1", objectPath: "0/3" } })).toBe(false);
  });

  it("clones the target reference and preserves null", () => {
    const trail: MotionTrail = { visible: false, target };
    const copy = cloneMotionTrail(trail);
    expect(copy).toEqual(trail);
    expect(copy).not.toBe(trail);
    expect(copy.target).not.toBe(trail.target);
    expect(cloneMotionTrail(DEFAULT_MOTION_TRAIL).target).toBeNull();
  });

  it("validates the target object path and visible flag", () => {
    expect(MotionTrailSchema.safeParse({ visible: true, target: null }).success).toBe(true);
    expect(MotionTrailSchema.safeParse({ visible: true, target }).success).toBe(true);
    for (const objectPath of ["/0", "", "a"]) {
      expect(MotionTrailSchema.safeParse({ visible: true, target: { ...target, objectPath } }).success).toBe(false);
    }
    expect(MotionTrailSchema.safeParse({ target: null }).success).toBe(false);
  });
});
