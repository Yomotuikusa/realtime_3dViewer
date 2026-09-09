import { describe, expect, it } from "vitest";
import {
  CommentSchema,
  FileNameSchema,
  IdSchema,
  MAX_AUTHOR_NAME_LENGTH,
  MAX_COMMENT_BODY_LENGTH,
  MAX_FILE_NAME_LENGTH,
  MAX_ID_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  ModelVersionSchema,
  ProjectSchema,
  StrokeSchema,
} from "../src/types";
import { CreateCommentInput } from "../src/api";

const camera = { position: [1, 2, 3], target: [0, 0, 0] };
const stroke = {
  id: "stroke-1",
  userId: "user-1",
  color: "#ff8800",
  points: [[0, 0, 0], [1, 1, 1]],
  createdAt: 1_700_000_000_000,
};
const comment = {
  id: "comment-1",
  projectId: "project-1",
  versionId: "version-1",
  authorName: "Alice",
  body: "Please review this edge.",
  anchor: [0, 0, 0],
  camera,
  strokes: [],
  status: "open",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_001,
};
const modelVersion = {
  id: "version-1",
  projectId: "project-1",
  number: 1,
  fileName: "model.glb",
  byteSize: 0,
  createdAt: 1_700_000_000_000,
};

describe("identifier and free-string bounds", () => {
  it("accepts nanoid characters and enforces the identifier length", () => {
    expect(IdSchema.safeParse("abcDEF012_-").success).toBe(true);
    expect(IdSchema.safeParse("a".repeat(MAX_ID_LENGTH)).success).toBe(true);
    expect(IdSchema.safeParse("a".repeat(MAX_ID_LENGTH + 1)).success).toBe(false);
  });

  it("rejects empty, spaced, and path-like identifiers", () => {
    for (const value of ["", "a b", "a/b", "../x"]) {
      expect(IdSchema.safeParse(value).success).toBe(false);
    }
  });

  it("applies identifier bounds to strokes and comments", () => {
    expect(StrokeSchema.safeParse(stroke).success).toBe(true);
    expect(StrokeSchema.safeParse({ ...stroke, id: "a".repeat(65) }).success).toBe(false);
    expect(StrokeSchema.safeParse({ ...stroke, userId: "a".repeat(65) }).success).toBe(false);
    expect(CommentSchema.safeParse(comment).success).toBe(true);
    expect(CommentSchema.safeParse({ ...comment, id: "a".repeat(65) }).success).toBe(false);
    expect(CommentSchema.safeParse({ ...comment, projectId: "a".repeat(65) }).success).toBe(false);
    expect(CommentSchema.safeParse({ ...comment, versionId: "a".repeat(65) }).success).toBe(false);
    expect(CommentSchema.safeParse({ ...comment, authorName: "a".repeat(MAX_AUTHOR_NAME_LENGTH) }).success).toBe(true);
    expect(CommentSchema.safeParse({ ...comment, authorName: "a".repeat(MAX_AUTHOR_NAME_LENGTH + 1) }).success).toBe(false);
    expect(CommentSchema.safeParse({ ...comment, body: "a".repeat(MAX_COMMENT_BODY_LENGTH) }).success).toBe(true);
    expect(CommentSchema.safeParse({ ...comment, body: "a".repeat(MAX_COMMENT_BODY_LENGTH + 1) }).success).toBe(false);
  });

  it("bounds file names without restricting ordinary Unicode or spaces", () => {
    expect(FileNameSchema.safeParse("model.glb").success).toBe(true);
    expect(FileNameSchema.safeParse("日本語 モデル.gltf").success).toBe(true);
    expect(FileNameSchema.safeParse("a".repeat(MAX_FILE_NAME_LENGTH)).success).toBe(true);
    expect(FileNameSchema.safeParse("a".repeat(MAX_FILE_NAME_LENGTH + 1)).success).toBe(false);
    for (const value of ["a/b.glb", "a\\b.glb", "a\t.glb", "a\n.glb"]) {
      expect(FileNameSchema.safeParse(value).success).toBe(false);
    }
  });

  it("uses the bounded file name and project name schemas", () => {
    expect(ModelVersionSchema.safeParse({ ...modelVersion, fileName: "日本語 モデル.gltf" }).success).toBe(true);
    for (const fileName of ["a/b.glb", "a\\b.glb", "a\t.glb", "a\n.glb", "a".repeat(256)]) {
      expect(ModelVersionSchema.safeParse({ ...modelVersion, fileName }).success).toBe(false);
    }
    expect(ProjectSchema.safeParse({
      id: "project-1",
      name: "a".repeat(MAX_PROJECT_NAME_LENGTH),
      createdAt: 1_700_000_000_000,
      latestVersion: modelVersion,
    }).success).toBe(true);
    expect(ProjectSchema.safeParse({
      id: "project-1",
      name: "a".repeat(MAX_PROJECT_NAME_LENGTH + 1),
      createdAt: 1_700_000_000_000,
      latestVersion: modelVersion,
    }).success).toBe(false);
  });

  it("uses IdSchema for comment input version ids", () => {
    const input = {
      versionId: "version-1",
      authorName: "Alice",
      body: "Please review this edge.",
      anchor: [0, 0, 0],
      camera,
      strokes: [stroke],
    };
    expect(CreateCommentInput.safeParse(input).success).toBe(true);
    expect(CreateCommentInput.safeParse({ ...input, versionId: "v 1" }).success).toBe(false);
  });
});
