import { describe, expect, it } from "vitest";
import {
  intersectPlane,
  PARALLEL_EPSILON,
  type DrawPlane,
  type DrawRay,
  viewPlaneAt,
} from "../src/features/annotation/draw-plane";

const plane: DrawPlane = { origin: [0, 0, 0], normal: [0, 0, -1] };

describe("draw plane", () => {
  it("creates a unit plane normal toward the target", () => {
    expect(viewPlaneAt([0, 0, 5], [0, 0, 0])).toEqual({
      origin: [0, 0, 0],
      normal: [0, 0, -1],
    });
    expect(viewPlaneAt([0, 0, -5], [0, 0, 0])?.normal).toEqual([0, 0, 1]);
    const diagonal = viewPlaneAt([3, 3, 3], [0, 0, 0]);
    expect(diagonal?.normal[0]).toBeCloseTo(-1 / Math.sqrt(3));
    expect(diagonal?.normal[1]).toBeCloseTo(-1 / Math.sqrt(3));
    expect(diagonal?.normal[2]).toBeCloseTo(-1 / Math.sqrt(3));
    expect(viewPlaneAt([0, 0, 5], [1, 2, 3])?.origin).toEqual([1, 2, 3]);
  });

  it("returns null for a coincident camera and target", () => {
    expect(viewPlaneAt([1, 2, 3], [1, 2, 3])).toBeNull();
  });

  it("does not mutate inputs and returns new vectors", () => {
    const position: [number, number, number] = [0, 0, 5];
    const target: [number, number, number] = [0, 0, 0];
    const result = viewPlaneAt(position, target)!;
    expect(result.origin).not.toBe(target);
    expect(result.normal).not.toBe(position);
    expect(position).toEqual([0, 0, 5]);
    expect(target).toEqual([0, 0, 0]);

    const ray: DrawRay = { origin: [0, 0, 5], direction: [0, 0, -1] };
    const point = intersectPlane(ray, plane)!;
    expect(point).toEqual([0, 0, 0]);
    expect(point).not.toBe(ray.origin);
    expect(ray).toEqual({ origin: [0, 0, 5], direction: [0, 0, -1] });
  });

  it("intersects a forward ray and preserves its in-plane position", () => {
    expect(intersectPlane({ origin: [0, 0, 5], direction: [1 / Math.sqrt(2), 0, -1 / Math.sqrt(2)] }, plane))
      .toEqual([5, 0, 0]);
    expect(intersectPlane({ origin: [2, 3, 5], direction: [0, 0, -1] }, plane))
      .toEqual([2, 3, 0]);
    expect(intersectPlane({ origin: [0, 0, 5], direction: [0, 0, -1] }, {
      origin: [0, 0, 0],
      normal: [0, 0, 1],
    })).toEqual([0, 0, 0]);
  });

  it("rejects parallel, backward, and zero-distance intersections", () => {
    expect(intersectPlane({ origin: [0, 0, 5], direction: [1, 0, 0] }, plane)).toBeNull();
    expect(intersectPlane({
      origin: [0, 0, 5],
      direction: [1, 0, PARALLEL_EPSILON / 2],
    }, plane)).toBeNull();
    expect(intersectPlane({ origin: [0, 0, 5], direction: [0, 0, 1] }, plane)).toBeNull();
    expect(intersectPlane({ origin: [0, 0, 0], direction: [0, 0, -1] }, plane)).toBeNull();
  });
});
