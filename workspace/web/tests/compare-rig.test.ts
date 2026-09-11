/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { thresholdWorld } from "../src/features/compare/MeshCompareRig";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

describe("mesh compare rig", () => {
  it("converts permille thresholds into world units", () => {
    expect(thresholdWorld(2, 5)).toBe(0.01);
    expect(thresholdWorld(10, 50)).toBe(0.5);
    expect(thresholdWorld(0, 5)).toBe(0);
  });

  it("connects compare settings and scenes without a frame loop", () => {
    const source = readSource("features/compare/MeshCompareRig.tsx");

    expect(source).toContain("useDisplayStore");
    expect(source).toContain("useModelScenesStore");
    expect(source).toContain("isMeshCompareActive(");
    expect(source).toContain("computeDeviation(");
    expect(source).toContain("clearCompareOverlays(");
    expect(source).toContain("applyCompareOverlay(");
    expect(source).not.toContain("useFrame");
  });

  it("recomputes only when the selected scenes change", () => {
    const source = readSource("features/compare/MeshCompareRig.tsx");
    const calculationEffect = source.match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[base, target\]\);/);

    expect(calculationEffect?.[1]).toContain("computeDeviation(target, base)");
    expect(calculationEffect?.[1]).not.toContain("thresholdPermille");
    expect(source).toContain("}, [base, target]);");
    expect(source).toContain("}, [result, compare.thresholdPermille]);");
  });
});
