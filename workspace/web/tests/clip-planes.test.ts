/// <reference types="node" />

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAR_PLANE_RATIO,
  NEAR_PLANE_RATIO,
  clipPlanesFor,
} from "../src/features/viewer/clip-planes";

const sourceRoot = join(process.cwd(), "web", "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

describe("clip planes", () => {
  it("scales near and far from the model size", () => {
    expect(clipPlanesFor(1)).toEqual({ near: 0.01, far: 200 });
    expect(clipPlanesFor(1000)).toEqual({ near: 10, far: 200000 });
  });

  it("uses the default model size for invalid values", () => {
    for (const modelSize of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(clipPlanesFor(modelSize)).toEqual(clipPlanesFor(1));
    }
  });

  it("exposes the specified clipping ratios", () => {
    expect(NEAR_PLANE_RATIO).toBe(0.01);
    expect(FAR_PLANE_RATIO).toBe(200);
  });

  it("updates perspective camera clipping planes in a drawing-free rig", () => {
    const source = readSource("features/viewer/ClipPlanesRig.tsx");
    expect(source).toContain("clipPlanesFor(");
    expect(source).toContain("updateProjectionMatrix()");
    expect(source).toContain("useCameraStore((state) => state.modelSize)");
    expect(source).toContain("isPerspectiveCamera");
    expect(source).toContain("return null");
  });

  it("places the rig between focal length and Bounds", () => {
    const source = readSource("features/viewer/ViewerCanvas.tsx");
    expect(source.match(/<ClipPlanesRig\s*\/>/g)).toHaveLength(1);
    expect(source.indexOf("<FocalLengthRig />")).toBeLessThan(source.indexOf("<ClipPlanesRig />"));
    expect(source.indexOf("<ClipPlanesRig />")).toBeLessThan(source.indexOf("<Bounds"));
  });
});
