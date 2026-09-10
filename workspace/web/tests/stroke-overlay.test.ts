import { describe, expect, it } from "vitest";
import type { Stroke } from "@shared/types";
import {
  BASE_LINE_WIDTH,
  OVERLAY_LINE_WIDTH,
  OVERLAY_OPACITY_RATIO,
  strokeLineSpecs,
} from "../src/features/annotation/stroke-overlay";

const stroke: Stroke = {
  id: "s1",
  userId: "u1",
  color: "#ff0000",
  points: [[0, 0, 0], [1, 1, 1]],
  createdAt: 1,
};

describe("strokeLineSpecs", () => {
  it("builds the normal line and overlay line in draw order", () => {
    const specs = strokeLineSpecs(stroke, { opacity: 1, overlay: true });

    expect(specs).toHaveLength(2);
    expect(specs[0]).toEqual({
      key: "s1",
      points: stroke.points,
      color: "#ff0000",
      lineWidth: BASE_LINE_WIDTH,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      opacity: 1,
    });
    expect(specs[1]).toEqual({
      key: "s1:overlay",
      points: stroke.points,
      color: "#ff0000",
      lineWidth: OVERLAY_LINE_WIDTH,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: OVERLAY_OPACITY_RATIO,
    });
    expect(specs[0]!.key).not.toBe(specs[1]!.key);
  });

  it("keeps only the unchanged normal line when overlay is disabled", () => {
    const specs = strokeLineSpecs(stroke, { opacity: 1, overlay: false });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toEqual({
      key: "s1",
      points: stroke.points,
      color: "#ff0000",
      lineWidth: BASE_LINE_WIDTH,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      opacity: 1,
    });
  });

  it("uses the source opacity for the normal line and scales the overlay", () => {
    const specs = strokeLineSpecs(stroke, { opacity: 0.6, overlay: true });

    expect(specs[0]!.opacity).toBe(0.6);
    expect(specs[0]!.transparent).toBe(true);
    expect(specs[1]!.opacity).toBeCloseTo(0.21);
  });

  it("does not mutate or replace stroke points", () => {
    const before = stroke.points;
    const specs = strokeLineSpecs(stroke, { opacity: 1, overlay: true });

    expect(stroke.points).toBe(before);
    expect(specs[0]!.points).toBe(before);
    expect(specs[1]!.points).toBe(before);
  });
});
