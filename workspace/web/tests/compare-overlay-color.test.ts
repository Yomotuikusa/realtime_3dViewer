/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BoxGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from "three";
import {
  applyCompareOverlay,
  colorizeDeviation,
  COMPARE_INSIDE_COLOR,
  COMPARE_OUTSIDE_COLOR,
  COMPARE_OVERLAY_OPACITY,
  createCompareOverlayGeometry,
} from "../src/features/compare/overlay";
import { hexToNumber, VIEWER_COLOR_DEFAULTS } from "../src/features/theme/viewer-colors";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function mesh(): Mesh {
  return new Mesh(new BoxGeometry(), new MeshStandardMaterial());
}

function rgba(meshGeometry: Mesh["geometry"], vertex: number): number[] {
  const color = meshGeometry.getAttribute("color") as Float32BufferAttribute;
  return [color.getX(vertex), color.getY(vertex), color.getZ(vertex), color.getW(vertex)];
}

function expectRgba(meshGeometry: Mesh["geometry"], vertex: number, expected: number[]): void {
  rgba(meshGeometry, vertex).forEach((value, component) => expect(value).toBeCloseTo(expected[component]!, 6));
}

describe("compare overlay colors", () => {
  it("derives comparison defaults from viewer color defaults", () => {
    expect(COMPARE_OUTSIDE_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside));
    expect(COMPARE_INSIDE_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside));
  });

  it("paints with supplied colors and preserves transparent vertices", () => {
    const geometry = createCompareOverlayGeometry(mesh());
    const colors = { outside: 0xff0000, inside: 0x00ff00 };

    colorizeDeviation(geometry, new Float32Array([1, -1, 0, 0.1]), 0.5, colors);

    expectRgba(geometry, 0, [1, 0, 0, COMPARE_OVERLAY_OPACITY]);
    expectRgba(geometry, 1, [0, 1, 0, COMPARE_OVERLAY_OPACITY]);
    expectRgba(geometry, 2, [0, 0, 0, 0]);
    expectRgba(geometry, 3, [0, 0, 0, 0]);
  });

  it("updates reused colors on every coloring call", () => {
    const geometry = createCompareOverlayGeometry(mesh());
    colorizeDeviation(geometry, new Float32Array([1]), 0.5, { outside: 0xff0000, inside: 0x00ff00 });
    colorizeDeviation(geometry, new Float32Array([1]), 0.5, { outside: 0x0000ff, inside: 0xffff00 });

    expectRgba(geometry, 0, [0, 0, 1, COMPARE_OVERLAY_OPACITY]);
  });

  it("passes colors through overlay creation and reuses the same mesh", () => {
    const source = mesh();
    const colors = { outside: 0xff0000, inside: 0x00ff00 };
    const first = applyCompareOverlay(source, new Float32Array(24).fill(1), 0.5, colors);
    const second = applyCompareOverlay(source, new Float32Array(24).fill(-1), 0.5, {
      outside: 0x0000ff,
      inside: 0xffff00,
    });

    expect(second).toBe(first);
    expectRgba(second.geometry, 0, [1, 1, 0, COMPARE_OVERLAY_OPACITY]);
    expect(source.children).toHaveLength(1);
  });

  it("subscribes compare colors without adding them to distance calculation", () => {
    const source = readSource("features/compare/MeshCompareRig.tsx");

    expect(source).toContain('useThemeStore(selectViewerColor("compareOutside"))');
    expect(source).toContain('useThemeStore(selectViewerColor("compareInside"))');
    expect(source).toContain("const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) }");
    expect(source).toContain("}, [result, compare.thresholdPermille, outsideColor, insideColor]);");
    expect(source).toContain("}, [base, target]);");
  });
});
