import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackStore } from "../src/store/playback";

const clips = [
  { name: "walk", duration: 3 },
  { name: "jump", duration: 1 },
];

describe("playback store", () => {
  beforeEach(() => usePlaybackStore.getState().reset());

  it("starts and resets at its initial state", () => {
    expect(usePlaybackStore.getState()).toMatchObject({ clips: [], clipIndex: 0, playing: false, time: 0, fps: 24 });
    usePlaybackStore.getState().setClips(clips);
    usePlaybackStore.getState().play();
    usePlaybackStore.getState().seek(1);
    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState()).toMatchObject({ clips: [], clipIndex: 0, playing: false, time: 0, fps: 24 });
  });

  it("clones clips and resets selection when clips are replaced", () => {
    usePlaybackStore.getState().setClips(clips);
    const stateClips = usePlaybackStore.getState().clips;
    expect(stateClips).toEqual(clips);
    expect(stateClips).not.toBe(clips);
    expect(stateClips[0]).not.toBe(clips[0]);
    usePlaybackStore.getState().play();
    usePlaybackStore.getState().seek(1);
    usePlaybackStore.getState().setClips([]);
    expect(usePlaybackStore.getState()).toMatchObject({ clips: [], clipIndex: 0, playing: false, time: 0 });
  });

  it("selects valid clips, resets time, and preserves playing state", () => {
    usePlaybackStore.getState().setClips(clips);
    usePlaybackStore.getState().play();
    usePlaybackStore.getState().seek(1);
    usePlaybackStore.getState().selectClip(1);
    expect(usePlaybackStore.getState()).toMatchObject({ clipIndex: 1, time: 0, playing: true });
    usePlaybackStore.getState().seek(0.5);
    usePlaybackStore.getState().selectClip(1);
    expect(usePlaybackStore.getState().time).toBe(0);
  });

  it("ignores invalid clip indexes and does not play without clips", () => {
    const initial = usePlaybackStore.getState();
    for (const index of [2, -1, 0.5, Number.NaN]) {
      usePlaybackStore.getState().selectClip(index);
    }
    expect(usePlaybackStore.getState()).toEqual(initial);
    usePlaybackStore.getState().play();
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().playing).toBe(false);
  });

  it("plays, pauses, toggles, seeks, and wraps invalid seeks", () => {
    usePlaybackStore.getState().setClips([{ name: "walk", duration: 3 }]);
    usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().playing).toBe(true);
    usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().playing).toBe(false);
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().playing).toBe(true);
    usePlaybackStore.getState().toggle();
    expect(usePlaybackStore.getState().playing).toBe(false);
    usePlaybackStore.getState().play();
    usePlaybackStore.getState().seek(1.5);
    expect(usePlaybackStore.getState()).toMatchObject({ time: 1.5, playing: true });
    usePlaybackStore.getState().seek(5);
    expect(usePlaybackStore.getState().time).toBe(3);
    usePlaybackStore.getState().seek(-1);
    expect(usePlaybackStore.getState().time).toBe(0);
    usePlaybackStore.getState().seek(Number.NaN);
    expect(usePlaybackStore.getState().time).toBe(0);
  });

  it("keeps seek at zero when there are no clips", () => {
    usePlaybackStore.getState().seek(1);
    expect(usePlaybackStore.getState().time).toBe(0);
  });

  it("sets, seeks, and resets the frame rate without changing seconds", () => {
    const clip = { name: "walk", duration: 2 };
    expect(usePlaybackStore.getState().fps).toBe(24);
    usePlaybackStore.getState().setClips([clip]);
    expect(usePlaybackStore.getState().fps).toBe(24);
    usePlaybackStore.getState().setClips([clip], 30);
    expect(usePlaybackStore.getState()).toMatchObject({ fps: 30, clipIndex: 0, playing: false, time: 0 });
    usePlaybackStore.getState().setClips([clip], Number.NaN);
    expect(usePlaybackStore.getState().fps).toBe(24);
    usePlaybackStore.getState().setClips([clip], 1000);
    expect(usePlaybackStore.getState().fps).toBe(240);
    usePlaybackStore.getState().setFps(60);
    usePlaybackStore.getState().setClips([]);
    expect(usePlaybackStore.getState().fps).toBe(24);

    usePlaybackStore.getState().setClips([clip], 24);
    usePlaybackStore.getState().seekFrame(12);
    expect(usePlaybackStore.getState().time).toBe(0.5);
    usePlaybackStore.getState().seekFrame(100);
    expect(usePlaybackStore.getState().time).toBe(2);
    usePlaybackStore.getState().seekFrame(-3);
    expect(usePlaybackStore.getState().time).toBe(0);
    usePlaybackStore.getState().play();
    usePlaybackStore.getState().seekFrame(6);
    expect(usePlaybackStore.getState()).toMatchObject({ time: 0.25, playing: true });
    usePlaybackStore.getState().seek(1);
    usePlaybackStore.getState().seekFrame(Number.NaN);
    expect(usePlaybackStore.getState().time).toBe(1);
    usePlaybackStore.getState().setFps(30);
    expect(usePlaybackStore.getState()).toMatchObject({ fps: 30, time: 1 });
    usePlaybackStore.getState().setFps(0);
    expect(usePlaybackStore.getState().fps).toBe(1);
    usePlaybackStore.getState().setFps(500);
    expect(usePlaybackStore.getState().fps).toBe(240);
    usePlaybackStore.getState().setFps(Number.NaN);
    expect(usePlaybackStore.getState().fps).toBe(240);
    usePlaybackStore.getState().setFps(Number.POSITIVE_INFINITY);
    expect(usePlaybackStore.getState().fps).toBe(240);
    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState()).toMatchObject({ clips: [], playing: false, time: 0, fps: 24 });
  });
});
