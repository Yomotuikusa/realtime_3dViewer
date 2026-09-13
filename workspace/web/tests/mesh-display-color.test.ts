/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import {
  applyMeshDisplay,
  createWireframeOverlay,
  createWireframeOverlayMaterial,
  WIREFRAME_OVERLAY_COLOR,
} from "../src/features/viewer/mesh-display";
import { hexToNumber, VIEWER_COLOR_DEFAULTS } from "../src/features/theme/viewer-colors";
import { useModelScene } from "../src/features/viewer/useModelScene";
import { useThemeStore } from "../src/store/theme";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function overlayOf(mesh: Mesh): Mesh {
  return mesh.children.find((child): child is Mesh => child instanceof Mesh)!;
}

function SceneHarness({ scene }: { scene: Group }): null {
  useModelScene(scene, [], { versionId: "color-test", primary: false, meshDisplay: "solid-wireframe" });
  return null;
}

describe("viewer color wiring", () => {
  it("derives the wireframe default from viewer color defaults", () => {
    expect(WIREFRAME_OVERLAY_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.wireframe));
  });

  it("uses the default or explicit color for overlay materials and meshes", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    expect(createWireframeOverlayMaterial().color.getHex()).toBe(WIREFRAME_OVERLAY_COLOR);

    const customMaterial = createWireframeOverlayMaterial(0xff0000);
    expect(customMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(customMaterial.color.getHex()).toBe(0xff0000);
    expect((createWireframeOverlay(mesh).material as MeshBasicMaterial).color.getHex())
      .toBe(WIREFRAME_OVERLAY_COLOR);
    expect((createWireframeOverlay(mesh, 0xff0000).material as MeshBasicMaterial).color.getHex())
      .toBe(0xff0000);
  });

  it("passes an explicit color to solid-wireframe overlays", () => {
    const defaultRoot = new Group();
    const defaultMesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    defaultRoot.add(defaultMesh);
    applyMeshDisplay(defaultRoot, "solid-wireframe");
    expect((overlayOf(defaultMesh).material as MeshBasicMaterial).color.getHex()).toBe(WIREFRAME_OVERLAY_COLOR);

    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    root.add(mesh);

    applyMeshDisplay(root, "solid-wireframe", 0xff0000);

    expect((overlayOf(mesh).material as MeshBasicMaterial).color.getHex()).toBe(0xff0000);
    applyMeshDisplay(root, "solid-wireframe");
    expect((overlayOf(mesh).material as MeshBasicMaterial).color.getHex()).toBe(0xff0000);
  });

  it("subscribes the canvas and model scene to theme viewer colors", () => {
    const canvas = readSource("features/viewer/ViewerCanvas.tsx");
    const scene = readSource("features/viewer/useModelScene.ts");

    expect(canvas).toContain('useThemeStore(selectViewerColor("background"))');
    expect(canvas).toContain("<color attach=\"background\" args={[background]} />");
    expect(canvas).not.toContain('args={["#f5f7fa"]}');
    expect(scene).toContain('useThemeStore(selectViewerColor("wireframe"))');
    expect(scene).toContain("hexToNumber(wireframeColor)");
    expect(scene).toContain("[meshDisplay, scene, wireframeColor]");
    expect(scene).toContain('[scene, wireframeColor]');
  });

  it("rebuilds a solid-wireframe overlay when its theme color changes", async () => {
    const scene = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    scene.add(mesh);
    const host = document.createElement("div");
    const root = createRoot(host);
    const previousColors = useThemeStore.getState().colors;

    try {
      await act(async () => {
        useThemeStore.setState({ colors: { wireframe: "#ff0000" } });
        root.render(createElement(SceneHarness, { scene }));
      });
      expect((overlayOf(mesh).material as MeshBasicMaterial).color.getHex()).toBe(0xff0000);

      await act(async () => useThemeStore.setState({ colors: { wireframe: "#00ff00" } }));
      expect(mesh.children).toHaveLength(1);
      expect((overlayOf(mesh).material as MeshBasicMaterial).color.getHex()).toBe(0x00ff00);
    } finally {
      await act(async () => root.unmount());
      useThemeStore.setState({ colors: previousColors });
      host.remove();
    }
  });
});
