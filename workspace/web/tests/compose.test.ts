import { describe, expect, it } from "vitest";
import { CreateCommentInput } from "@shared/api";
import { cameraEquals } from "@shared/camera";
import type { CameraState, Stroke, Vec3 } from "@shared/types";
import {
  CLICK_MOVE_THRESHOLD_PX,
  buildCommentInput,
  isClick,
  ownStrokesForComment,
} from "../src/features/comments/compose";

const camera: CameraState = { position: [1, 2, 3], target: [0, 0, 0] };
const anchor: Vec3 = [4, 5, 6];

function stroke(id: string, userId: string, createdAt: number): Stroke {
  return { id, userId, color: "#ff0000", points: [[0, 0, 0], [1, 1, 1]], createdAt };
}

describe("comment composition", () => {
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

  it("trims the body and preserves the requested metadata", () => {
    const input = buildCommentInput({
      versionId: "v1",
      authorName: "Rin",
      body: "  hi  ",
      anchor,
      camera,
      strokes: {},
      userId: null,
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
});
