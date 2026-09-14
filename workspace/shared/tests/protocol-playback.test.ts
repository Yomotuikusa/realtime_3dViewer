import { describe, expect, it } from "vitest";
import { ClientMessageSchema, ServerMessageSchema } from "../src/protocol";

describe("playback source protocol", () => {
  it("validates the client message and requires a non-empty versionId", () => {
    expect(ClientMessageSchema.safeParse({ type: "playback:source", versionId: "v1" }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "playback:source", versionId: "" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "playback:source" }).success).toBe(false);
  });

  it("validates the server relay and requires userId", () => {
    expect(ServerMessageSchema.safeParse({
      type: "playback:source", userId: "u1", versionId: "v1",
    }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "playback:source", versionId: "v1" }).success).toBe(false);
  });

  it("accepts welcome with or without playbackSource", () => {
    const base = { type: "welcome" as const, selfId: "u1", users: [], strokes: [] };
    expect(ServerMessageSchema.safeParse(base).success).toBe(true);
    const parsed = ServerMessageSchema.safeParse({ ...base, playbackSource: "v2" });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "welcome") expect(parsed.data.playbackSource).toBe("v2");
  });
});
