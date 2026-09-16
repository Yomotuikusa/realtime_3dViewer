import { describe, expect, it } from "vitest";
import {
  TICK_LENGTH_RATIO,
  TICK_MIN_LENGTH_PX,
  tickLength,
  frameAtX,
  frameToX,
  fpsOptions,
  rulerTicks,
  tickFrames,
  timelineKeyFrame,
  timelineTicks,
} from "../src/features/timeline/timeline";

const width = 816;

describe("timeline calculations", () => {
  it("selects readable label and tick steps", () => {
    expect(timelineTicks(48, width)).toEqual({ labelStep: 5, tickStep: 1 });
    expect(timelineTicks(240, width)).toEqual({ labelStep: 20, tickStep: 2 });
    expect(timelineTicks(1000, width)).toEqual({ labelStep: 100, tickStep: 10 });
    expect(timelineTicks(10000, width)).toEqual({ labelStep: 1000, tickStep: 100 });
    expect(timelineTicks(24, 216)).toEqual({ labelStep: 10, tickStep: 1 });
    expect(timelineTicks(10, width)).toEqual({ labelStep: 1, tickStep: 1 });
    expect(timelineTicks(1000000, width)).toEqual({ labelStep: 10000, tickStep: 10000 });
    expect(timelineTicks(0, width)).toEqual({ labelStep: 1, tickStep: 1 });
    expect(timelineTicks(48, 10)).toEqual({ labelStep: 1, tickStep: 1 });
    expect(timelineTicks(48, 16)).toEqual({ labelStep: 1, tickStep: 1 });
  });

  it("generates tick frames", () => {
    expect(tickFrames(48, 10)).toEqual([0, 10, 20, 30, 40]);
    expect(tickFrames(50, 10)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(tickFrames(0, 10)).toEqual([0]);
    expect(tickFrames(48, 0)).toEqual([0]);
    expect(tickFrames(-1, 10)).toEqual([0]);
  });

  it("classifies ruler ticks by label and accent intervals", () => {
    expect(rulerTicks(24, { labelStep: 10, tickStep: 1 })).toHaveLength(25);
    expect(rulerTicks(24, { labelStep: 10, tickStep: 1 }).filter(({ kind }) => kind === "label").map(({ frame }) => frame))
      .toEqual([0, 10, 20]);
    expect(rulerTicks(24, { labelStep: 10, tickStep: 1 }).filter(({ kind }) => kind === "accent").map(({ frame }) => frame))
      .toEqual([5, 15]);
    expect(rulerTicks(24, { labelStep: 10, tickStep: 1 }).filter(({ kind }) => kind === "minor").map(({ frame }) => frame))
      .toEqual([1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24]);
    expect(rulerTicks(240, { labelStep: 20, tickStep: 2 })).toHaveLength(121);
    expect(rulerTicks(240, { labelStep: 20, tickStep: 2 }).at(-1)).toEqual({ frame: 240, kind: "label" });
    expect(rulerTicks(240, { labelStep: 20, tickStep: 2 }).find(({ frame }) => frame === 10)?.kind).toBe("accent");
    expect(rulerTicks(240, { labelStep: 20, tickStep: 2 }).find(({ frame }) => frame === 2)?.kind).toBe("minor");
    expect(rulerTicks(10, { labelStep: 5, tickStep: 1 }).filter(({ kind }) => kind === "accent")).toEqual([]);
    expect(rulerTicks(4, { labelStep: 1, tickStep: 1 }).every(({ kind }) => kind === "label")).toBe(true);
    expect(rulerTicks(0, { labelStep: 1, tickStep: 1 })).toEqual([{ frame: 0, kind: "label" }]);
  });

  it("scales tick lengths from the ruler height", () => {
    expect(tickLength("label", 32)).toBe(13);
    expect(tickLength("accent", 32)).toBe(9);
    expect(tickLength("minor", 32)).toBe(3);
    expect(tickLength("label", 60)).toBeCloseTo(24.2);
    expect(tickLength("accent", 60)).toBeCloseTo(15.4);
    expect(tickLength("minor", 60)).toBeCloseTo(4.62);
    expect(tickLength("label", 240)).toBeCloseTo(123.2);
    expect(tickLength("accent", 240)).toBeCloseTo(78.4);
    expect(tickLength("minor", 240)).toBeCloseTo(23.52);
    expect(tickLength("label", 20)).toBe(4);
    expect(tickLength("accent", 20)).toBe(4);
    expect(tickLength("minor", 20)).toBe(3);
    expect(tickLength("label", 16)).toBe(0);
    expect(tickLength("minor", 10)).toBe(0);
    expect(tickLength("accent", Number.NaN)).toBe(0);
    expect(TICK_LENGTH_RATIO).toEqual({ label: 0.55, accent: 0.35, minor: 0.105 });
    expect(TICK_MIN_LENGTH_PX).toEqual({ label: 13, accent: 9, minor: 3 });
  });

  it("maps between frames and ruler coordinates", () => {
    expect(frameToX(0, 48, width)).toBe(8);
    expect(frameToX(24, 48, width)).toBe(408);
    expect(frameToX(48, 48, width)).toBe(808);
    expect(frameToX(5, 0, width)).toBe(8);
    expect(frameAtX(408, 48, width)).toBe(24);
    expect(frameAtX(8, 48, width)).toBe(0);
    expect(frameAtX(0, 48, width)).toBe(0);
    expect(frameAtX(-50, 48, width)).toBe(0);
    expect(frameAtX(808, 48, width)).toBe(48);
    expect(frameAtX(2000, 48, width)).toBe(48);
    expect(frameAtX(417, 48, width)).toBe(25);
    expect(frameAtX(416, 48, width)).toBe(24);
    expect(frameAtX(100, 0, width)).toBe(0);
    expect(frameAtX(100, 48, 16)).toBe(0);
  });

  it("handles keyboard frame movement and fps choices", () => {
    expect(timelineKeyFrame("ArrowRight", 10, 48)).toBe(11);
    expect(timelineKeyFrame("ArrowUp", 10, 48)).toBe(11);
    expect(timelineKeyFrame("ArrowLeft", 10, 48)).toBe(9);
    expect(timelineKeyFrame("ArrowDown", 10, 48)).toBe(9);
    expect(timelineKeyFrame("ArrowLeft", 0, 48)).toBe(0);
    expect(timelineKeyFrame("ArrowRight", 48, 48)).toBe(48);
    expect(timelineKeyFrame("Home", 30, 48)).toBe(0);
    expect(timelineKeyFrame("End", 30, 48)).toBe(48);
    expect(timelineKeyFrame("Enter", 30, 48)).toBeNull();
    expect(timelineKeyFrame(" ", 30, 48)).toBeNull();
    expect(fpsOptions(24)).toEqual([12, 15, 24, 25, 30, 48, 50, 60, 120]);
    expect(fpsOptions(24)).not.toBe(fpsOptions(24));
    expect(fpsOptions(29.97)).toEqual([12, 15, 24, 25, 29.97, 30, 48, 50, 60, 120]);
    expect(fpsOptions(240).at(-1)).toBe(240);
  });
});
