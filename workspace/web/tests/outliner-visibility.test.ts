/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from "three";
import { describe, expect, it } from "vitest";
import { VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";
import { applyPartVisibility } from "../src/features/outliner/visibility";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function createScene() {
  const root = new Group();
  const a = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const a1 = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const overlay = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const overlayChild = new Object3D();
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  overlay.add(overlayChild);
  a.add(overlay, a1);
  const b = new Group();
  const b0 = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  b.add(b0);
  root.add(a, b);
  return { root, a, a1, b, b0, overlay, overlayChild };
}

describe("outliner part visibility", () => {
  it("applies hidden paths to plain objects while preserving roots and overlays", () => {
    const scene = createScene();
    scene.root.visible = true;

    applyPartVisibility(scene.root, ["0"]);
    expect(scene.a.visible).toBe(false);
    expect(scene.a1.visible).toBe(true);
    expect(scene.b.visible).toBe(true);
    expect(scene.b0.visible).toBe(true);
    expect(scene.root.visible).toBe(true);
    expect(scene.overlay.visible).toBe(true);
    expect(scene.overlayChild.visible).toBe(true);

    applyPartVisibility(scene.root, ["0/0", "1"]);
    expect(scene.a.visible).toBe(true);
    expect(scene.a1.visible).toBe(false);
    expect(scene.b.visible).toBe(false);
    expect(scene.b0.visible).toBe(true);

    applyPartVisibility(scene.root, []);
    expect(scene.a.visible).toBe(true);
    expect(scene.a1.visible).toBe(true);
    expect(scene.b.visible).toBe(true);
    expect(scene.b0.visible).toBe(true);

    scene.overlay.visible = false;
    scene.root.visible = false;
    applyPartVisibility(scene.root, []);
    expect(scene.overlay.visible).toBe(false);
    expect(scene.root.visible).toBe(false);

    expect(() => applyPartVisibility(scene.root, ["9", "0/5"])).not.toThrow();
    expect(scene.a.visible).toBe(true);
    expect(scene.a1.visible).toBe(true);
    expect(scene.b.visible).toBe(true);
    expect(scene.b0.visible).toBe(true);

    const before = [scene.a.visible, scene.a1.visible, scene.b.visible, scene.b0.visible];
    applyPartVisibility(scene.root, ["9", "0/5"]);
    expect([scene.a.visible, scene.a1.visible, scene.b.visible, scene.b0.visible]).toEqual(before);
  });

  it("keeps the Rig subscribed to stores and out of the frame loop", () => {
    const rig = readSource("features/outliner/VisibilityRig.tsx");
    expect(rig).toContain("export function VisibilityRig(): null");
    expect(rig).toContain("useObjectsStore(");
    expect(rig).toContain("useModelScenesStore(");
    expect(rig).toContain("hiddenObjectPaths(");
    expect(rig).toContain("applyPartVisibility(");
    expect(rig).not.toContain("send");
    expect(rig).not.toContain("useFrame");

    const visibility = readSource("features/outliner/visibility.ts");
    expect(visibility).toContain('isViewerOverlay } from "../viewer/mesh-display"');
    expect(readSource("features/viewer/ModelMesh.tsx")).not.toContain("VisibilityRig");
    expect(readSource("features/viewer/ModelMesh.tsx")).not.toContain("applyPartVisibility");
    expect(readSource("features/viewer/mesh-display.ts")).not.toContain("VisibilityRig");
    expect(readSource("features/viewer/mesh-display.ts")).not.toContain("applyPartVisibility");
  });
});
