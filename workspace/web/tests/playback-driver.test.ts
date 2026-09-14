import {
  AnimationClip,
  Object3D,
  VectorKeyframeTrack,
} from "three";
import { describe, expect, it } from "vitest";
import { createPlaybackDriver } from "../src/features/viewer/playback-driver";

function makeFixture(): { root: Object3D; clips: AnimationClip[] } {
  const root = new Object3D();
  root.name = "root";
  const slide = new AnimationClip("slide", 2, [
    new VectorKeyframeTrack("root.position", [0, 2], [0, 0, 0, 10, 0, 0]),
  ]);
  const jump = new AnimationClip("jump", 1, [
    new VectorKeyframeTrack("root.position", [0, 1], [0, 0, 0, 0, 5, 0]),
  ]);
  return { root, clips: [slide, jump] };
}

describe("playback driver", () => {
  it("applies absolute looping times for the active clip", () => {
    const { root, clips } = makeFixture();
    const driver = createPlaybackDriver(root, clips);
    driver.apply(0, 0.5);
    expect(root.position.x).toBeCloseTo(2.5);
    driver.apply(0, 2);
    expect(root.position.x).toBeCloseTo(0);
    driver.apply(0, 2.5);
    expect(root.position.x).toBeCloseTo(2.5);
  });

  it("stops the old action when switching clips and can switch back", () => {
    const { root, clips } = makeFixture();
    const driver = createPlaybackDriver(root, clips);
    driver.apply(0, 0.5);
    driver.apply(1, 0.5);
    expect(root.position.toArray()).toEqual([0, 2.5, 0]);
    driver.apply(0, 1);
    expect(root.position.toArray()).toEqual([5, 0, 0]);
  });

  it("ignores invalid indexes and disposed drivers", () => {
    const { root, clips } = makeFixture();
    const driver = createPlaybackDriver(root, clips);
    driver.apply(0, 0.5);
    driver.apply(2, 0.5);
    driver.apply(-1, 0.5);
    expect(root.position.x).toBeCloseTo(2.5);
    driver.dispose();
    const disposedPosition = root.position.toArray();
    driver.apply(0, 1);
    expect(root.position.toArray()).toEqual(disposedPosition);
    expect(() => driver.dispose()).not.toThrow();
  });

  it("does nothing for an empty clip list", () => {
    const root = new Object3D();
    const driver = createPlaybackDriver(root, []);
    expect(() => driver.apply(0, 1)).not.toThrow();
    expect(root.position.toArray()).toEqual([0, 0, 0]);
  });

  it("stops at the original pose and can resume after stopping", () => {
    const { root, clips } = makeFixture();
    const driver = createPlaybackDriver(root, clips);

    expect(() => driver.stop()).not.toThrow();
    driver.apply(0, 0.5);
    driver.stop();
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(() => driver.stop()).not.toThrow();
    driver.apply(0, 1);
    expect(root.position.x).toBeCloseTo(5);
  });
});
