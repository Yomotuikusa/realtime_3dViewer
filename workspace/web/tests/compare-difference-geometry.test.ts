import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import { describe, expect, it } from "vitest";
import {
  buildDifferenceGeometry,
  DIFFERENCE_INSIDE_MATERIAL,
  DIFFERENCE_OUTSIDE_MATERIAL,
} from "../src/features/compare/difference-geometry";

function tri(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  return geometry;
}

function groups(geometry: BufferGeometry): number[][] {
  return geometry.groups.map(({ start, count, materialIndex }) => [start, count, materialIndex ?? 0]);
}

function values(geometry: BufferGeometry, name = "position"): number[] {
  return Array.from(geometry.getAttribute(name).array as ArrayLike<number>);
}

describe("buildDifferenceGeometry", () => {
  it("expands indexed outside geometry and preserves source normals", () => {
    const source = new BoxGeometry();
    const result = buildDifferenceGeometry(source, new Float32Array(24).fill(1), 0.5);
    const position = source.getAttribute("position");
    const normal = source.getAttribute("normal");
    const index = source.getIndex()!;
    const expectedPosition: number[] = [];
    const expectedNormal: number[] = [];
    for (let i = 0; i < index.count; i += 1) {
      const vertex = index.getX(i);
      expectedPosition.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
      expectedNormal.push(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
    }
    expect(result.getIndex()).toBeNull();
    expect(result.getAttribute("position").count).toBe(36);
    expect(values(result)).toEqual(expectedPosition);
    expect(values(result, "normal")).toEqual(expectedNormal);
    expect(groups(result)).toEqual([[0, 36, DIFFERENCE_OUTSIDE_MATERIAL], [36, 0, DIFFERENCE_INSIDE_MATERIAL]]);
    expect(result.getAttribute("position")).toBeInstanceOf(Float32BufferAttribute);
    expect(result.getAttribute("normal")).toBeInstanceOf(Float32BufferAttribute);
    expect(result.getAttribute("position").itemSize).toBe(3);
    expect(result.getAttribute("normal").itemSize).toBe(3);
  });

  it("orders inside patches after outside patches and handles empty regions", () => {
    const source = tri();
    expect(groups(buildDifferenceGeometry(source, [-1, -1, -1], 0.5))).toEqual([[0, 0, 0], [0, 3, 1]]);
    const empty = buildDifferenceGeometry(new BoxGeometry(), new Float32Array(24), 0.5);
    expect(empty.getAttribute("position").count).toBe(0);
    expect(groups(empty)).toEqual([[0, 0, 0], [0, 0, 1]]);
    const equal = buildDifferenceGeometry(new BoxGeometry(), new Float32Array(24).fill(1), 1);
    expect(equal.getAttribute("position").count).toBe(36);
    expect(equal.groups[0]).toMatchObject({ start: 0, count: 36, materialIndex: 0 });
  });

  it("clips positions and computes normals for an unindexed triangle", () => {
    const outside = buildDifferenceGeometry(tri(), [1, 0, 0], 0.5);
    expect(values(outside)).toEqual([0, 0, 0, 0.5, 0, 0, 0, 0.5, 0]);
    expect(values(outside, "normal")).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(groups(outside)).toEqual([[0, 3, 0], [3, 0, 1]]);

    const split = buildDifferenceGeometry(tri(), [1, 1, 0], 0.5);
    expect(values(split)).toEqual([0, 0, 0, 1, 0, 0, 0.5, 0.5, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0.5, 0]);
    const both = buildDifferenceGeometry(tri(), [1, -1, 0], 0.5);
    expect(values(both)).toEqual([0, 0, 0, 0.25, 0, 0, 0, 0.5, 0, 1, 0, 0, 0.5, 0.5, 0, 0.75, 0, 0]);
    expect(groups(both)).toEqual([[0, 3, 0], [3, 3, 1]]);
  });

  it("treats invalid distances as zero and handles short arrays", () => {
    const infinity = buildDifferenceGeometry(tri(), [Infinity, 1, 1], 0.5);
    expect(infinity.getAttribute("position").count).toBe(6);
    expect(infinity.groups[0]).toMatchObject({ start: 0, count: 6, materialIndex: 0 });
    expect(buildDifferenceGeometry(tri(), [NaN, NaN, NaN], 0.5).getAttribute("position").count).toBe(0);
    expect(buildDifferenceGeometry(tri(), [1], 0.5).getAttribute("position").count).toBe(3);
  });

  it("normalizes source normals and preserves complete skin attributes", () => {
    const source = tri();
    source.setAttribute("normal", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
    const result = buildDifferenceGeometry(source, [1, 0, 0], 0.5);
    expect(values(result, "normal").slice(0, 3)).toEqual([1, 0, 0]);
    expect(values(result, "normal").slice(3, 6)).toEqual([expect.closeTo(Math.SQRT1_2, 4), expect.closeTo(Math.SQRT1_2, 4), 0]);
    expect(values(result, "normal").slice(6, 9)).toEqual([expect.closeTo(Math.SQRT1_2, 4), 0, expect.closeTo(Math.SQRT1_2, 4)]);

    source.setAttribute("skinIndex", new Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0], 4));
    source.setAttribute("skinWeight", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const late = buildDifferenceGeometry(source, [1, 0, 0], 0.25);
    const early = buildDifferenceGeometry(source, [1, 0, 0], 0.75);
    expect(values(late, "skinIndex").filter((_, index) => index % 4 === 0)).toEqual([0, 1, 2]);
    expect(values(early, "skinIndex").filter((_, index) => index % 4 === 0)).toEqual([0, 0, 0]);
    expect(late.getAttribute("skinIndex")).toBeInstanceOf(Float32BufferAttribute);
    expect(late.getAttribute("skinIndex").itemSize).toBe(4);
    const onlyIndex = tri();
    onlyIndex.setAttribute("skinIndex", source.getAttribute("skinIndex"));
    expect(buildDifferenceGeometry(onlyIndex, [1, 0, 0], 0.25).getAttribute("skinIndex")).toBeUndefined();
  });

  it("copies and interpolates position morph targets only", () => {
    const source = tri();
    source.morphAttributes.position = [new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)];
    source.morphTargetsRelative = true;
    const result = buildDifferenceGeometry(source, [1, 0, 0], 0.5);
    const morphs = result.morphAttributes.position!;
    expect(morphs).toHaveLength(1);
    expect(morphs[0]!.count).toBe(3);
    expect(Array.from(morphs[0]!.array as ArrayLike<number>)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(result.morphTargetsRelative).toBe(true);

    const box = new BoxGeometry();
    box.morphAttributes.position = [box.getAttribute("position").clone()];
    const boxResult = buildDifferenceGeometry(box, new Float32Array(24).fill(1), 0.5);
    const boxMorphs = boxResult.morphAttributes.position!;
    expect(boxMorphs[0]!.count).toBe(36);
    expect(Array.from(boxMorphs[0]!.array as ArrayLike<number>)).toEqual(values(boxResult));
    source.setAttribute("uv", new Float32BufferAttribute(6, 2));
    expect(result.getAttribute("uv")).toBeUndefined();
  });

  it("creates an empty position attribute without touching the source", () => {
    const source = tri();
    const before = Array.from(source.getAttribute("position").array as ArrayLike<number>);
    const result = buildDifferenceGeometry(source, [1, 0, 0], 0.5);
    expect(result.getAttribute("position").array).not.toBe(source.getAttribute("position").array);
    expect(Array.from(source.getAttribute("position").array as ArrayLike<number>)).toEqual(before);
    const empty = buildDifferenceGeometry(new BufferGeometry(), [], 0.5);
    expect(empty.getAttribute("position").count).toBe(0);
    expect(groups(empty)).toEqual([[0, 0, 0], [0, 0, 1]]);
  });
});
