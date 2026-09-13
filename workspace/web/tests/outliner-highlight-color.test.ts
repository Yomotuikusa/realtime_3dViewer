/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BoxGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import {
  applySelectionHighlight,
  createSelectionOverlay,
  isSelectionOverlay,
} from "../src/features/outliner/selection-highlight";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

describe("viewer overlay colors", () => {
  it("uses the requested color for mesh, line, and points overlays", () => {
    const color = 0xff0000;
    const mesh = createSelectionOverlay(
      new Mesh(new BoxGeometry(), new MeshStandardMaterial()),
      color,
    ) as Mesh;
    const line = createSelectionOverlay(
      new Line(new BoxGeometry(), new LineBasicMaterial()),
      color,
    ) as Line;
    const points = createSelectionOverlay(
      new Points(new BoxGeometry(), new PointsMaterial()),
      color,
    ) as Points;

    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(color);
    expect((line.material as LineBasicMaterial).color.getHex()).toBe(color);
    expect((points.material as PointsMaterial).color.getHex()).toBe(color);
  });

  it("uses one requested color for every descendant overlay", () => {
    const color = 0x00ff00;
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const line = new Line(new BoxGeometry(), new LineBasicMaterial());
    const points = new Points(new BoxGeometry(), new PointsMaterial());
    mesh.add(points);
    root.add(mesh, line);

    applySelectionHighlight(root, color);

    const overlays = [mesh, points, line].map((object) => object.children.find(isSelectionOverlay));
    expect(overlays).toHaveLength(3);
    for (const overlay of overlays) {
      expect(overlay).toBeDefined();
      const material = (overlay as Mesh | Line | Points).material as
        MeshBasicMaterial | LineBasicMaterial | PointsMaterial;
      expect(material.color.getHex()).toBe(color);
    }
  });

  it("subscribes SelectionRig to the theme selection color", () => {
    const source = readSource("features/outliner/SelectionRig.tsx");
    expect(source).toContain('useThemeStore(selectViewerColor("selection"))');
    expect(source).toContain("applySelectionHighlight(target, hexToNumber(color))");
    expect(source).toContain("}, [scene, selected, color]);");
  });

  it("recreates JointRig overlays when their theme colors change", () => {
    const source = readSource("features/joint/JointRig.tsx");
    expect(source).toContain('useThemeStore(selectViewerColor("joint"))');
    expect(source).toContain('useThemeStore(selectViewerColor("jointLink"))');
    expect(source).toContain('useThemeStore(selectViewerColor("jointSelected"))');
    expect(source).toContain("}, [scenes, jointDisplay.visible, jointColor, linkColor]);");
    expect(source).toContain("}, [scenes, jointDisplay.visible, selected, selectedColor]);");
    expect(source).toContain("hexToNumber(jointColor)");
    expect(source).toContain("hexToNumber(linkColor)");
    expect(source).toContain("hexToNumber(selectedColor)");
  });
});
