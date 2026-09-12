/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

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
    for (const name of ["applyMeshDisplay", "setModelSize", "requestFit", "setClips", "useModelScenesStore"]) {
      expect(meshSource).not.toContain(name);
    }
    for (const name of [
      "applyMeshDisplay(scene, meshDisplay)",
      'applyMeshDisplay(scene, "solid")',
      "setModelSize",
      "requestFit()",
      "setClips",
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
    expect(sceneSource.match(/useEffect\(/g)).toHaveLength(6);
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
