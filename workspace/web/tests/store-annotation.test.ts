import { beforeEach, describe, expect, it } from "vitest";
import type { Stroke, Vec3 } from "@shared/types";
import {
  DEFAULT_STROKE_COLOR,
  STROKE_COLORS,
  orderedStrokes,
  useAnnotationStore,
} from "../src/store/annotation";

const p1: Vec3 = [0, 0, 0];
const p2: Vec3 = [1, 1, 1];
const p3: Vec3 = [2, 2, 2];
const strokeA: Stroke = { id: "a", userId: "u1", color: "#ff0000", points: [p1, p2], createdAt: 1 };
const strokeB: Stroke = { id: "b", userId: "u2", color: "#00ff00", points: [p2, p3], createdAt: 2 };

beforeEach(() => {
  useAnnotationStore.getState().reset();
});

describe("annotation store", () => {
  it("starts with the documented initial state", () => {
    expect(useAnnotationStore.getState()).toMatchObject({
      strokes: {},
      mode: "none",
      color: DEFAULT_STROKE_COLOR,
      drafting: null,
      replayStrokes: [],
      overlay: true,
      placement: "surface",
    });
  });

  it("provides six distinct lowercase stroke colors", () => {
    expect(STROKE_COLORS).toHaveLength(6);
    expect(new Set(STROKE_COLORS).size).toBe(6);
    for (const color of STROKE_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("replaces strokes on welcome and upserts by id", () => {
    useAnnotationStore.getState().addStroke(strokeA);
    useAnnotationStore.getState().applyWelcome([strokeA, strokeB]);
    expect(useAnnotationStore.getState().strokes).toEqual({ a: strokeA, b: strokeB });

    const updated = { ...strokeA, color: "#ffffff" };
    useAnnotationStore.getState().addStroke(updated);
    expect(useAnnotationStore.getState().strokes).toEqual({ a: updated, b: strokeB });
  });

  it("removes known strokes and ignores unknown ids", () => {
    useAnnotationStore.getState().applyWelcome([strokeA]);
    useAnnotationStore.getState().removeStroke("nope");
    expect(useAnnotationStore.getState().strokes).toEqual({ a: strokeA });
    useAnnotationStore.getState().removeStroke("a");
    expect(useAnnotationStore.getState().strokes).toEqual({});
  });

  it("clears only strokes owned by the requested user", () => {
    const otherUserStroke = { ...strokeB, id: "c", userId: "u2" };
    useAnnotationStore.getState().applyWelcome([strokeA, { ...strokeA, id: "d" }, otherUserStroke]);
    useAnnotationStore.getState().clearByUser("u1");
    expect(useAnnotationStore.getState().strokes).toEqual({ c: otherUserStroke });
    useAnnotationStore.getState().clearByUser("nope");
    expect(useAnnotationStore.getState().strokes).toEqual({ c: otherUserStroke });
  });

  it("changes mode and clears a draft only when the mode changes", () => {
    useAnnotationStore.getState().beginDraft(p1);
    useAnnotationStore.getState().setMode("pen");
    expect(useAnnotationStore.getState().mode).toBe("pen");
    expect(useAnnotationStore.getState().drafting).toBeNull();
    useAnnotationStore.getState().beginDraft(p1);
    useAnnotationStore.getState().setMode("pen");
    expect(useAnnotationStore.getState().drafting).toEqual([p1]);
    useAnnotationStore.getState().setMode("comment");
    expect(useAnnotationStore.getState().drafting).toBeNull();
  });

  it("normalizes valid colors and ignores invalid colors", () => {
    useAnnotationStore.getState().setColor("#00FF00");
    expect(useAnnotationStore.getState().color).toBe("#00ff00");
    useAnnotationStore.getState().setColor("red");
    useAnnotationStore.getState().setColor("#12345");
    expect(useAnnotationStore.getState().color).toBe("#00ff00");
  });

  it("toggles overlay without changing other annotation state", () => {
    useAnnotationStore.getState().applyWelcome([strokeA]);
    useAnnotationStore.getState().setMode("pen");
    useAnnotationStore.getState().setColor("#ffffff");
    useAnnotationStore.getState().beginDraft(p1);
    useAnnotationStore.getState().setReplayStrokes([strokeB]);
    const before = useAnnotationStore.getState();

    useAnnotationStore.getState().setOverlay(false);
    expect(useAnnotationStore.getState()).toMatchObject({
      strokes: { a: strokeA },
      mode: "pen",
      color: "#ffffff",
      drafting: [p1],
      replayStrokes: [strokeB],
      overlay: false,
    });
    useAnnotationStore.getState().setOverlay(true);
    expect(useAnnotationStore.getState()).toMatchObject({
      strokes: { a: strokeA },
      mode: "pen",
      color: "#ffffff",
      drafting: [p1],
      replayStrokes: [strokeB],
      overlay: true,
    });
    expect(useAnnotationStore.getState().strokes).toEqual(before.strokes);
    expect(useAnnotationStore.getState().mode).toBe(before.mode);
    expect(useAnnotationStore.getState().color).toBe(before.color);
    expect(useAnnotationStore.getState().drafting).toEqual(before.drafting);
    expect(useAnnotationStore.getState().replayStrokes).toEqual(before.replayStrokes);
  });

  it("does not update the state object when overlay keeps the same value", () => {
    const before = useAnnotationStore.getState();
    useAnnotationStore.getState().setOverlay(true);
    expect(useAnnotationStore.getState()).toBe(before);
  });

  it("changes placement and clears a draft only when placement changes", () => {
    useAnnotationStore.getState().beginDraft(p1);
    const before = useAnnotationStore.getState();
    useAnnotationStore.getState().setPlacement("surface");
    expect(useAnnotationStore.getState()).toBe(before);
    expect(useAnnotationStore.getState().drafting).toEqual([p1]);

    useAnnotationStore.getState().setPlacement("space");
    expect(useAnnotationStore.getState().placement).toBe("space");
    expect(useAnnotationStore.getState().drafting).toBeNull();
  });

  it("changes only placement when no draft needs clearing", () => {
    useAnnotationStore.getState().applyWelcome([strokeA]);
    useAnnotationStore.getState().setMode("pen");
    useAnnotationStore.getState().setColor("#ffffff");
    useAnnotationStore.getState().setOverlay(false);
    useAnnotationStore.getState().setReplayStrokes([strokeB]);
    useAnnotationStore.getState().setPlacement("space");
    expect(useAnnotationStore.getState()).toMatchObject({
      strokes: { a: strokeA },
      mode: "pen",
      color: "#ffffff",
      drafting: null,
      replayStrokes: [strokeB],
      overlay: false,
      placement: "space",
    });
  });

  it("builds, appends, and ends drafts", () => {
    useAnnotationStore.getState().appendDraftPoint(p3);
    expect(useAnnotationStore.getState().drafting).toBeNull();
    useAnnotationStore.getState().beginDraft(p1);
    useAnnotationStore.getState().appendDraftPoint(p2);
    expect(useAnnotationStore.getState().drafting).toEqual([p1, p2]);
    expect(useAnnotationStore.getState().endDraft()).toEqual([p1, p2]);
    expect(useAnnotationStore.getState().drafting).toBeNull();
    expect(useAnnotationStore.getState().endDraft()).toEqual([]);
  });

  it("keeps replay strokes separate from live strokes", () => {
    useAnnotationStore.getState().addStroke(strokeA);
    useAnnotationStore.getState().setReplayStrokes([strokeB]);
    expect(useAnnotationStore.getState().replayStrokes).toEqual([strokeB]);
    expect(useAnnotationStore.getState().strokes).toEqual({ a: strokeA });
    useAnnotationStore.getState().setReplayStrokes([]);
    expect(useAnnotationStore.getState().replayStrokes).toEqual([]);
  });

  it("orders strokes by creation time and then id", () => {
    const strokes = {
      b: strokeB,
      a: strokeA,
      c: { ...strokeA, id: "c" },
    };
    expect(orderedStrokes(strokes).map((stroke) => stroke.id)).toEqual(["a", "c", "b"]);
  });

  it("resets all state to its initial values", () => {
    useAnnotationStore.getState().applyWelcome([strokeA]);
    useAnnotationStore.getState().setMode("comment");
    useAnnotationStore.getState().setColor("#ffffff");
    useAnnotationStore.getState().beginDraft(p1);
    useAnnotationStore.getState().setReplayStrokes([strokeB]);
    useAnnotationStore.getState().setOverlay(false);
    useAnnotationStore.getState().setPlacement("space");
    useAnnotationStore.getState().reset();
    expect(useAnnotationStore.getState()).toMatchObject({
      strokes: {},
      mode: "none",
      color: DEFAULT_STROKE_COLOR,
      drafting: null,
      replayStrokes: [],
      overlay: true,
      placement: "surface",
    });
  });
});
