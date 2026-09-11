import { describe, expect, it } from "vitest";
import {
  frameAtX,
  frameToX,
  fpsOptions,
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
