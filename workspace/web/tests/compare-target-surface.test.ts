import {
  BoxGeometry,
  Group,
  Layers,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { applyCompareDifference } from "../src/features/compare/difference-mesh";
import { setCompareSurfacesHidden } from "../src/features/compare/target-surface";

function box(): Mesh {
  return new Mesh(new BoxGeometry(), new MeshStandardMaterial());
}

function ray(): Raycaster {
  const result = new Raycaster();
  result.set(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
  return result;
}

describe("compare target surfaces", () => {
  it("hides and restores layer 0 for drawing and raycasting", () => {
    const first = box();
    const second = box();
    first.updateMatrixWorld(true);
    second.updateMatrixWorld(true);
    const raycaster = ray();

    setCompareSurfacesHidden([first, second], true);
    expect(first.layers.mask).toBe(0);
    expect(second.layers.mask).toBe(0);
    expect(first.layers.test(new Layers())).toBe(false);
    expect(raycaster.intersectObject(first)).toEqual([]);

    setCompareSurfacesHidden([first, second], false);
    expect(first.layers.mask).toBe(1);
    expect(second.layers.mask).toBe(1);
    expect(raycaster.intersectObject(first).length).toBeGreaterThan(0);
  });

  it("is safe for an empty list and already-visible surfaces", () => {
    const source = box();
    expect(() => setCompareSurfacesHidden([], true)).not.toThrow();
    expect(() => setCompareSurfacesHidden([source], false)).not.toThrow();
    expect(source.layers.mask).toBe(1);
  });

  it("is idempotent and preserves other layer bits", () => {
    const source = box();
    source.layers.enable(1);

    setCompareSurfacesHidden([source], true);
    setCompareSurfacesHidden([source], true);
    expect(source.layers.mask).toBe(2);

    setCompareSurfacesHidden([source], false);
    expect(source.layers.mask).toBe(3);
  });

  it("keeps overlay children visible while the parent is hidden", () => {
    const source = box();
    const overlay = applyCompareDifference(source, new Float32Array(24), 0.5, { outside: 1, inside: 2 });
    const root = new Group();
    root.add(source);
    root.updateMatrixWorld(true);
    const raycaster = ray();

    setCompareSurfacesHidden([source], true);
    expect(overlay.layers.mask).toBe(1);
    expect(raycaster.intersectObject(source, true)).toEqual([]);
  });
});
