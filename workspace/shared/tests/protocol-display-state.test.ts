import { describe, expect, it } from "vitest";
import { DisplayStateFieldsSchema, ServerMessageSchema } from "../src/protocol";

describe("DisplayStateFieldsSchema", () => {
  it("accepts an empty object and strips unknown keys", () => {
    expect(DisplayStateFieldsSchema.safeParse({}).success).toBe(true);
    expect(DisplayStateFieldsSchema.parse({ unknown: true })).toEqual({});
  });

  it("uses the same validation as welcome fields", () => {
    expect(DisplayStateFieldsSchema.safeParse({ lightBrightness: 0.25 }).success).toBe(true);
    expect(DisplayStateFieldsSchema.safeParse({ lightBrightness: 0.24 }).success).toBe(false);
    expect(DisplayStateFieldsSchema.safeParse({ meshDisplay: "x" }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({
      type: "welcome", selfId: "u1", users: [], strokes: [], meshDisplay: "wireframe",
    }).success).toBe(true);
  });
});
