import { AnimationClip } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelVersion } from "@shared/types";
import type { ClientMessage } from "@shared/protocol";
import { animatedObjects, resolvePlaybackSource } from "../src/features/viewer/playback-source";
import { switchPlaybackSource, syncPlaybackClips } from "../src/features/viewer/playback-source-sync";
import { useModelClipsStore } from "../src/features/trail/model-clips";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";
import { usePlaybackStore } from "../src/store/playback";

function version(id: string, number: number): ModelVersion {
  return { id, projectId: "project", number, fileName: `${id}.glb`, byteSize: 1, createdAt: 0 };
}

beforeEach(() => {
  useModelClipsStore.getState().reset();
  useObjectsStore.getState().reset();
  useDisplayStore.getState().reset();
  usePlaybackStore.getState().reset();
});

describe("playback source resolution", () => {
  it("filters unregistered and empty clips and sorts by number", () => {
    const v1 = version("v1", 1);
    const v2 = version("v2", 2);
    const v3 = version("v3", 3);
    expect(animatedObjects([v1, v2, v3], { v1: [], v2: [new AnimationClip("walk", 1)] })).toEqual([v2]);
    expect(animatedObjects([v3, v1], { v3: [new AnimationClip("late", 1)], v1: [new AnimationClip("early", 1)] }))
      .toEqual([v1, v3]);
  });

  it("prefers a valid selected source and otherwise falls back to the first animated version", () => {
    const v1 = version("v1", 1);
    const v2 = version("v2", 2);
    const clips = { v1: [new AnimationClip("one", 1)], v2: [new AnimationClip("two", 1)] };
    expect(resolvePlaybackSource([version("v1", 1), version("v2", 2)], { v1: [], v2: clips.v2 }, null)).toBe("v2");
    expect(resolvePlaybackSource([v1, v2], clips, "v2")).toBe("v2");
    expect(resolvePlaybackSource([v1, v2], clips, "v9")).toBe("v1");
    expect(resolvePlaybackSource([v1, v2], { v1: clips.v1, v2: [] }, "v2")).toBe("v1");
    expect(resolvePlaybackSource([v1], { v1: [] }, null)).toBeNull();
  });
});

describe("playback source switching", () => {
  it("synchronizes clips and broadcasts a valid source change", () => {
    const v1 = version("v1", 1);
    const v2 = version("v2", 2);
    const clips = [new AnimationClip("walk", 3)];
    useObjectsStore.getState().setObjects([v1, v2]);
    useModelClipsStore.getState().register("v1", [new AnimationClip("old", 1)]);
    useModelClipsStore.getState().register("v2", clips);
    usePlaybackStore.getState().setClips([{ name: "old", duration: 1 }], 24, "v1");
    const send = vi.fn((_message: ClientMessage) => true);

    expect(switchPlaybackSource("v2", send)).toBe(true);
    expect(useDisplayStore.getState().playbackSource).toBe("v2");
    expect(usePlaybackStore.getState()).toMatchObject({ sourceId: "v2", clips: [{ name: "walk", duration: 3 }], clipIndex: 0, time: 0 });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ type: "playback:source", versionId: "v2" });
  });

  it("does not broadcast an already active source and rejects non-animated versions", () => {
    useObjectsStore.getState().setObjects([version("v1", 1), version("v3", 3)]);
    useModelClipsStore.getState().register("v1", [new AnimationClip("walk", 3)]);
    useModelClipsStore.getState().register("v3", []);
    usePlaybackStore.getState().setClips([{ name: "walk", duration: 3 }], 24, "v1");
    usePlaybackStore.getState().seek(1);
    const before = usePlaybackStore.getState();
    const send = vi.fn((_message: ClientMessage) => true);

    expect(switchPlaybackSource("v1", send)).toBe(true);
    expect(usePlaybackStore.getState().time).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(switchPlaybackSource("v3", send)).toBe(false);
    expect(usePlaybackStore.getState()).toBe(before);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("playback clip synchronization", () => {
  it("preserves position for equal source and summaries and resets otherwise", () => {
    const clip = new AnimationClip("walk", 3);
    syncPlaybackClips("v2", [clip]);
    usePlaybackStore.getState().selectClip(0);
    usePlaybackStore.getState().seek(1);
    syncPlaybackClips("v2", [new AnimationClip("walk", 3)]);
    expect(usePlaybackStore.getState()).toMatchObject({ sourceId: "v2", clipIndex: 0, time: 1 });
    syncPlaybackClips("v2", [new AnimationClip("run", 3)]);
    expect(usePlaybackStore.getState()).toMatchObject({ sourceId: "v2", clipIndex: 0, time: 0 });
    syncPlaybackClips(null, []);
    expect(usePlaybackStore.getState()).toMatchObject({ sourceId: null, clips: [], time: 0 });
  });
});
