import { describe, expect, it } from "vitest";
import {
  CommentPlaybackSchema,
  CommentSchema,
  type CameraState,
  type Comment,
  type Vec3,
} from "../src/types";
import { CreateCommentInput } from "../src/api";
import { parseServerMessage } from "../src/protocol";

const camera: CameraState = { position: [1, 2, 3], target: [0, 0, 0] };
const comment = {
  id: "comment-1",
  projectId: "project-1",
  versionId: "version-1",
  authorName: "Alice",
  body: "Please review this.",
  anchor: [0, 0, 0] as Vec3,
  camera,
  strokes: [],
  status: "open" as const,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_001,
};

const createInput = {
  versionId: "version-1",
  authorName: "Alice",
  body: "Please review this.",
  anchor: [0, 0, 0] as Vec3,
  camera,
  strokes: [],
};

const commentWithoutPlayback: Comment = comment;
const commentWithNullPlayback: Comment = { ...commentWithoutPlayback, playback: null };
const commentWithPlayback: Comment = {
  ...commentWithoutPlayback,
  playback: { clipIndex: 0, frame: 0 },
};

describe("CommentPlaybackSchema", () => {
  it("accepts nonnegative integer clip indexes and frames", () => {
    expect(CommentPlaybackSchema.safeParse({ clipIndex: 0, frame: 0 }).success).toBe(true);
    const parsed = CommentPlaybackSchema.safeParse({ clipIndex: 2, frame: 120 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ clipIndex: 2, frame: 120 });
  });

  it("rejects negative and fractional positions", () => {
    for (const playback of [
      { clipIndex: -1, frame: 0 },
      { clipIndex: 0, frame: -1 },
      { clipIndex: 0.5, frame: 0 },
      { clipIndex: 0, frame: 1.5 },
    ]) {
      expect(CommentPlaybackSchema.safeParse(playback).success).toBe(false);
    }
  });

  it("requires both position fields and strips extra fields", () => {
    expect(CommentPlaybackSchema.safeParse({ clipIndex: 0 }).success).toBe(false);
    expect(CommentPlaybackSchema.safeParse({ frame: 0 }).success).toBe(false);
    const parsed = CommentPlaybackSchema.safeParse({ clipIndex: 0, frame: 0, extra: 1 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ clipIndex: 0, frame: 0 });
  });
});

describe("CommentSchema playback", () => {
  it("accepts an omitted playback and preserves its omitted key", () => {
    const parsed = CommentSchema.safeParse(comment);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("playback" in parsed.data).toBe(false);
  });

  it("accepts null and a valid playback position", () => {
    const nullPlayback = CommentSchema.safeParse(commentWithNullPlayback);
    expect(nullPlayback.success).toBe(true);
    if (nullPlayback.success) expect(nullPlayback.data.playback).toBe(null);

    const playback = { clipIndex: 1, frame: 30 };
    const withPlayback = CommentSchema.safeParse({ ...comment, playback });
    expect(withPlayback.success).toBe(true);
    if (withPlayback.success) expect(withPlayback.data.playback).toEqual(playback);
  });

  it("rejects an invalid playback position", () => {
    expect(CommentSchema.safeParse({ ...comment, playback: { clipIndex: -1, frame: 30 } }).success).toBe(false);
  });
});

describe("CreateCommentInput playback", () => {
  it("accepts omitted, null, and valid playback", () => {
    expect(CreateCommentInput.safeParse(createInput).success).toBe(true);
    expect(CreateCommentInput.safeParse({ ...createInput, playback: null }).success).toBe(true);
    expect(CreateCommentInput.safeParse({ ...createInput, playback: { clipIndex: 0, frame: 10 } }).success).toBe(true);
  });

  it("rejects a nonnumeric frame", () => {
    expect(CreateCommentInput.safeParse({ ...createInput, playback: { clipIndex: 0, frame: "10" } }).success).toBe(false);
  });
});

describe("comment playback protocol", () => {
  it("accepts playback on a created comment message", () => {
    const result = parseServerMessage(JSON.stringify({
      type: "comment:created",
      comment: { ...comment, playback: { clipIndex: 0, frame: 5 } },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.msg.type).toBe("comment:created");
      if (result.msg.type === "comment:created") {
        expect(result.msg.comment.playback).toEqual({ clipIndex: 0, frame: 5 });
      }
    }
  });
});
