import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AnimationClip } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@shared/protocol";
import type { ModelVersion } from "@shared/types";
import { PlaybackSourceSelect } from "../src/features/timeline/PlaybackSourceSelect";
import { useModelClipsStore } from "../src/features/trail/model-clips";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";
import { usePlaybackStore } from "../src/store/playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function version(id: string, number: number, fileName: string): ModelVersion {
  return { id, projectId: "project", number, fileName, byteSize: 1, createdAt: number };
}

function renderSelect(send: (message: ClientMessage) => boolean): { host: HTMLDivElement; root: Root } {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(createElement(PlaybackSourceSelect, { send })));
  return { host, root };
}

function registerAnimatedVersions(): { first: readonly AnimationClip[]; second: readonly AnimationClip[] } {
  useObjectsStore.getState().setObjects([
    version("v2", 2, "b.glb"),
    version("v1", 1, "a.fbx"),
  ]);
  const first = [new AnimationClip("walk", 1)];
  const second = [new AnimationClip("run", 2)];
  useModelClipsStore.getState().register("v1", first);
  useModelClipsStore.getState().register("v2", second);
  useDisplayStore.getState().setPlaybackSource("v1");
  usePlaybackStore.getState().setClips(first.map((clip) => ({ name: clip.name, duration: clip.duration })), 24, "v1");
  return { first, second };
}

afterEach(() => {
  useModelClipsStore.getState().reset();
  useObjectsStore.getState().reset();
  useDisplayStore.getState().reset();
  usePlaybackStore.getState().reset();
  document.body.replaceChildren();
});

describe("playback source select", () => {
  it("is hidden when fewer than two objects have animation clips", () => {
    const send = vi.fn(() => true);
    const empty = renderSelect(send);
    expect(empty.host.querySelector("label")).toBeNull();
    expect(empty.host.querySelector("select")).toBeNull();
    act(() => {
      useObjectsStore.getState().setObjects([version("v1", 1, "a.fbx"), version("v2", 2, "b.glb")]);
      useModelClipsStore.getState().register("v1", [new AnimationClip("walk", 1)]);
      useModelClipsStore.getState().register("v2", []);
    });
    expect(empty.host.querySelector("label")).toBeNull();
    expect(empty.host.querySelector("select")).toBeNull();
    empty.root.unmount();
  });

  it("renders animated versions in number order and switches the shared source", () => {
    registerAnimatedVersions();
    const send = vi.fn(() => true);
    const { host, root } = renderSelect(send);
    try {
      const field = host.querySelector("label.timeline__field") as HTMLLabelElement;
      const select = host.querySelector("select") as HTMLSelectElement;
      expect(field.querySelector("span")?.textContent).toBe("対象オブジェクト");
      expect(field.contains(select)).toBe(true);
      expect(select.className).toBe("input timeline__source");
      expect(select.getAttribute("aria-label")).toBe("対象オブジェクト");
      expect(select.value).toBe("v1");
      expect([...select.options].map((option) => option.text)).toEqual(["a.fbx", "b.glb"]);

      act(() => {
        select.value = "v2";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith({ type: "playback:source", versionId: "v2" });
      expect(useDisplayStore.getState().playbackSource).toBe("v2");
      expect(usePlaybackStore.getState().sourceId).toBe("v2");
    } finally {
      root.unmount();
    }
  });

  it("follows an external source change and disappears when a source unregisters", () => {
    const { second } = registerAnimatedVersions();
    const send = vi.fn(() => true);
    const { host, root } = renderSelect(send);
    try {
      const select = () => host.querySelector("select") as HTMLSelectElement;
      act(() => useDisplayStore.getState().setPlaybackSource("v2"));
      expect(select().value).toBe("v2");
      act(() => useModelClipsStore.getState().unregister("v2", second));
      expect(host.querySelector("select")).toBeNull();
    } finally {
      root.unmount();
    }
  });
});
