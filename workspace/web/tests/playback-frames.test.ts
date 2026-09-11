import { AnimationClip, NumberKeyframeTrack } from "three";
import { describe, expect, it } from "vitest";
import {
  clampFps,
  DEFAULT_FPS,
  detectFps,
  frameOfTime,
  lastFrameOf,
  timeOfFrame,
} from "../src/features/viewer/playback-frames";

function clip(times: number[]): AnimationClip {
  return new AnimationClip("a", -1, [
    new NumberKeyframeTrack("root.opacity", times, times.map(() => 0)),
  ]);
}

describe("playback frame calculations", () => {
  it("clamps fps and uses the default for non-finite values", () => {
    expect(clampFps(30)).toBe(30);
    expect(clampFps(0)).toBe(1);
    expect(clampFps(-5)).toBe(1);
    expect(clampFps(1000)).toBe(240);
    expect(clampFps(Number.NaN)).toBe(DEFAULT_FPS);
    expect(clampFps(Number.POSITIVE_INFINITY)).toBe(DEFAULT_FPS);
  });

  it("detects the first fps that fits every finite key time", () => {
    expect(detectFps([clip([0, 1 / 24, 2 / 24, 3 / 24])])).toBe(24);
    expect(detectFps([clip([0, 1 / 30, 2 / 30])])).toBe(30);
    expect(detectFps([clip([0, 1 / 25, 2 / 25])])).toBe(25);
    expect(detectFps([clip([0, 1 / 60, 2 / 60])])).toBe(60);
    expect(detectFps([clip([0, 1 / 50, 2 / 50])])).toBe(50);
    expect(detectFps([clip([0, 1 / 48, 2 / 48])])).toBe(48);
    expect(detectFps([clip([0, 1 / 120, 2 / 120])])).toBe(120);
    expect(detectFps([clip([0, 1 / 12, 2 / 12])])).toBe(24);
    expect(detectFps([clip([0, 1 / 15, 2 / 15])])).toBe(30);
    expect(detectFps([clip([0, 0.5, 1])])).toBe(24);
    expect(detectFps([clip([0, 0.37])])).toBe(24);
    expect(detectFps([clip([0, 1 / 24]), clip([0, 1 / 30])])).toBe(120);
    expect(detectFps([clip([0, 1 / 30]), clip([0, 2 / 30, 1])])).toBe(30);
    expect(detectFps([])).toBe(24);
    expect(detectFps([new AnimationClip("e", 1, [])])).toBe(24);
    expect(detectFps([clip([0, 100 / 24])])).toBe(24);
  });

  it("converts between seconds and frame numbers", () => {
    expect(frameOfTime(1, 24)).toBe(24);
    expect(frameOfTime(0.5, 30)).toBe(15);
    expect(frameOfTime(1.99, 24)).toBe(48);
    expect(frameOfTime(Number.NaN, 24)).toBe(0);
    expect(frameOfTime(1, Number.NaN)).toBe(0);
    expect(timeOfFrame(12, 24)).toBe(0.5);
    expect(timeOfFrame(0, 24)).toBe(0);
    expect(timeOfFrame(Number.NaN, 24)).toBe(0);
    expect(timeOfFrame(12, 0)).toBe(0);
    expect(timeOfFrame(12, Number.NaN)).toBe(0);
    expect(lastFrameOf(2, 24)).toBe(48);
    expect(lastFrameOf(0.7, 24)).toBe(17);
    expect(lastFrameOf(0, 24)).toBe(0);
    expect(lastFrameOf(Number.NaN, 24)).toBe(0);
    expect(lastFrameOf(2, Number.NaN)).toBe(0);
  });
});
