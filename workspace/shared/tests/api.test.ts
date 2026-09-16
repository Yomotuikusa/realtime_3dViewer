import { describe, expect, it } from "vitest";
import {
  ALLOWED_MODEL_EXTENSIONS,
  ApiErrorSchema,
  CreateCommentInput,
  ErrorCode,
  ListCommentsQuery,
  MAX_UPLOAD_BYTES_DEFAULT,
  MODEL_CONTENT_TYPES,
  modelFormat,
  ProjectNameSchema,
  UpdateCommentStatusInput,
} from "../src/api";
import { MAX_COMMENT_STROKES } from "../src/types";

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

  it("accepts the shared maximum comment stroke count and rejects one more", () => {
    const maximumStrokes = Array.from({ length: MAX_COMMENT_STROKES }, () => stroke);
    expect(CreateCommentInput.safeParse({ ...validInput, strokes: maximumStrokes }).success).toBe(true);
    expect(CreateCommentInput.safeParse({
      ...validInput,
      strokes: [...maximumStrokes, stroke],
    }).success).toBe(false);
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
    expect(ALLOWED_MODEL_EXTENSIONS).toEqual([".glb", ".gltf", ".fbx", ".obj"]);
    expect(modelFormat("a.glb")).toBe("glb");
    expect(modelFormat("a.gltf")).toBe("gltf");
    expect(modelFormat("a.fbx")).toBe("fbx");
    expect(modelFormat("a.obj")).toBe("obj");
    expect(modelFormat("a.GLB")).toBe("glb");
    expect(modelFormat("A.Fbx")).toBe("fbx");
    expect(modelFormat("a.b.obj")).toBe("obj");
    for (const name of ["noext", ".glb", "a.glb.zip", "a.stl", "", "a."]) {
      expect(modelFormat(name)).toBeNull();
    }
    expect(Object.keys(MODEL_CONTENT_TYPES).sort()).toEqual(
      ALLOWED_MODEL_EXTENSIONS.map((extension) => extension.slice(1)).sort(),
    );
    expect(MODEL_CONTENT_TYPES.glb).toBe("model/gltf-binary");
    expect(MODEL_CONTENT_TYPES.gltf).toBe("model/gltf+json");
    expect(MODEL_CONTENT_TYPES.fbx).toBe("application/octet-stream");
    expect(MODEL_CONTENT_TYPES.obj).toBe("text/plain; charset=utf-8");
    expect(Object.values(ErrorCode)).toHaveLength(6);
  });
});
