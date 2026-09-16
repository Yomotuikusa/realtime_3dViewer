import { describe, expect, it } from "vitest";
import {
  isSendableStroke,
  SIMPLIFY_TOLERANCE_RATIO,
  simplify,
  simplifyTolerance,
} from "../src/stroke";
import { MAX_STROKE_POINTS, MIN_STROKE_POINTS } from "../src/types";
import type { Vec3 } from "../src/types";

describe("simplify", () => {
  it("returns a fresh copy for zero, one, and two points", () => {
    for (const points of [[], [[1, 2, 3]], [[1, 2, 3], [4, 5, 6]]] as Vec3[][]) {
      const result = simplify(points, 0.1);
      expect(result).toEqual(points);
      expect(result).not.toBe(points);
    }
  });

  it("reduces points on a straight line", () => {
    const points: Vec3[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0]];
    expect(simplify(points, 0.01)).toEqual([[0, 0, 0], [4, 0, 0]]);
  });

  it("keeps a bend above tolerance and removes it below tolerance", () => {
    const points: Vec3[] = [[0, 0, 0], [1, 1, 0], [2, 0, 0]];
    expect(simplify(points, 0.5)).toEqual(points);
    expect(simplify(points, 2)).toEqual([[0, 0, 0], [2, 0, 0]]);
  });

  it("does not simplify with zero or negative tolerance", () => {
    const points: Vec3[] = [[0, 0, 0], [1, 1, 0], [2, 0, 0]];
    expect(simplify(points, 0)).toEqual(points);
    expect(simplify(points, -1)).toEqual(points);
  });

  it("always preserves the original endpoints and handles 1000 points", () => {
    const points: Vec3[] = Array.from({ length: 1000 }, (_, index) => [index, Math.sin(index), index % 7]);
    const result = simplify(points, 0.1);
    expect(result.length).toBeLessThanOrEqual(points.length);
    expect(result[0]).toEqual(points[0]);
    expect(result.at(-1)).toEqual(points.at(-1));
  });

  it("uses model size to calculate tolerance", () => {
    expect(simplifyTolerance(10)).toBe(0.01);
  });

  it("uses the shared simplify tolerance ratio", () => {
    expect(SIMPLIFY_TOLERANCE_RATIO).toBe(0.001);
    expect(simplifyTolerance(10)).toBe(10 * SIMPLIFY_TOLERANCE_RATIO);
  });
});

describe("isSendableStroke", () => {
  it("accepts only 2 through 2000 points", () => {
    expect(isSendableStroke([[0, 0, 0]])).toBe(false);
    expect(isSendableStroke([[0, 0, 0], [1, 0, 0]])).toBe(true);
    const maximumStroke: Vec3[] = Array.from({ length: 2000 }, () => [0, 0, 0]);
    const oversizedStroke: Vec3[] = Array.from({ length: 2001 }, () => [0, 0, 0]);
    expect(isSendableStroke(maximumStroke)).toBe(true);
    expect(isSendableStroke(oversizedStroke)).toBe(false);
  });

  it("uses the shared point-count bounds", () => {
    expect(isSendableStroke(Array.from({ length: MIN_STROKE_POINTS - 1 }, () => [0, 0, 0]))).toBe(false);
    expect(isSendableStroke(Array.from({ length: MIN_STROKE_POINTS }, () => [0, 0, 0]))).toBe(true);
    expect(isSendableStroke(Array.from({ length: MAX_STROKE_POINTS }, () => [0, 0, 0]))).toBe(true);
    expect(isSendableStroke(Array.from({ length: MAX_STROKE_POINTS + 1 }, () => [0, 0, 0]))).toBe(false);
  });
});
