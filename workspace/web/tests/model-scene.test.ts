/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AnimationClip, Object3D } from "three";
import { useModelScenesStore } from "../src/features/compare/model-scenes";
import { useModelClipsStore, selectModelClips } from "../src/features/trail/model-clips";
import { useModelScene } from "../src/features/viewer/useModelScene";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

interface SceneHarnessProps {
  scene: Object3D;
  animations: readonly AnimationClip[];
  versionId: string;
}

function SceneHarness({ scene, animations, versionId }: SceneHarnessProps): null {
  useModelScene(scene, animations, { versionId, primary: false, meshDisplay: "solid" });
  return null;
}

afterEach(() => {
  useModelClipsStore.getState().reset();
  useModelScenesStore.getState().reset();
});

describe("model scene loader selection", () => {
  it("imports the FBX and OBJ loaders", () => {
    const source = readSource("features/viewer/ModelMesh.tsx");
    expect(source).toContain('from "three/examples/jsm/loaders/FBXLoader.js"');
    expect(source).toContain('from "three/examples/jsm/loaders/OBJLoader.js"');
  });

  it("uses the configurable loader for each supported format", () => {
    const source = readSource("features/viewer/ModelMesh.tsx");
    expect(source).not.toContain("useFBX");
    expect(source).toContain("useLoader(FBXLoader, src, extendLoader)");
    expect(source).toContain("useLoader(OBJLoader, src, extendLoader)");
    expect(source).toContain("useGLTF(src, true, true, extendLoader)");
  });

  it("centralizes the same-origin manager and format mapping", () => {
    const source = readSource("features/viewer/ModelMesh.tsx");
    expect(source.match(/loader\.manager = createModelLoadingManager\(location\.origin\)/g)).toHaveLength(1);
    expect(source).toMatch(/MODEL_COMPONENTS[\s\S]*glb:[\s\S]*gltf:[\s\S]*fbx:[\s\S]*obj:/);
  });

  it("keeps OBJ animation state stable and avoids scale correction", () => {
    const source = readSource("features/viewer/ModelMesh.tsx");
    expect(source).toContain("animations={NO_ANIMATIONS}");
    expect(source).not.toContain("animations={[]}");
    expect(source.split("\n").some((line) => line.startsWith("const NO_ANIMATIONS"))).toBe(true);
    expect(source).not.toMatch(/\.scale|setScalar|multiplyScalar/);
  });

  it("keeps scene side effects in the shared hook", () => {
    const meshSource = readSource("features/viewer/ModelMesh.tsx");
    const sceneSource = readSource("features/viewer/useModelScene.ts");
    expect(meshSource).toContain("<PlaybackRig root={scene} clips={animations} versionId={options.versionId} />");
    for (const name of ["applyMeshDisplay", "setModelSize", "requestFit", "setClips", "useModelScenesStore"]) {
      expect(meshSource).not.toContain(name);
    }
    for (const name of [
      "applyMeshDisplay(scene, meshDisplay,",
      'applyMeshDisplay(scene, "solid",',
      "setModelSize",
      "requestFit()",
      "register(versionId, scene)",
      "unregister(versionId, scene)",
    ]) {
      expect(sceneSource).toContain(name);
    }
    expect(sceneSource).toContain('from "../trail/model-clips"');
    expect(sceneSource).toContain("register(versionId, animations)");
    expect(sceneSource).toContain("unregister(versionId, animations)");
    expect(sceneSource).toContain("const { versionId, primary, meshDisplay } = options;");
    expect(sceneSource).not.toMatch(/useGLTF|useLoader|FBXLoader|OBJLoader/);
    expect(sceneSource).not.toContain("setClips");
    expect(sceneSource).not.toContain('from "../../store/playback"');
    expect(sceneSource).not.toContain('from "./playback"');
    expect(sceneSource).not.toContain('from "./playback-frames"');
    expect(sceneSource.match(/useEffect\(/g)).toHaveLength(5);
  });

  it("registers and unregisters clips through a mounted non-primary hook", async () => {
    const scene = new Object3D();
    const clips = [new AnimationClip("non-primary", 1)];
    const host = document.createElement("div");
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(createElement(SceneHarness, { scene, animations: clips, versionId: "v-non-primary" }));
      });
      expect(useModelClipsStore.getState().clips["v-non-primary"]).toBe(clips);

      await act(async () => {
        root.unmount();
      });
      expect(Object.hasOwn(useModelClipsStore.getState().clips, "v-non-primary")).toBe(false);
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("registers clips for non-primary mounts and conditionally unregisters them", async () => {
    const firstScene = new Object3D();
    const secondScene = new Object3D();
    const firstClips = [new AnimationClip("first", 1)];
    const secondClips = [new AnimationClip("second", 2)];
    const firstHost = document.createElement("div");
    const secondHost = document.createElement("div");
    const firstRoot = createRoot(firstHost);
    const secondRoot = createRoot(secondHost);

    try {
      await act(async () => {
        firstRoot.render(createElement(SceneHarness, { scene: firstScene, animations: firstClips, versionId: "v1" }));
      });
      expect(selectModelClips(useModelClipsStore.getState().clips, "v1")).toBe(firstClips);

      await act(async () => {
        secondRoot.render(createElement(SceneHarness, { scene: secondScene, animations: secondClips, versionId: "v1" }));
      });
      expect(selectModelClips(useModelClipsStore.getState().clips, "v1")).toBe(secondClips);

      await act(async () => {
        firstRoot.unmount();
      });
      expect(selectModelClips(useModelClipsStore.getState().clips, "v1")).toBe(secondClips);

      await act(async () => {
        secondRoot.unmount();
      });
      expect(selectModelClips(useModelClipsStore.getState().clips, "v1")).toBeNull();
    } finally {
      firstRoot.unmount();
      secondRoot.unmount();
      firstHost.remove();
      secondHost.remove();
    }
  });

  it("passes the filename from the canvas into the model dispatcher", () => {
    const source = readSource("features/viewer/ViewerCanvas.tsx");
    expect(source).toContain("fileName={version.fileName}");
    expect(source.match(/<ModelMesh/g)).toHaveLength(1);
  });

  it("installs the FBX skin compatibility before configuring the manager", () => {
    const source = readSource("features/viewer/ModelMesh.tsx");
    expect(source).toContain('from "./fbx-compat"');
    expect(source).toMatch(
      /function extendLoader\(loader: Loader\): void \{\s*installFbxSkinCompat\(\);\s*loader\.manager = createModelLoadingManager\(location\.origin\);/,
    );
  });
});
