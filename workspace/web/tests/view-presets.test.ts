import { describe, expect, it } from "vitest";
import type { CameraState } from "@shared/types";
import { DEFAULT_CAMERA } from "@shared/camera";
import {
  MIN_PRESET_DISTANCE,
  PRESET_MATCH_EPSILON,
  matchViewPreset,
  presetCamera,
  rotationLocked,
  VIEW_CROSS_CENTER,
  VIEW_PRESET_CELLS,
  VIEW_PRESET_DIRECTIONS,
  VIEW_PRESET_ORDER,
} from "../src/features/viewer/view-presets";

const camera: CameraState = { position: [0, 0, 5], target: [0, 0, 0] };

describe("view presets", () => {
  it("keeps the current distance and target while moving to each direction", () => {
    expect(presetCamera("front", camera)).toEqual({ position: [0, 0, 5], target: [0, 0, 0] });
    expect(presetCamera("back", camera).position).toEqual([0, 0, -5]);
    expect(presetCamera("right", camera).position).toEqual([5, 0, 0]);
    expect(presetCamera("left", camera).position).toEqual([-5, 0, 0]);

    const offset = presetCamera("right", { position: [1, 2, 6], target: [1, 2, 3] });
    expect(offset.position[0]).toBeCloseTo(4, 10);
    expect(offset.position[1]).toBeCloseTo(2, 10);
    expect(offset.position[2]).toBeCloseTo(3, 10);
    expect(offset.target).toEqual([1, 2, 3]);
  });

  it("uses the current distance for the default camera", () => {
    const result = presetCamera("front", DEFAULT_CAMERA);
    expect(result.position[0]).toBeCloseTo(0, 10);
    expect(result.position[1]).toBeCloseTo(0, 10);
    expect(result.position[2]).toBeCloseTo(Math.sqrt(27), 10);
  });

  it("uses the minimum distance when position and target overlap", () => {
    const result = presetCamera("front", { position: [1, 2, 3], target: [1, 2, 3] });
    expect(result.position).toEqual([1, 2, 3 + MIN_PRESET_DISTANCE]);
  });

  it("returns independent values without mutating the current camera", () => {
    const current: CameraState = { position: [1, 2, 3], target: [4, 5, 6] };
    const before = { position: [...current.position], target: [...current.target] };
    const result = presetCamera("back", current);

    expect(result).not.toBe(current);
    expect(result.position).not.toBe(current.position);
    expect(result.target).not.toBe(current.target);
    expect(current).toEqual(before);
  });

  it("lists four horizontal unit directions in HUD order", () => {
    expect(VIEW_PRESET_ORDER).toEqual(["front", "right", "back", "left"]);
    for (const preset of VIEW_PRESET_ORDER) {
      const direction = VIEW_PRESET_DIRECTIONS[preset];
      expect(direction).toBeDefined();
      expect(Math.hypot(...direction)).toBeCloseTo(1, 10);
      expect(direction[1]).toBe(0);
    }
  });

  it("places the presets around the cross center", () => {
    expect(VIEW_CROSS_CENTER).toEqual({ row: 2, column: 2 });
    expect(VIEW_PRESET_CELLS).toEqual({
      front: { row: 1, column: 2 },
      right: { row: 2, column: 3 },
      back: { row: 3, column: 2 },
      left: { row: 2, column: 1 },
    });

    const cells = VIEW_PRESET_ORDER.map((preset) => VIEW_PRESET_CELLS[preset]);
    expect(new Set(cells.map(({ row, column }) => `${row},${column}`)).size).toBe(4);
    for (const { row, column } of cells) {
      expect(row === VIEW_CROSS_CENTER.row || column === VIEW_CROSS_CENTER.column).toBe(true);
      expect(Math.abs(row - VIEW_CROSS_CENTER.row) + Math.abs(column - VIEW_CROSS_CENTER.column)).toBe(1);
    }
  });

  it("preserves the distance for non-overlapping cameras", () => {
    const current: CameraState = { position: [4, -1, 2], target: [1, 2, 3] };
    const distance = Math.hypot(
      current.position[0] - current.target[0],
      current.position[1] - current.target[1],
      current.position[2] - current.target[2],
    );
    for (const preset of VIEW_PRESET_ORDER) {
      const result = presetCamera(preset, current);
      expect(Math.hypot(
        result.position[0] - result.target[0],
        result.position[1] - result.target[1],
        result.position[2] - result.target[2],
      )).toBeCloseTo(distance, 10);
      expect(result.target).toEqual(current.target);
    }
  });

  it("matches horizontal preset directions from any target", () => {
    expect(matchViewPreset({ position: [0, 0, 5], target: [0, 0, 0] })).toBe("front");
    expect(matchViewPreset({ position: [0, 0, -5], target: [0, 0, 0] })).toBe("back");
    expect(matchViewPreset({ position: [5, 0, 0], target: [0, 0, 0] })).toBe("right");
    expect(matchViewPreset({ position: [-5, 0, 0], target: [0, 0, 0] })).toBe("left");
    expect(matchViewPreset({ position: [4, 2, 3], target: [1, 2, 3] })).toBe("right");
  });

  it("matches every preset camera and does not mutate its argument", () => {
    const current: CameraState = { position: [4, -1, 2], target: [1, 2, 3] };
    const before = { position: [...current.position], target: [...current.target] };
    for (const preset of VIEW_PRESET_ORDER) {
      const candidate = presetCamera(preset, current);
      const candidateBefore = { position: [...candidate.position], target: [...candidate.target] };
      expect(matchViewPreset(candidate)).toBe(preset);
      expect(candidate).toEqual(candidateBefore);
    }
    expect(current).toEqual(before);
  });

  it("rejects non-horizontal, overlapping, and default camera directions", () => {
    expect(matchViewPreset(DEFAULT_CAMERA)).toBeNull();
    expect(matchViewPreset({ position: [0, 5, 0], target: [0, 0, 0] })).toBeNull();
    expect(matchViewPreset({ position: [0, 0.01, -5], target: [0, 0, 0] })).toBeNull();
    expect(matchViewPreset({ position: [1, 2, 3], target: [1, 2, 3] })).toBeNull();
  });

  it("accepts direction component differences within the matching epsilon", () => {
    const x = PRESET_MATCH_EPSILON / 10;
    expect(matchViewPreset({ position: [x, 0, 1], target: [0, 0, 0] })).toBe("front");
  });

  it("locks rotation only for an unfollowed preset direction", () => {
    const front: CameraState = { position: [0, 0, 5], target: [0, 0, 0] };
    expect(rotationLocked(front, false)).toBe(true);
    expect(rotationLocked(front, true)).toBe(false);
    expect(rotationLocked(DEFAULT_CAMERA, false)).toBe(false);
    expect(rotationLocked(DEFAULT_CAMERA, true)).toBe(false);
    expect(rotationLocked({ position: [1, 2, 3], target: [1, 2, 3] }, false)).toBe(false);
  });
});
