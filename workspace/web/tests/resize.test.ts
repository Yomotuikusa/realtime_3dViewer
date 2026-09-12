import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  clampSize,
  LAYOUT_SIZE_SPECS,
  OUTLINER_WIDTH_DEFAULT_PX,
  OUTLINER_WIDTH_MIN_PX,
  outlinerWidthMax,
  panelWidthMax,
  resizeDragValue,
  resizeKeyValue,
} from "../src/features/layout/resize";

const sourceUrl = new URL("../src", import.meta.url);
const resolvedSourceRoot = sourceUrl.protocol === "file:"
  ? fileURLToPath(sourceUrl)
  : join(process.cwd(), sourceUrl.pathname.slice(1));
const sourceRoot = existsSync(resolvedSourceRoot) ? resolvedSourceRoot : join(process.cwd(), "web", "src");
const readSource = (path: string): string => readFileSync(join(sourceRoot, path), "utf8");

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

  it("exposes the outliner size and reserved-width limits", () => {
    expect(OUTLINER_WIDTH_MIN_PX).toBe(200);
    expect(OUTLINER_WIDTH_DEFAULT_PX).toBe(256);
    expect(LAYOUT_SIZE_SPECS.outlinerWidth).toEqual({ min: 200, max: Infinity, defaultValue: 256 });
    expect(panelWidthMax(1280, 256)).toBe(704);
    expect(panelWidthMax(700, 256)).toBe(256);
    expect(panelWidthMax(1280, Number.NaN)).toBe(960);
    expect(panelWidthMax(1280, -50)).toBe(960);
    expect(outlinerWidthMax(1280)).toBe(960);
    expect(outlinerWidthMax(1280, 352)).toBe(608);
    expect(outlinerWidthMax(500, 352)).toBe(200);
    expect(outlinerWidthMax(0)).toBe(200);
    expect(outlinerWidthMax(Number.NaN)).toBe(200);
    expect(outlinerWidthMax(1000.9, 352)).toBe(328);
  });

  it("supports start-side pointer and keyboard resizing", () => {
    const drag = { pointerId: 1, startClient: 800, startValue: 352 };
    expect(resizeDragValue(drag, 1, 700, 256, 960, "end")).toBe(452);
    expect(resizeDragValue(drag, 1, 700, 256, 960, "start")).toBe(256);
    expect(resizeDragValue(drag, 1, 900, 256, 960, "start")).toBe(452);
    expect(resizeDragValue(drag, 1, 2000, 256, 960, "start")).toBe(960);
    expect(resizeDragValue(null, 1, 900, 256, 960, "start")).toBeNull();
    expect(resizeDragValue(drag, 2, 900, 256, 960, "start")).toBeNull();
    expect(resizeKeyValue("ArrowRight", "x", 352, 256, 960, "start")).toBe(368);
    expect(resizeKeyValue("ArrowLeft", "x", 352, 256, 960, "start")).toBe(336);
    expect(resizeKeyValue("ArrowDown", "y", 32, 32, 240, "start")).toBe(48);
    expect(resizeKeyValue("ArrowUp", "y", 48, 32, 240, "start")).toBe(32);
    expect(resizeKeyValue("ArrowUp", "x", 352, 256, 960, "start")).toBeNull();
    expect(resizeKeyValue("Home", "x", 352, 256, 960, "start")).toBe(256);
    expect(resizeKeyValue("End", "x", 352, 256, 960, "start")).toBe(960);
    expect(resizeKeyValue("ArrowLeft", "x", 352, 256, 960, "end")).toBe(368);
  });

  it("wires the resize side through the shared handle", () => {
    const handle = readSource("features/layout/ResizeHandle.tsx");
    const page = readSource("app/ReviewPage.tsx");
    const timeline = readSource("features/timeline/PlaybackTimeline.tsx");
    expect(handle).toContain("data-side={side}");
    expect(handle).toContain("side?: ResizeSide");
    expect(handle).toMatch(/resizeDragValue\([\s\S]*?side,?\s*\)/);
    expect(handle).toMatch(/resizeKeyValue\([\s\S]*?side,?\s*\)/);
    expect(page).toContain('side="start"');
    expect(timeline).not.toContain('side="start"');
  });
});
