/// <reference types="node" />

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AnimationClip } from "three";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ModelVersion } from "@shared/types";
import { PlaybackSourceSync } from "../src/features/viewer/PlaybackSourceSync";
import { useModelClipsStore } from "../src/features/trail/model-clips";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";
import { usePlaybackStore } from "../src/store/playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function version(id: string, number: number): ModelVersion {
  return { id, projectId: "project", number, fileName: `${id}.glb`, byteSize: 1, createdAt: 0 };
}

beforeEach(() => {
  useModelClipsStore.getState().reset();
  useObjectsStore.getState().reset();
  useDisplayStore.getState().reset();
  usePlaybackStore.getState().reset();
});

afterEach(() => {
  useModelClipsStore.getState().reset();
  useObjectsStore.getState().reset();
  useDisplayStore.getState().reset();
  usePlaybackStore.getState().reset();
});

describe("PlaybackSourceSync", () => {
  it("registers a later animated model after an initially empty model", async () => {
    useObjectsStore.getState().setObjects([version("v1", 1), version("v2", 2)]);
    useModelClipsStore.getState().register("v1", []);
    const host = document.createElement("div");
    const root = createRoot(host);
    const clips = [new AnimationClip("walk", 3)];

    try {
      await act(async () => root.render(createElement(PlaybackSourceSync)));
      expect(usePlaybackStore.getState().sourceId).toBeNull();
      await act(async () => useModelClipsStore.getState().register("v2", clips));
      expect(usePlaybackStore.getState()).toMatchObject({ sourceId: "v2", clips: [{ name: "walk", duration: 3 }] });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("follows a preferred source, replacement fallback, and an empty registry", async () => {
    useObjectsStore.getState().setObjects([version("v1", 1), version("v2", 2), version("v3", 3)]);
    const v1Clips = [new AnimationClip("one", 1)];
    const v2Clips = [new AnimationClip("two", 2)];
    const v3Clips = [new AnimationClip("three", 3)];
    useModelClipsStore.getState().register("v1", v1Clips);
    useModelClipsStore.getState().register("v2", v2Clips);
    useModelClipsStore.getState().register("v3", v3Clips);
    const host = document.createElement("div");
    const root = createRoot(host);

    try {
      await act(async () => root.render(createElement(PlaybackSourceSync)));
      usePlaybackStore.getState().play();
      usePlaybackStore.getState().seek(0.5);
      await act(async () => useDisplayStore.getState().setPlaybackSource("v2"));
      expect(usePlaybackStore.getState()).toMatchObject({ sourceId: "v2", time: 0 });
      await act(async () => useModelClipsStore.getState().unregister("v2", v2Clips));
      expect(usePlaybackStore.getState().sourceId).toBe("v1");
      await act(async () => useModelClipsStore.getState().unregister("v1", v1Clips));
      expect(usePlaybackStore.getState().sourceId).toBe("v3");
      await act(async () => useModelClipsStore.getState().unregister("v3", v3Clips));
      expect(usePlaybackStore.getState()).toMatchObject({ sourceId: null, clips: [] });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
