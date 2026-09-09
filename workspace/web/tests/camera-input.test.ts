import { describe, expect, it } from "vitest";
import {
  DOLLY_SPEED,
  MIN_DOLLY_DISTANCE,
  dollyPosition,
  MOUSE_BUTTONS_ALT,
  MOUSE_BUTTONS_IDLE,
  mouseButtonsFor,
} from "../src/features/viewer/camera-input";

describe("viewer camera input", () => {
  it("selects the Alt and idle OrbitControls assignments", () => {
    expect(mouseButtonsFor(true)).toBe(MOUSE_BUTTONS_ALT);
    expect(mouseButtonsFor(false)).toBe(MOUSE_BUTTONS_IDLE);
    expect(MOUSE_BUTTONS_ALT).toEqual({ LEFT: 0, MIDDLE: 2, RIGHT: undefined });
    expect(MOUSE_BUTTONS_IDLE).toEqual({ LEFT: undefined, MIDDLE: undefined, RIGHT: undefined });
  });

  it("dollies exponentially along the existing camera direction", () => {
    const position: [number, number, number] = [0, 0, 10];
    const target: [number, number, number] = [0, 0, 0];
    const zoomIn = dollyPosition(position, target, 100);
    const zoomOut = dollyPosition(position, target, -100);

    expect(zoomIn[0]).toBe(0);
    expect(zoomIn[1]).toBe(0);
    expect(zoomIn[2]).toBeCloseTo(10 * Math.exp(-DOLLY_SPEED * 100));
    expect(zoomOut[2]).toBeCloseTo(10 * Math.exp(DOLLY_SPEED * 100));
    expect(position).toEqual([0, 0, 10]);
    expect(target).toEqual([0, 0, 0]);
  });

  it("returns a fresh equal position for zero movement and coincident points", () => {
    const position: [number, number, number] = [1, 2, 3];
    const target: [number, number, number] = [1, 2, 3];
    const zeroDelta = dollyPosition(position, [0.1, 0.2, 0.3], 0);
    const coincident = dollyPosition(position, target, 100);

    expect(zeroDelta).toEqual(position);
    expect(zeroDelta).not.toBe(position);
    expect(coincident).toEqual(position);
    expect(coincident).not.toBe(position);
  });

  it("clamps the dolly distance to its minimum", () => {
    const result = dollyPosition([0, 0, 0.001], [0, 0, 0], 10000);

    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(MIN_DOLLY_DISTANCE);
  });
});
