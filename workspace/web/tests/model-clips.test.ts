import { AnimationClip } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { selectModelClips, useModelClipsStore } from "../src/features/trail/model-clips";

describe("model clips store", () => {
  afterEach(() => useModelClipsStore.getState().reset());

  it("registers and selects clips, including an empty array", () => {
    const clips = [new AnimationClip("move", 1)];
    const empty: readonly AnimationClip[] = [];

    expect(selectModelClips({}, null)).toBeNull();
    expect(selectModelClips({}, "v1")).toBeNull();
    useModelClipsStore.getState().register("v1", clips);
    useModelClipsStore.getState().register("v2", empty);

    expect(useModelClipsStore.getState().clips.v1).toBe(clips);
    expect(selectModelClips(useModelClipsStore.getState().clips, "v1")).toBe(clips);
    expect(selectModelClips(useModelClipsStore.getState().clips, "v2")).toBe(empty);
  });

  it("does not notify or replace state for an identical registration", () => {
    const clips = [new AnimationClip("move", 1)];
    const listener = vi.fn();
    const unsubscribe = useModelClipsStore.subscribe(listener);

    useModelClipsStore.getState().register("v1", clips);
    const stateBefore = useModelClipsStore.getState();
    listener.mockClear();
    useModelClipsStore.getState().register("v1", clips);

    expect(useModelClipsStore.getState()).toBe(stateBefore);
    expect(useModelClipsStore.getState().clips).toBe(stateBefore.clips);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("replaces clips and unregisters only the matching reference", () => {
    const first = [new AnimationClip("first", 1)];
    const second = [new AnimationClip("second", 1)];

    useModelClipsStore.getState().register("v1", first);
    useModelClipsStore.getState().register("v1", second);
    useModelClipsStore.getState().unregister("v1", first);
    expect(useModelClipsStore.getState().clips.v1).toBe(second);
    useModelClipsStore.getState().unregister("v1", second);
    expect(Object.hasOwn(useModelClipsStore.getState().clips, "v1")).toBe(false);
    expect(() => useModelClipsStore.getState().unregister("missing", first)).not.toThrow();
  });

  it("resets registrations", () => {
    useModelClipsStore.getState().register("v1", []);
    useModelClipsStore.getState().reset();
    expect(useModelClipsStore.getState().clips).toEqual({});
  });
});
