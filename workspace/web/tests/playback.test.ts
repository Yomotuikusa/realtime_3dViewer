import { AnimationClip } from "three";
import { describe, expect, it } from "vitest";
import {
  advanceTime,
  clampTime,
  clipSummaries,
  currentDuration,
} from "../src/features/viewer/playback";

describe("playback calculations", () => {
  it("summarizes clips with fallback names and sanitized durations", () => {
    const clips = [
      new AnimationClip("walk", 2, []),
      new AnimationClip("", 1, []),
      new AnimationClip("", 1, []),
      new AnimationClip("bad", Number.NaN, []),
      new AnimationClip("negative", -1, []),
    ];
    const summaries = clipSummaries(clips);

    expect(summaries).toEqual([
      { name: "walk", duration: 2 },
      { name: "Clip 2", duration: 1 },
      { name: "Clip 3", duration: 1 },
      { name: "bad", duration: 0 },
      { name: "negative", duration: 0 },
    ]);
    expect(summaries).not.toBe(clips);
    expect(summaries[0]).not.toBe(clips[0]);
    expect(clipSummaries([])).toEqual([]);
  });

  it("gets the selected duration and returns zero for invalid indexes", () => {
    const clips = [{ name: "walk", duration: 3 }];
    expect(currentDuration(clips, 0)).toBe(3);
    expect(currentDuration(clips, -1)).toBe(0);
    expect(currentDuration(clips, 1)).toBe(0);
    expect(currentDuration([], 0)).toBe(0);
  });

  it("clamps times to the selected duration", () => {
    expect(clampTime(1.5, 3)).toBe(1.5);
    expect(clampTime(5, 3)).toBe(3);
    expect(clampTime(-1, 3)).toBe(0);
    expect(clampTime(Number.NaN, 3)).toBe(0);
    expect(clampTime(Number.POSITIVE_INFINITY, 3)).toBe(0);
    expect(clampTime(1, 0)).toBe(0);
    expect(clampTime(1, Number.NaN)).toBe(0);
  });

  it("advances and wraps playback time", () => {
    expect(advanceTime(1, 0.5, 3)).toBe(1.5);
    expect(advanceTime(2.8, 0.5, 3)).toBeCloseTo(0.3);
    expect(advanceTime(2.5, 0.5, 3)).toBe(0);
    expect(advanceTime(1, 7, 3)).toBe(2);
    expect(advanceTime(1, Number.NaN, 3)).toBe(1);
    expect(advanceTime(1, -1, 3)).toBe(1);
    expect(advanceTime(1, 0.5, 0)).toBe(0);
  });
});
