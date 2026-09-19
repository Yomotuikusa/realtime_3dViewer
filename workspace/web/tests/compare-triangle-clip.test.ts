import { describe, expect, it } from "vitest";
import { clipTriangleAtOrAbove, type ClipTriangle } from "../src/features/compare/triangle-clip";

const v = (corner: 0 | 1 | 2) => ({ from: corner, to: corner, t: 0 });
const e = (from: 0 | 1 | 2, to: 0 | 1 | 2, t: number) => ({ from, to, t });

describe("clipTriangleAtOrAbove", () => {
  it("returns all or no triangles for uniform values", () => {
    expect(clipTriangleAtOrAbove([1, 1, 1], 0.5)).toEqual([[v(0), v(1), v(2)]]);
    expect(clipTriangleAtOrAbove([1, 1, 1], 1)).toEqual([[v(0), v(1), v(2)]]);
    expect(clipTriangleAtOrAbove([0, 0, 0], 0.5)).toEqual([]);
  });

  it("clips each one-above-vertex orientation", () => {
    expect(clipTriangleAtOrAbove([1, 0, 0], 0.5)).toEqual([[v(0), e(0, 1, 0.5), e(0, 2, 0.5)]]);
    expect(clipTriangleAtOrAbove([0, 1, 0], 0.5)).toEqual([[v(1), e(1, 2, 0.5), e(1, 0, 0.5)]]);
    expect(clipTriangleAtOrAbove([0, 0, 1], 0.25)).toEqual([[v(2), e(2, 0, 0.75), e(2, 1, 0.75)]]);
  });

  it("splits each two-above-vertex orientation into two triangles", () => {
    const cases: [readonly [number, number, number], number, ClipTriangle[]][] = [
      [[1, 1, 0], 0.5, [[v(0), v(1), e(1, 2, 0.5)], [v(0), e(1, 2, 0.5), e(0, 2, 0.5)]]],
      [[0, 1, 1], 0.25, [[v(1), v(2), e(2, 0, 0.75)], [v(1), e(2, 0, 0.75), e(1, 0, 0.75)]]],
      [[1, 0, 1], 0.5, [[v(2), v(0), e(0, 1, 0.5)], [v(2), e(0, 1, 0.5), e(2, 1, 0.5)]]],
    ];
    for (const [values, threshold, expected] of cases) expect(clipTriangleAtOrAbove(values, threshold)).toEqual(expected);
  });

  it("keeps equal vertices and computes bounded edge parameters", () => {
    const results = clipTriangleAtOrAbove([2, 0, 0], 2).concat(clipTriangleAtOrAbove([3, -1, -1], 1));
    expect(results).toEqual([
      [v(0), e(0, 1, 0), e(0, 2, 0)],
      [v(0), e(0, 1, 0.5), e(0, 2, 0.5)],
    ]);
    for (const triangle of results) {
      for (const point of triangle) expect(point.t).toBeGreaterThanOrEqual(0);
      for (const point of triangle) expect(point.t).toBeLessThan(1);
    }
  });
});
