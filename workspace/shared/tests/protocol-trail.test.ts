import { describe, expect, it } from "vitest";
import { ClientMessageSchema, parseClientMessage, parseServerMessage, ServerMessageSchema } from "../src/protocol";

const trail = { visible: true, target: { versionId: "v1", objectPath: "0/2" } };

describe("motion trail protocol", () => {
  it("accepts trail client and server messages and optional welcome state", () => {
    expect(ClientMessageSchema.safeParse({ type: "trail:display", trail }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "trail:display", userId: "u1", trail }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "trail:display", trail }).success).toBe(false);
    const welcome = ServerMessageSchema.safeParse({ type: "welcome", selfId: "u1", users: [], strokes: [] });
    expect(welcome.success).toBe(true);
    if (welcome.success && welcome.data.type === "welcome") expect(welcome.data.motionTrail).toBeUndefined();
  });

  it("parses a trail client frame with the same value", () => {
    expect(parseClientMessage(JSON.stringify({ type: "trail:display", trail: { visible: true, target: null } }))).toEqual({
      ok: true,
      msg: { type: "trail:display", trail: { visible: true, target: null } },
    });
    expect(parseServerMessage(JSON.stringify({ type: "trail:display", trail })).ok).toBe(false);
  });
});
