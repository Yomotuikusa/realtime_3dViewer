import { describe, expect, it } from "vitest";
import { CreateCommentInput } from "@shared/api";
import { cameraEquals } from "@shared/camera";
import { MAX_COMMENT_STROKES } from "@shared/types";
import type { CameraState, Stroke, Vec3 } from "@shared/types";
import {
  CLICK_MOVE_THRESHOLD_PX,
  buildCommentInput,
  commentPlaybackOf,
  isClick,
  ownStrokesForComment,
} from "../src/features/comments/compose";

const camera: CameraState = { position: [1, 2, 3], target: [0, 0, 0] };
const anchor: Vec3 = [4, 5, 6];

function stroke(id: string, userId: string, createdAt: number): Stroke {
  return { id, userId, color: "#ff0000", points: [[0, 0, 0], [1, 1, 1]], createdAt };
}

describe("comment composition", () => {
  it("records the current playback frame only when enabled and clips exist", () => {
    const playback = { clips: [{ name: "a", duration: 2 }], clipIndex: 0, time: 0.5, fps: 24, sourceId: "v2" };
    expect(commentPlaybackOf(playback, true)).toEqual({ clipIndex: 0, frame: 12, versionId: "v2" });
    expect(commentPlaybackOf(playback, false)).toBeNull();
    expect(commentPlaybackOf({ ...playback, clips: [] }, true)).toBeNull();
    expect(commentPlaybackOf({ clips: [{ name: "a", duration: 2 }, { name: "b", duration: 4 }], clipIndex: 1, time: 1, fps: 30, sourceId: "v2" }, true))
      .toEqual({ clipIndex: 1, frame: 30, versionId: "v2" });
    expect(commentPlaybackOf({ ...playback, sourceId: null, time: 0.4999 }, true)).toEqual({ clipIndex: 0, frame: 12 });
  });

  it("uses a five-pixel inclusive click threshold", () => {
    expect(CLICK_MOVE_THRESHOLD_PX).toBe(5);
    expect(isClick({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
    expect(isClick({ x: 0, y: 0 }, { x: 3, y: 5 })).toBe(false);
  });

  it("returns only own strokes in ascending createdAt and id order", () => {
    const strokes = {
      a: stroke("a", "u1", 2),
      b: stroke("b", "u2", 1),
      c: stroke("c", "u1", 1),
    };
    expect(ownStrokesForComment(strokes, "u1").map((item) => item.id)).toEqual(["c", "a"]);
    expect(ownStrokesForComment(strokes, null)).toEqual([]);
  });

  it("keeps the newest 200 strokes while returning them in ascending order", () => {
    const strokes: Record<string, Stroke> = {};
    for (let index = 0; index < 250; index += 1) {
      strokes[`s${index}`] = stroke(`s${index}`, "u1", index);
    }
    const selected = ownStrokesForComment(strokes, "u1");
    expect(selected).toHaveLength(200);
    expect(selected[0]?.id).toBe("s50");
    expect(selected.at(-1)?.id).toBe("s249");
    expect(selected.every((item, index) => index === 0 || item.createdAt >= selected[index - 1]!.createdAt)).toBe(true);
  });

  it("uses the shared stroke limit at both boundaries", () => {
    const strokes: Record<string, Stroke> = {};
    for (let index = 0; index < MAX_COMMENT_STROKES + 1; index += 1) {
      strokes[`s${index}`] = stroke(`s${index}`, "u1", index);
    }
    expect(ownStrokesForComment(strokes, "u1")).toEqual(Object.values(strokes).slice(1));

    const atLimit = Object.fromEntries(
      Object.values(strokes).slice(0, MAX_COMMENT_STROKES).map((item) => [item.id, item]),
    );
    expect(ownStrokesForComment(atLimit, "u1")).toEqual(Object.values(atLimit));
  });

  it("trims the body and preserves the requested metadata", () => {
    const input = buildCommentInput({
      versionId: "v1",
      authorName: "Rin",
      body: "  hi  ",
      anchor,
      camera,
      strokes: {},
      userId: null,
      playback: { clipIndex: 0, frame: 7 },
    });
    expect(input).not.toBeNull();
    expect(input).toMatchObject({ versionId: "v1", authorName: "Rin", body: "hi" });
    expect(CreateCommentInput.safeParse(input).success).toBe(true);
  });

  it("rejects a body that becomes empty after trimming", () => {
    expect(buildCommentInput({
      versionId: "v1",
      authorName: "Rin",
      body: "   ",
      anchor,
      camera,
      strokes: {},
      userId: "u1",
      playback: null,
    })).toBeNull();
  });

  it("clones camera and anchor and includes the same own strokes", () => {
    const strokes = { own: stroke("own", "u1", 1), other: stroke("other", "u2", 2) };
    const input = buildCommentInput({
      versionId: "v1",
      authorName: "Rin",
      body: "comment",
      anchor,
      camera,
      strokes,
      userId: "u1",
      playback: null,
    });
    expect(input).not.toBeNull();
    expect(cameraEquals(input!.camera, camera)).toBe(true);
    expect(input!.camera).not.toBe(camera);
    expect(input!.camera.position).not.toBe(camera.position);
    expect(input!.camera.target).not.toBe(camera.target);
    expect(input!.anchor).toEqual(anchor);
    expect(input!.anchor).not.toBe(anchor);
    expect(input!.strokes).toEqual(ownStrokesForComment(strokes, "u1"));
    expect(CreateCommentInput.safeParse(input).success).toBe(true);
  });

  it("keeps playback in the input, including an explicit null", () => {
    const withPlayback = buildCommentInput({
      versionId: "v1",
      authorName: "Rin",
      body: "comment",
      anchor,
      camera,
      strokes: {},
      userId: null,
      playback: { clipIndex: 0, frame: 7 },
    });
    expect(withPlayback?.playback).toEqual({ clipIndex: 0, frame: 7 });
    expect(CreateCommentInput.safeParse(withPlayback).success).toBe(true);

    const withoutPlayback = buildCommentInput({
      versionId: "v1",
      authorName: "Rin",
      body: "comment",
      anchor,
      camera,
      strokes: {},
      userId: null,
      playback: null,
    });
    expect(withoutPlayback).toHaveProperty("playback", null);
    expect(CreateCommentInput.safeParse(withoutPlayback).success).toBe(true);
  });
});
