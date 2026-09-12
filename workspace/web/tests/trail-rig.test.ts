/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationClip, Group, Object3D } from "three";
import { useDisplayStore } from "../src/store/display";
import { usePlaybackStore } from "../src/store/playback";
import { useModelScenesStore } from "../src/features/compare/model-scenes";
import { useModelClipsStore } from "../src/features/trail/model-clips";
import { TrailRig } from "../src/features/trail/TrailRig";
import { trailOverlayOf } from "../src/features/trail/trail-overlay";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const testHooks = vi.hoisted(() => ({
  frameCallbacks: [] as Array<() => void>,
  sampleTrail: vi.fn(() => ({
    positions: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    frameCount: 3,
  })),
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: () => void) => {
    testHooks.frameCallbacks.push(callback);
  },
}));

vi.mock("../src/features/trail/trail-sample", () => ({
  sampleTrail: testHooks.sampleTrail,
}));

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function target(versionId: string, objectPath = "0") {
  return { versionId, objectPath };
}

async function flush(callback: () => void): Promise<void> {
  await act(async () => callback());
}

afterEach(() => {
  useDisplayStore.getState().reset();
  usePlaybackStore.getState().reset();
  useModelScenesStore.getState().reset();
  useModelClipsStore.getState().reset();
  testHooks.frameCallbacks.length = 0;
  testHooks.sampleTrail.mockClear();
});

describe("trail rig", () => {
  it("mounts only when visibility, target, scene, and clip are valid", async () => {
    const scene = new Group();
    scene.add(new Object3D());
    const clip = new AnimationClip("walk", 1);
    const host = document.createElement("div");
    const root = createRoot(host);

    try {
      await flush(() => root.render(createElement(TrailRig)));
      expect(trailOverlayOf(scene)).toBeNull();

      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: true, target: target("v1") }));
      expect(trailOverlayOf(scene)).toBeNull();
      expect(testHooks.sampleTrail).not.toHaveBeenCalled();

      useModelScenesStore.getState().register("v1", scene);
      await flush(() => undefined);
      expect(trailOverlayOf(scene)).toBeNull();
      expect(testHooks.sampleTrail).not.toHaveBeenCalled();

      useModelClipsStore.getState().register("v1", [clip]);
      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: true, target: target("v1", "99") }));
      expect(trailOverlayOf(scene)).toBeNull();
      expect(testHooks.sampleTrail).not.toHaveBeenCalled();

      usePlaybackStore.getState().setClips([
        { name: "first", duration: 1 },
        { name: "second", duration: 1 },
      ]);
      await flush(() => usePlaybackStore.getState().selectClip(1));
      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: true, target: target("v1") }));
      expect(trailOverlayOf(scene)).toBeNull();
      expect(testHooks.sampleTrail).not.toHaveBeenCalled();

      await flush(() => usePlaybackStore.getState().selectClip(0));
      expect(trailOverlayOf(scene)).not.toBeNull();
      expect(testHooks.sampleTrail).toHaveBeenCalledOnce();

      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: false, target: target("v1") }));
      expect(trailOverlayOf(scene)).toBeNull();

      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: true, target: null }));
      expect(trailOverlayOf(scene)).toBeNull();
    } finally {
      await flush(() => root.unmount());
      host.remove();
    }
  });

  it("rebuilds on target, clip, and fps changes and updates the current frame", async () => {
    const firstScene = new Group();
    const firstObject = new Object3D();
    firstScene.add(firstObject);
    const secondScene = new Group();
    const secondObject = new Object3D();
    secondScene.add(secondObject);
    const firstClip = new AnimationClip("first", 1);
    const secondClip = new AnimationClip("second", 2);
    const host = document.createElement("div");
    const root = createRoot(host);

    useModelScenesStore.getState().register("v1", firstScene);
    useModelScenesStore.getState().register("v2", secondScene);
    useModelClipsStore.getState().register("v1", [firstClip]);
    useModelClipsStore.getState().register("v2", [firstClip, secondClip]);
    usePlaybackStore.getState().setClips([
      { name: "first", duration: 1 },
      { name: "second", duration: 2 },
    ]);
    usePlaybackStore.getState().seek(0.25);
    useDisplayStore.getState().setMotionTrail({ visible: true, target: target("v1") });

    try {
      await flush(() => root.render(createElement(TrailRig)));
      const firstOverlay = trailOverlayOf(firstScene);
      expect(firstOverlay).not.toBeNull();
      expect(trailOverlayOf(secondScene)).toBeNull();
      expect(testHooks.sampleTrail).toHaveBeenCalledWith(firstScene, firstObject, firstClip, 24, 0.25);

      usePlaybackStore.getState().seekFrame(1);
      testHooks.frameCallbacks[0]!();
      expect(firstOverlay!.children[2]!.position.toArray()).toEqual([3, 4, 5]);

      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: true, target: target("v2") }));
      expect(trailOverlayOf(firstScene)).toBeNull();
      expect(trailOverlayOf(secondScene)).not.toBeNull();

      await flush(() => usePlaybackStore.getState().selectClip(1));
      const secondOverlay = trailOverlayOf(secondScene);
      expect(secondOverlay).not.toBeNull();
      expect(testHooks.sampleTrail).toHaveBeenLastCalledWith(secondScene, secondObject, secondClip, 24, 0);

      await flush(() => usePlaybackStore.getState().setFps(30));
      expect(testHooks.sampleTrail).toHaveBeenLastCalledWith(secondScene, secondObject, secondClip, 30, 0);
      expect(trailOverlayOf(secondScene)).not.toBe(secondOverlay);

      await flush(() => useDisplayStore.getState().setMotionTrail({ visible: false, target: target("v2") }));
      expect(trailOverlayOf(firstScene)).toBeNull();
      expect(trailOverlayOf(secondScene)).toBeNull();
    } finally {
      await flush(() => root.unmount());
      expect(trailOverlayOf(firstScene)).toBeNull();
      expect(trailOverlayOf(secondScene)).toBeNull();
      host.remove();
    }
  });

  it("uses the stores, frame loop, and stable effect dependencies", () => {
    const source = readSource("features/trail/TrailRig.tsx");
    expect(source).toContain("export function TrailRig(): null");
    expect(source).toContain("useDisplayStore(");
    expect(source).toContain("useModelScenesStore(");
    expect(source).toContain("useModelClipsStore(");
    expect(source).toContain("usePlaybackStore(");
    expect(source).toContain("useFrame(");
    expect(source).toContain("}, [scenes, clips, motionTrail, clipIndex, fps]);");
    expect(source).not.toMatch(/\[[^\]]*\btime\b[^\]]*\]/);
  });

  it("places TrailRig after JointRig inside ViewerCanvas", () => {
    const page = readSource("app/ReviewPage.tsx");
    expect(page).toContain('import { TrailRig } from "../features/trail/TrailRig";');
    expect(page.match(/<TrailRig \/>/g)).toHaveLength(1);
    expect(page.indexOf("<TrailRig />")).toBeGreaterThan(page.indexOf("<JointRig />"));
    expect(page.indexOf("<TrailRig />")).toBeLessThan(page.indexOf("</ViewerCanvas>"));
  });
});
