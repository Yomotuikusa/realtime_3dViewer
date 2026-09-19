/// <reference types="node" />

import { DoubleSide, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  COMPARE_INSIDE_COLOR,
  COMPARE_OUTSIDE_COLOR,
  DIFFERENCE_POLYGON_OFFSET,
  createDifferenceMaterials,
  setDifferenceColors,
} from "../src/features/compare/difference-material";
import { hexToNumber, VIEWER_COLOR_DEFAULTS } from "../src/features/theme/viewer-colors";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

describe("difference materials", () => {
  it("uses viewer defaults and creates two configured standard materials", () => {
    expect(COMPARE_OUTSIDE_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside));
    expect(COMPARE_INSIDE_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside));
    const materials = createDifferenceMaterials();

    expect(materials).toHaveLength(2);
    expect(materials[0]).toBeInstanceOf(MeshStandardMaterial);
    expect(materials[0]!.color.getHex()).toBe(COMPARE_OUTSIDE_COLOR);
    expect(materials[1]!.color.getHex()).toBe(COMPARE_INSIDE_COLOR);
    for (const material of materials) {
      expect(material.roughness).toBe(1);
      expect(material.metalness).toBe(0);
      expect(material.side).toBe(DoubleSide);
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.depthWrite).toBe(true);
      expect(material.polygonOffset).toBe(true);
      expect(material.polygonOffsetFactor).toBe(DIFFERENCE_POLYGON_OFFSET);
      expect(material.polygonOffsetUnits).toBe(DIFFERENCE_POLYGON_OFFSET);
    }
    expect(createDifferenceMaterials()[0]).not.toBe(materials[0]);
  });

  it("updates both colors and ignores an incomplete material list", () => {
    const materials = createDifferenceMaterials();
    setDifferenceColors(materials, { outside: 0xff0000, inside: 0x0000ff });
    expect(materials[0]!.color.getHex()).toBe(0xff0000);
    expect(materials[1]!.color.getHex()).toBe(0x0000ff);

    const single = createDifferenceMaterials()[0]!;
    expect(() => setDifferenceColors([single], { outside: 1, inside: 2 })).not.toThrow();
    expect(single.color.getHex()).toBe(COMPARE_OUTSIDE_COLOR);
  });

  it("keeps Rig theme color wiring explicit", () => {
    const source = readFileSync(join(sourceRoot, "features/compare/MeshCompareRig.tsx"), "utf8");
    expect(source).toContain('useThemeStore(selectViewerColor("compareOutside"))');
    expect(source).toContain('useThemeStore(selectViewerColor("compareInside"))');
    expect(source).toContain("hexToNumber(outsideColor)");
    expect(source).toContain("hexToNumber(insideColor)");
  });
});
