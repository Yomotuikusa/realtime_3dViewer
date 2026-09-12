import { describe, expect, it } from "vitest";
import {
  MAX_OBJECT_PATH_LENGTH,
  ObjectPartRefSchema,
  ObjectPathSchema,
  isSameObjectPart,
  joinObjectPath,
  objectPartKey,
  objectPathIndices,
} from "../src/index";

describe("ObjectPathSchema", () => {
  it("accepts valid child index paths and the exact length limit", () => {
    for (const path of ["0", "0/2/1", "12/0", "1".repeat(MAX_OBJECT_PATH_LENGTH)]) {
      expect(ObjectPathSchema.safeParse(path).success).toBe(true);
    }
  });

  it("rejects empty, malformed, and overlong paths", () => {
    for (const path of ["", "/0", "0/", "0//1", "a/1", "0/-1", "0 /1", "1".repeat(257)]) {
      expect(ObjectPathSchema.safeParse(path).success).toBe(false);
    }
  });
});

describe("ObjectPartRefSchema", () => {
  it("validates a part reference and strips extra keys", () => {
    const result = ObjectPartRefSchema.safeParse({ versionId: "v1", objectPath: "0/1", extra: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ versionId: "v1", objectPath: "0/1" });
  });

  it("rejects missing or invalid reference fields", () => {
    expect(ObjectPartRefSchema.safeParse({ versionId: "", objectPath: "0" }).success).toBe(false);
    expect(ObjectPartRefSchema.safeParse({ versionId: "v1", objectPath: "" }).success).toBe(false);
    expect(ObjectPartRefSchema.safeParse({ versionId: "v1" }).success).toBe(false);
  });
});

describe("object part helpers", () => {
  it("converts paths and indices in both directions", () => {
    expect(objectPathIndices("0/2/1")).toEqual([0, 2, 1]);
    expect(objectPathIndices("7")).toEqual([7]);
    expect(joinObjectPath([0, 2, 1])).toBe("0/2/1");
    expect(joinObjectPath([7])).toBe("7");
    expect(joinObjectPath(objectPathIndices("0/2/1"))).toBe("0/2/1");
    expect(() => joinObjectPath([])).toThrow("ObjectPath must not be empty");
  });

  it("creates keys and compares part references", () => {
    expect(objectPartKey({ versionId: "v1", objectPath: "0/1" })).toBe("v1:0/1");
    const part = { versionId: "v1", objectPath: "0/1" };
    expect(isSameObjectPart(part, { ...part })).toBe(true);
    expect(isSameObjectPart(part, { versionId: "v2", objectPath: "0/1" })).toBe(false);
    expect(isSameObjectPart(part, { versionId: "v1", objectPath: "0/2" })).toBe(false);
  });

  it("exports the path schema and key helper from the package index", () => {
    expect(typeof objectPartKey).toBe("function");
    expect(typeof ObjectPathSchema.safeParse).toBe("function");
  });

  it("exposes the maximum path length", () => {
    expect(MAX_OBJECT_PATH_LENGTH).toBe(256);
  });
});
