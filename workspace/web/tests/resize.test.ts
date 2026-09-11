import { describe, expect, it } from "vitest";
import {
  clampSize,
  LAYOUT_SIZE_SPECS,
  panelWidthMax,
  resizeDragValue,
  resizeKeyValue,
} from "../src/features/layout/resize";

describe("layout resize math", () => {
  it("clamps and rounds sizes, including invalid bounds and values", () => {
    expect(clampSize(300, 256, 400)).toBe(300);
    expect(clampSize(100, 256, 400)).toBe(256);
    expect(clampSize(900, 256, 400)).toBe(400);
    expect(clampSize(300.4, 256, 400)).toBe(300);
    expect(clampSize(300.6, 256, 400)).toBe(301);
    expect(clampSize(Number.NaN, 256, 400)).toBe(256);
    expect(clampSize(Number.POSITIVE_INFINITY, 256, 400)).toBe(400);
    expect(clampSize(300, 256, 100)).toBe(256);
  });

  it("calculates the panel limit from the body width", () => {
    expect(panelWidthMax(1280)).toBe(960);
    expect(panelWidthMax(500)).toBe(256);
    expect(panelWidthMax(0)).toBe(256);
    expect(panelWidthMax(Number.NaN)).toBe(256);
    expect(panelWidthMax(1000.9)).toBe(680);
  });

  it("exposes the panel and timeline size specifications", () => {
    expect(LAYOUT_SIZE_SPECS.panelWidth).toEqual({ min: 256, max: Infinity, defaultValue: 352 });
    expect(LAYOUT_SIZE_SPECS.timelineHeight).toEqual({ min: 32, max: 240, defaultValue: 32 });
  });

  it("converts pointer movement into a clamped resize value", () => {
    const drag = { pointerId: 1, startClient: 800, startValue: 352 };
    expect(resizeDragValue(null, 1, 100, 256, 960)).toBeNull();
    expect(resizeDragValue(drag, 2, 700, 256, 960)).toBeNull();
    expect(resizeDragValue(drag, 1, 700, 256, 960)).toBe(452);
    expect(resizeDragValue(drag, 1, 950, 256, 960)).toBe(256);
    expect(resizeDragValue(drag, 1, 0, 256, 960)).toBe(960);
  });

  it("maps axis-aware keyboard input to resize values", () => {
    expect(resizeKeyValue("ArrowLeft", "x", 352, 256, 960)).toBe(368);
    expect(resizeKeyValue("ArrowRight", "x", 352, 256, 960)).toBe(336);
    expect(resizeKeyValue("ArrowUp", "y", 32, 32, 240)).toBe(48);
    expect(resizeKeyValue("ArrowDown", "y", 32, 32, 240)).toBe(32);
    expect(resizeKeyValue("ArrowUp", "x", 352, 256, 960)).toBeNull();
    expect(resizeKeyValue("ArrowLeft", "y", 32, 32, 240)).toBeNull();
    expect(resizeKeyValue("Home", "x", 352, 256, 960)).toBe(256);
    expect(resizeKeyValue("End", "x", 352, 256, 960)).toBe(960);
    expect(resizeKeyValue("Enter", "x", 352, 256, 960)).toBeNull();
  });
});
