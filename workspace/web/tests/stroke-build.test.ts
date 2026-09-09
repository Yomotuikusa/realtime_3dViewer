import { describe, expect, it } from "vitest";
import { StrokeSchema, type Stroke, type Vec3 } from "@shared/types";
import {
  NORMAL_OFFSET_RATIO,
  buildStroke,
  latestOwnStrokeId,
  offsetAlongNormal,
} from "../src/features/annotation/stroke-build";

const meta = {
  id: "stroke-1",
  userId: "user-1",
  color: "#ff0000",
  createdAt: 123,
  modelSize: 10,
};

describe("stroke building", () => {
  it("uses the documented normal offset and clones points without a normal", () => {
    expect(NORMAL_OFFSET_RATIO).toBe(0.002);
    expect(offsetAlongNormal([1, 1, 1], [0, 1, 0], 10)).toEqual([1, 1.02, 1]);
    const point: Vec3 = [1, 1, 1];
    const copied = offsetAlongNormal(point, null, 10);
    expect(copied).toEqual(point);
    expect(copied).not.toBe(point);
  });

  it("simplifies a stroke and preserves its metadata", () => {
    const points: Vec3[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0]];
    const stroke = buildStroke(points, meta);
    expect(stroke).toEqual({
      id: meta.id,
      userId: meta.userId,
      color: meta.color,
      createdAt: meta.createdAt,
      points: [[0, 0, 0], [4, 0, 0]],
    });
    expect(StrokeSchema.safeParse(stroke).success).toBe(true);
  });

  it("rejects one-point strokes but sends two-point strokes", () => {
    expect(buildStroke([[0, 0, 0]], meta)).toBeNull();
    const stroke = buildStroke([[0, 0, 0], [1, 0, 0]], meta);
    expect(stroke).not.toBeNull();
    expect(stroke!.points).toHaveLength(2);
  });

  it("finds the latest own stroke, breaking ties by id", () => {
    const strokes: Record<string, Stroke> = {
      a: { id: "a", userId: "u1", color: "#ff0000", points: [[0, 0, 0], [1, 0, 0]], createdAt: 1 },
      b: { id: "b", userId: "u1", color: "#ff0000", points: [[0, 0, 0], [1, 0, 0]], createdAt: 3 },
      c: { id: "c", userId: "u2", color: "#ff0000", points: [[0, 0, 0], [1, 0, 0]], createdAt: 5 },
    };
    expect(latestOwnStrokeId(strokes, "u1")).toBe("b");
    expect(latestOwnStrokeId({
      a: { ...strokes.a!, createdAt: 1 },
      b: { ...strokes.b!, createdAt: 1 },
    }, "u1")).toBe("b");
    expect(latestOwnStrokeId({ c: strokes.c! }, "u1")).toBeNull();
    expect(latestOwnStrokeId({}, "u1")).toBeNull();
  });
});
