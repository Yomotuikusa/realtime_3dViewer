import { describe, expect, it } from "vitest";
import { ServerMessageSchema, parseServerMessage } from "../src/protocol";

describe("object:removed protocol", () => {
  it("accepts a valid removal message", () => {
    const message = { type: "object:removed", versionId: "version-1" };

    expect(ServerMessageSchema.safeParse(message).success).toBe(true);
    expect(parseServerMessage(JSON.stringify(message))).toEqual({
      ok: true,
      msg: message,
    });
  });

  it("rejects a missing or empty version id", () => {
    expect(ServerMessageSchema.safeParse({ type: "object:removed" }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "object:removed", versionId: "" }).success).toBe(false);
    expect(parseServerMessage(JSON.stringify({ type: "object:removed" })).ok).toBe(false);
    expect(parseServerMessage(JSON.stringify({ type: "object:removed", versionId: "" })).ok).toBe(false);
  });
});
