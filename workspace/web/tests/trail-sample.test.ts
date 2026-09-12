import { AnimationClip, Group, NumberKeyframeTrack, Object3D } from "three";
import { describe, expect, it } from "vitest";
import { MAX_TRAIL_FRAMES, sampleTrail } from "../src/features/trail/trail-sample";

function movingRig(): { root: Group; object: Object3D; clip: AnimationClip } {
  const root = new Group();
  const object = new Object3D();
  object.name = "Target";
  root.add(object);
  const track = new NumberKeyframeTrack("Target.position[x]", [0, 1], [0, 1]);
  return { root, object, clip: new AnimationClip("move", 1, [track]) };
}

describe("trail sampling", () => {
  it("includes both endpoints and interpolates monotonically", () => {
    const { root, object, clip } = movingRig();
    object.position.x = 0.5;
    root.updateMatrixWorld(true);
    const sample = sampleTrail(root, object, clip, 24, 0.5);

    expect(sample.frameCount).toBe(25);
    expect(sample.positions.length).toBe(75);
    expect(sample.positions[0]).toBeCloseTo(0);
    expect(sample.positions[72]).toBeCloseTo(1);
    for (let frame = 1; frame < sample.frameCount; frame += 1) {
      expect(sample.positions[frame * 3]).toBeGreaterThanOrEqual(sample.positions[(frame - 1) * 3] ?? 0);
    }
    expect(object.position.x).toBeCloseTo(0.5);
  });

  it("returns one frame for invalid or zero duration inputs", () => {
    const { root, object, clip } = movingRig();
    expect(sampleTrail(root, object, new AnimationClip("empty", 0), 24, 0).frameCount).toBe(1);
    expect(sampleTrail(root, object, clip, 0, 0).frameCount).toBe(1);
    expect(sampleTrail(root, object, clip, Number.NaN, 0).frameCount).toBe(1);
    expect(sampleTrail(root, object, new AnimationClip("infinite", Number.POSITIVE_INFINITY), 24, 0).frameCount).toBe(1);
  });

  it("caps very long clips and converts world positions to root local space", () => {
    const root = new Group();
    root.position.set(10, 2, -4);
    root.rotation.y = Math.PI / 2;
    const object = new Object3D();
    object.position.set(1, 3, 5);
    root.add(object);
    const clip = new AnimationClip("long", 100, []);
    const sample = sampleTrail(root, object, clip, 24, 0);

    expect(sample.frameCount).toBe(MAX_TRAIL_FRAMES);
    expect(sample.positions.length).toBe(MAX_TRAIL_FRAMES * 3);
    expect(sample.positions[0]).toBeCloseTo(1);
    expect(sample.positions[1]).toBeCloseTo(3);
    expect(sample.positions[2]).toBeCloseTo(5);
  });

  it("restores the current pose and leaves no mixer state for the next sample", () => {
    const { root, object, clip } = movingRig();
    const current = 0.25;
    object.position.x = current;
    root.updateMatrixWorld(true);
    const before = object.matrixWorld.clone();
    const first = sampleTrail(root, object, clip, 24, current);
    const after = object.matrixWorld.clone();
    const second = sampleTrail(root, object, clip, 24, current);

    expect(after.elements).toEqual(before.elements);
    expect(first.positions).toEqual(second.positions);
    expect(object.position.x).toBeCloseTo(current);
  });
});
