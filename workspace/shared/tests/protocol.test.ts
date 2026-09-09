import { describe, expect, it } from "vitest";
import {
  CAMERA_SEND_INTERVAL_MS,
  ClientMessageSchema,
  MAX_NAME_LENGTH,
  ServerMessageSchema,
  parseClientMessage,
  parseServerMessage,
} from "../src/protocol";

const camera = { position: [1, 2, 3], target: [0, 0, 0] };
const user = { id: "user-1", name: "Alice", color: "#ff8800", camera: null };
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
  body: "Review this.",
  anchor: [0, 0, 0],
  camera,
  strokes: [],
  status: "open",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_001,
};

describe("ClientMessageSchema", () => {
  it("accepts each client message shape", () => {
    const messages = [
      { type: "join", name: "" },
      { type: "camera", camera },
      { type: "stroke:add", stroke },
      { type: "stroke:remove", strokeId: "stroke-1" },
      { type: "stroke:clear" },
    ];
    for (const message of messages) {
      expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    }
  });

  it("limits join names and validates nested messages", () => {
    expect(ClientMessageSchema.safeParse({ type: "join", name: "a".repeat(51) }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "camera", camera }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "stroke:add", stroke: { ...stroke, points: [[0, 0, 0]] } }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "stroke:remove", strokeId: "" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [] }).success).toBe(false);
  });
});

describe("ServerMessageSchema", () => {
  it("accepts all ten server message variants", () => {
    const messages = [
      { type: "welcome", selfId: "user-1", users: [user], strokes: [stroke] },
      { type: "user:joined", user },
      { type: "user:left", userId: "user-1" },
      { type: "camera", userId: "user-1", camera },
      { type: "stroke:add", stroke },
      { type: "stroke:remove", strokeId: "stroke-1" },
      { type: "stroke:clear", userId: "user-1" },
      { type: "comment:created", comment },
      { type: "comment:updated", comment },
      { type: "error", code: "X", message: "bad request" },
    ];
    for (const message of messages) {
      expect(ServerMessageSchema.safeParse(message).success).toBe(true);
    }
  });

  it("requires an error message", () => {
    expect(ServerMessageSchema.safeParse({ type: "error", code: "X" }).success).toBe(false);
  });
});

describe("protocol parsers", () => {
  it("return failures rather than throwing for invalid client frames", () => {
    const invalidJson = parseClientMessage("{not json");
    const invalidMessage = parseClientMessage('{"type":"nope"}');
    expect(invalidJson.ok).toBe(false);
    expect(invalidMessage.ok).toBe(false);
    if (!invalidJson.ok && !invalidMessage.ok) {
      expect(invalidJson.error).not.toBe("");
      expect(invalidMessage.error).not.toBe("");
    }
  });

  it("parses valid client and server frames", () => {
    expect(parseClientMessage('{"type":"stroke:clear"}')).toEqual({
      ok: true,
      msg: { type: "stroke:clear" },
    });
    const invalidJson = parseServerMessage("{not json");
    const invalidMessage = parseServerMessage('{"type":"nope"}');
    expect(invalidJson.ok).toBe(false);
    expect(invalidMessage.ok).toBe(false);
    if (!invalidJson.ok && !invalidMessage.ok) {
      expect(invalidJson.error).not.toBe("");
      expect(invalidMessage.error).not.toBe("");
    }
    expect(parseServerMessage(JSON.stringify({ type: "error", code: "X", message: "bad" }))).toEqual({
      ok: true,
      msg: { type: "error", code: "X", message: "bad" },
    });
  });

  it("exposes the protocol limits", () => {
    expect(CAMERA_SEND_INTERVAL_MS).toBe(50);
    expect(MAX_NAME_LENGTH).toBe(50);
  });
});
