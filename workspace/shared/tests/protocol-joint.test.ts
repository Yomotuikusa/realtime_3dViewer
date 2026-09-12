import { describe, expect, it } from "vitest";
import {
  ClientMessageSchema,
  parseClientMessage,
  parseServerMessage,
  ServerMessageSchema,
} from "../src/protocol";

const display = { visible: true, xray: false };

describe("joint display protocol", () => {
  it("validates client and server joint display messages", () => {
    expect(ClientMessageSchema.safeParse({ type: "joint:display", display }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "joint:display" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "joint:display", display: { visible: true } }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "joint:display", display: { visible: 1, xray: true } }).success).toBe(false);

    expect(ServerMessageSchema.safeParse({ type: "joint:display", userId: "user-1", display: { visible: true, xray: true } }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "joint:display", display }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "joint:display", userId: "", display }).success).toBe(false);
  });

  it("validates optional welcome joint display state", () => {
    const withDisplay = ServerMessageSchema.safeParse({
      type: "welcome", selfId: "user-1", users: [], strokes: [], jointDisplay: display,
    });
    expect(withDisplay.success).toBe(true);
    if (withDisplay.success && withDisplay.data.type === "welcome") {
      expect(withDisplay.data.jointDisplay).toEqual(display);
    }

    const withoutDisplay = ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [] });
    expect(withoutDisplay.success).toBe(true);
    if (withoutDisplay.success) expect("jointDisplay" in withoutDisplay.data).toBe(false);
    expect(ServerMessageSchema.safeParse({
      type: "welcome", selfId: "user-1", users: [], strokes: [], jointDisplay: { visible: true },
    }).success).toBe(false);
  });

  it("parses client and server joint display frames", () => {
    expect(parseClientMessage(JSON.stringify({ type: "joint:display", display: { visible: true, xray: true } }))).toEqual({
      ok: true,
      msg: { type: "joint:display", display: { visible: true, xray: true } },
    });
    expect(parseServerMessage(JSON.stringify({
      type: "joint:display", userId: "user-1", display,
    }))).toEqual({
      ok: true,
      msg: { type: "joint:display", userId: "user-1", display },
    });
  });
});
