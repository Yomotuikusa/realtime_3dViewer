/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster } from "three";
import { pickSelection, versionOfObject } from "../src/features/outliner/pick-selection";
import { VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function createBox(): Mesh<BoxGeometry, MeshBasicMaterial> {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
}

function createSceneWithBox(z = 0): Group {
  const scene = new Group();
  const box = createBox();
  box.position.z = z;
  scene.add(box);
  return scene;
}

function createTarget(...scenes: Group[]): Group {
  const target = new Group();
  target.add(...scenes);
  target.updateMatrixWorld(true);
  return target;
}

describe("outliner 3D selection picking", () => {
  it("resolves an object and its scene root to a version", () => {
    const scene = createSceneWithBox();
    const child = scene.children[0]!;
    expect(versionOfObject({ v1: scene }, child)).toBe("v1");
    expect(versionOfObject({ v1: scene }, scene)).toBe("v1");
    expect(versionOfObject({ v1: scene }, createBox())).toBeNull();
  });

  it("returns the registered scene root rather than the hit mesh", () => {
    const scene = createSceneWithBox();
    const hit = pickSelection(new Raycaster(), createCamera(), { x: 0, y: 0 }, createTarget(scene), { v1: scene });
    expect(hit).toEqual({ versionId: "v1", objectId: scene.uuid });
  });

  it("returns null for an outside ray or missing target", () => {
    const scene = createSceneWithBox();
    const camera = createCamera();
    const target = createTarget(scene);
    expect(pickSelection(new Raycaster(), camera, { x: 0.99, y: 0.99 }, target, { v1: scene })).toBeNull();
    expect(pickSelection(new Raycaster(), camera, { x: 0, y: 0 }, null, { v1: scene })).toBeNull();
  });

  it("chooses the nearest registered version", () => {
    const v1 = createSceneWithBox();
    const v2 = createSceneWithBox(2);
    const target = createTarget(v1, v2);
    const hit = pickSelection(new Raycaster(), createCamera(), { x: 0, y: 0 }, target, { v1, v2 });
    expect(hit).toEqual({ versionId: "v2", objectId: v2.uuid });
  });

  it("skips a hidden version and uses the visible version behind it", () => {
    const v1 = createSceneWithBox();
    const v2 = createSceneWithBox(2);
    v2.visible = false;
    const target = createTarget(v1, v2);
    const hit = pickSelection(new Raycaster(), createCamera(), { x: 0, y: 0 }, target, { v1, v2 });
    expect(hit).toEqual({ versionId: "v1", objectId: v1.uuid });
  });

  it("ignores unregistered objects and viewer overlays", () => {
    const unregistered = createSceneWithBox();
    const target = createTarget(unregistered);
    expect(pickSelection(new Raycaster(), createCamera(), { x: 0, y: 0 }, target, {})).toBeNull();

    const overlay = createSceneWithBox();
    overlay.children[0]!.userData[VIEWER_OVERLAY_KEY] = true;
    expect(pickSelection(new Raycaster(), createCamera(), { x: 0, y: 0 }, createTarget(overlay), { v1: overlay })).toBeNull();
  });

  it("wires the Canvas click layer and ReviewPage placement", () => {
    const layer = readSource("features/outliner/SelectionPickLayer.tsx");
    expect(layer).toContain("pickSelection(");
    expect(layer).toContain("state.mode");
    expect(layer).toContain('mode !== "none"');
    expect(layer).toContain("isClick(");
    expect(layer).toContain("getModelTarget()");
    expect(layer).toContain("useModelScenesStore.getState().scenes");
    expect(layer).toContain(".select(");
    expect(layer).toContain(".clear()");
    expect(layer).toContain('addEventListener("pointerdown"');
    expect(layer).toContain('addEventListener("pointerup"');
    expect(layer).toContain('removeEventListener("pointerdown"');
    expect(layer).toContain('removeEventListener("pointerup"');
    expect(layer).toContain("event.altKey");

    const page = readSource("app/ReviewPage.tsx");
    expect(page).toContain('import { SelectionPickLayer } from "../features/outliner/SelectionPickLayer"');
    expect(page).toContain("<SelectionPickLayer />");
    expect(page.indexOf("<SelectionPickLayer />")).toBeGreaterThan(page.indexOf("<CommentPickLayer />"));
  });
});
