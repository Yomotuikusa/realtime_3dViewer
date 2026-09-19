/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  applyCompareOverlay,
  COMPARE_INSIDE_COLOR,
  COMPARE_OUTSIDE_COLOR,
  compareOverlayUniforms,
  createCompareOverlayMaterial,
  setCompareOverlayUniforms,
} from "../src/features/compare/overlay";
import { hexToNumber, VIEWER_COLOR_DEFAULTS } from "../src/features/theme/viewer-colors";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function mesh(): Mesh {
  return new Mesh(new BoxGeometry(), new MeshBasicMaterial());
}

describe("compare overlay colors", () => {
  it("derives comparison defaults from viewer color defaults", () => {
    expect(COMPARE_OUTSIDE_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside));
    expect(COMPARE_INSIDE_COLOR).toBe(hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside));
  });

  it("updates existing Color objects through uniforms", () => {
    const material = createCompareOverlayMaterial();
    const uniforms = compareOverlayUniforms(material)!;
    const outside = uniforms.compareOutside.value;
    expect(setCompareOverlayUniforms(material, 0.5, { outside: 0xff0000, inside: 0x00ff00 })).toBe(true);
    expect(uniforms.compareThreshold.value).toBe(0.5);
    expect(uniforms.compareOutside.value).toBe(outside);
    expect(uniforms.compareOutside.value.getHex()).toBe(0xff0000);
    expect(uniforms.compareInside.value.getHex()).toBe(0x00ff00);
    expect(setCompareOverlayUniforms(new MeshBasicMaterial(), 1, { outside: 1, inside: 2 })).toBe(false);
  });

  it("passes colors through overlay creation and updates reused uniforms", () => {
    const source = mesh();
    const first = applyCompareOverlay(source, new Float32Array(24).fill(1), 0.5, { outside: 0xff0000, inside: 0x00ff00 });
    const second = applyCompareOverlay(source, new Float32Array(24).fill(-1), 0.25, { outside: 0x0000ff, inside: 0xffff00 });
    const uniforms = compareOverlayUniforms(first.material as MeshBasicMaterial)!;
    expect(second).toBe(first);
    expect(uniforms.compareThreshold.value).toBe(0.25);
    expect(uniforms.compareOutside.value.getHex()).toBe(0x0000ff);
    expect(uniforms.compareInside.value.getHex()).toBe(0xffff00);
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
