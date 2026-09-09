import { describe, expect, it } from "vitest";
import {
  ALLOWED_MODEL_EXTENSIONS,
  ApiErrorSchema,
  CreateCommentInput,
  ErrorCode,
  ListCommentsQuery,
  MAX_UPLOAD_BYTES_DEFAULT,
  ProjectNameSchema,
  UpdateCommentStatusInput,
} from "../src/api";

const camera = { position: [1, 2, 3], target: [0, 0, 0] };
const stroke = {
  id: "stroke-1",
  userId: "user-1",
  color: "#ff8800",
  points: [[0, 0, 0], [1, 1, 1]],
  createdAt: 1_700_000_000_000,
};
const validInput = {
  versionId: "version-1",
  authorName: " Alice ",
  body: " Please review this. ",
  anchor: [1, 2, 3],
  camera,
  strokes: [],
};

describe("REST schemas", () => {
  it("accepts a valid comment input with no strokes", () => {
    expect(CreateCommentInput.safeParse(validInput).success).toBe(true);
  });

  it("trims and bounds authorName", () => {
    expect(CreateCommentInput.safeParse({ ...validInput, authorName: "  " }).success).toBe(false);
    expect(CreateCommentInput.safeParse({ ...validInput, authorName: "a".repeat(51) }).success).toBe(false);
  });

  it("bounds the body and stroke count", () => {
    expect(CreateCommentInput.safeParse({ ...validInput, body: "a".repeat(2001) }).success).toBe(false);
    expect(CreateCommentInput.safeParse({ ...validInput, strokes: Array.from({ length: 201 }, () => stroke) }).success).toBe(false);
  });

  it("requires a three-component anchor", () => {
    expect(CreateCommentInput.safeParse({ ...validInput, anchor: [0, 0] }).success).toBe(false);
  });

  it("validates comment status inputs and optional list filters", () => {
    expect(UpdateCommentStatusInput.safeParse({ status: "resolved" }).success).toBe(true);
    expect(UpdateCommentStatusInput.safeParse({ status: "done" }).success).toBe(false);
    expect(ListCommentsQuery.safeParse({}).success).toBe(true);
    expect(ListCommentsQuery.safeParse({ status: "open" }).success).toBe(true);
    expect(ListCommentsQuery.safeParse({ status: "x" }).success).toBe(false);
  });

  it("validates API error codes", () => {
    expect(ApiErrorSchema.safeParse({ error: { code: "NOT_FOUND", message: "x" } }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: "UNKNOWN", message: "x" } }).success).toBe(false);
  });

  it("trims project names and exposes upload constants", () => {
    expect(ProjectNameSchema.parse("  abc  ")).toBe("abc");
    expect(MAX_UPLOAD_BYTES_DEFAULT).toBe(100 * 1024 * 1024);
    expect(ALLOWED_MODEL_EXTENSIONS).toEqual([".glb", ".gltf"]);
    expect(Object.values(ErrorCode)).toHaveLength(6);
  });
});
