/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MESH_COMPARE, type MeshCompare } from "@shared/types";
import { isHiddenByCompare } from "../src/features/compare/compare-visibility";

const srcDir = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

const active: MeshCompare = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };

describe("compare visibility", () => {
  it("hides only the active base while its target is visible", () => {
    expect(isHiddenByCompare(active, [], "v1")).toBe(true);
    expect(isHiddenByCompare(active, [], "v2")).toBe(false);
    expect(isHiddenByCompare(active, [], "v3")).toBe(false);
    expect(isHiddenByCompare({ ...active, baseVisible: true }, [], "v1")).toBe(false);
    expect(isHiddenByCompare({ ...active, baseVisible: false }, [], "v1")).toBe(true);
    expect(isHiddenByCompare(active, ["v2"], "v1")).toBe(false);
    expect(isHiddenByCompare(active, ["v1"], "v1")).toBe(true);
    expect(isHiddenByCompare({ ...active, targetId: null }, [], "v1")).toBe(false);
    expect(isHiddenByCompare({ ...active, targetId: "v1" }, [], "v1")).toBe(false);
    expect(isHiddenByCompare(DEFAULT_MESH_COMPARE, [], "v1")).toBe(false);
  });

  it("connects compare visibility to the canvas model visibility", () => {
    const canvas = readSource("features/viewer/ViewerCanvas.tsx");

    expect(canvas).toContain("useDisplayStore((state) => state.meshCompare)");
    expect(canvas).toContain("isObjectVisible(hiddenIds, version.id)");
    expect(canvas).toContain("!isHiddenByCompare(meshCompare, hiddenIds, version.id)");
    expect(canvas.match(/<ModelMesh\b/g)).toHaveLength(1);
  });

  it("adds the shared base visibility checkbox to compare controls", () => {
    const controls = readSource("features/objects/CompareControls.tsx");

    expect(controls.match(/type="checkbox"/g)).toHaveLength(1);
    expect(controls).toContain("checked={meshCompare.baseVisible === true}");
    expect(controls).toContain("baseVisible: event.target.checked");
    expect(controls.match(/<select\b/g)).toHaveLength(2);
    expect(controls.match(/type="range"/g)).toHaveLength(1);
    expect(controls.indexOf("compare__threshold")).toBeLessThan(controls.indexOf("compare__check"));
    expect(controls.indexOf("compare__check")).toBeLessThan(controls.indexOf("compare__legend"));
  });
});
