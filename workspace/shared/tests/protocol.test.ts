import { describe, expect, it } from "vitest";
import {
  CAMERA_SEND_INTERVAL_MS,
  ClientMessageSchema,
  LIGHT_SEND_INTERVAL_MS,
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
const version = {
  id: "version-1",
  projectId: "project-1",
  number: 1,
  fileName: "model.glb",
  byteSize: 12,
  createdAt: 1_700_000_000_000,
};

describe("ClientMessageSchema", () => {
  it("accepts each client message shape", () => {
    const messages = [
      { type: "join", name: "" },
      { type: "camera", camera },
      { type: "stroke:add", stroke },
      { type: "stroke:remove", strokeId: "stroke-1" },
      { type: "stroke:clear" },
      { type: "object:visibility", versionId: "version-1", visible: false },
      { type: "object:part-visibility", versionId: "version-1", objectPath: "0/2", visible: false },
      { type: "mesh:display", mode: "wireframe" },
      { type: "mesh:compare", compare: { baseId: "version-1", targetId: "version-2", thresholdPermille: 5 } },
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
    expect(ClientMessageSchema.safeParse({ type: "object:visibility", versionId: "", visible: false }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "object:visibility", versionId: "version-1", visible: "false" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "object:part-visibility", versionId: "version-1", objectPath: "", visible: false }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "object:part-visibility", versionId: "version-1", objectPath: "a", visible: false }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "object:part-visibility", versionId: "version-1", objectPath: "0", visible: "false" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "object:part-visibility", versionId: "version-1", visible: false }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "mesh:display", mode: "mesh" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "mesh:display" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [] }).success).toBe(false);
  });

  it("preserves an optional focal length on camera messages", () => {
    const withoutFocalLength = ClientMessageSchema.safeParse({ type: "camera", camera });
    expect(withoutFocalLength.success).toBe(true);
    if (withoutFocalLength.success) expect("focalLength" in withoutFocalLength.data).toBe(false);

    const withFocalLength = ClientMessageSchema.safeParse({ type: "camera", camera, focalLength: 50 });
    expect(withFocalLength.success).toBe(true);
    if (withFocalLength.success && withFocalLength.data.type === "camera") {
      expect(withFocalLength.data.focalLength).toBe(50);
    }

    for (const focalLength of [400, "50", null]) {
      expect(ClientMessageSchema.safeParse({ type: "camera", camera, focalLength }).success).toBe(false);
    }
  });
});

describe("ServerMessageSchema", () => {
  it("accepts all server message variants", () => {
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
      { type: "object:visibility", userId: "user-1", versionId: "version-1", visible: false },
      { type: "object:part-visibility", userId: "user-1", versionId: "version-1", objectPath: "0/2", visible: true },
      { type: "object:added", version },
      { type: "object:removed", versionId: "version-1" },
      { type: "mesh:display", userId: "user-1", mode: "solid-wireframe" },
      { type: "mesh:compare", userId: "user-1", compare: { baseId: "version-1", targetId: "version-2", thresholdPermille: 5 } },
      { type: "error", code: "X", message: "bad request" },
    ];
    for (const message of messages) {
      expect(ServerMessageSchema.safeParse(message).success).toBe(true);
    }
  });

  it("requires an error message", () => {
    expect(ServerMessageSchema.safeParse({ type: "error", code: "X" }).success).toBe(false);
  });

  it("validates object visibility and added versions", () => {
    const withHiddenObjects = ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [], hiddenObjectIds: ["v1", "v2"] });
    expect(withHiddenObjects.success).toBe(true);
    if (withHiddenObjects.success && withHiddenObjects.data.type === "welcome") {
      expect(withHiddenObjects.data.hiddenObjectIds).toEqual(["v1", "v2"]);
    }
    const hiddenObjectParts = [
      { versionId: "v1", objectPath: "0" },
      { versionId: "v1", objectPath: "0/1" },
    ];
    const withHiddenObjectParts = ServerMessageSchema.safeParse({
      type: "welcome", selfId: "user-1", users: [], strokes: [], hiddenObjectParts,
    });
    expect(withHiddenObjectParts.success).toBe(true);
    if (withHiddenObjectParts.success && withHiddenObjectParts.data.type === "welcome") {
      expect(withHiddenObjectParts.data.hiddenObjectParts).toEqual(hiddenObjectParts);
    }
    expect(ServerMessageSchema.safeParse({
      type: "welcome", selfId: "user-1", users: [], strokes: [],
      hiddenObjectParts: [{ versionId: "v1", objectPath: "" }],
    }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [], hiddenObjectIds: [""] }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "object:visibility", userId: "user-1", versionId: "", visible: true }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "object:added", version: { ...version, number: 0 } }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "object:removed", versionId: "" }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "object:removed" }).success).toBe(false);
  });

  it("validates mesh display messages and optional welcome state", () => {
    expect(ServerMessageSchema.safeParse({ type: "mesh:display", userId: "user-1", mode: "solid" }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "mesh:display", mode: "solid" }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [], meshDisplay: "x" }).success).toBe(false);

    const withoutDisplay = ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [] });
    expect(withoutDisplay.success).toBe(true);
    if (withoutDisplay.success) expect("meshDisplay" in withoutDisplay.data).toBe(false);
    if (withoutDisplay.success) expect("hiddenObjectParts" in withoutDisplay.data).toBe(false);

    const withDisplay = ServerMessageSchema.safeParse({
      type: "welcome", selfId: "user-1", users: [], strokes: [], meshDisplay: "wireframe",
    });
    expect(withDisplay.success).toBe(true);
    if (withDisplay.success && withDisplay.data.type === "welcome") expect(withDisplay.data.meshDisplay).toBe("wireframe");
  });

  it("preserves an optional focal length on server camera messages", () => {
    const withoutFocalLength = ServerMessageSchema.safeParse({ type: "camera", userId: "user-1", camera });
    expect(withoutFocalLength.success).toBe(true);
    if (withoutFocalLength.success) expect("focalLength" in withoutFocalLength.data).toBe(false);

    const withFocalLength = ServerMessageSchema.safeParse({
      type: "camera",
      userId: "user-1",
      camera,
      focalLength: 85,
    });
    expect(withFocalLength.success).toBe(true);
    if (withFocalLength.success && withFocalLength.data.type === "camera") {
      expect(withFocalLength.data.focalLength).toBe(85);
    }

    for (const focalLength of [400, "50", null]) {
      expect(ServerMessageSchema.safeParse({ type: "camera", userId: "user-1", camera, focalLength }).success).toBe(false);
    }
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
    expect(parseClientMessage(JSON.stringify({ type: "camera", camera, focalLength: 85 }))).toEqual({
      ok: true,
      msg: { type: "camera", camera, focalLength: 85 },
    });
    expect(parseClientMessage(JSON.stringify({ type: "object:visibility", versionId: "version-1", visible: false }))).toEqual({
      ok: true,
      msg: { type: "object:visibility", versionId: "version-1", visible: false },
    });
    expect(parseClientMessage(JSON.stringify({ type: "object:part-visibility", versionId: "version-1", objectPath: "0/2", visible: false }))).toEqual({
      ok: true,
      msg: { type: "object:part-visibility", versionId: "version-1", objectPath: "0/2", visible: false },
    });
    expect(parseClientMessage(JSON.stringify({ type: "mesh:display", mode: "wireframe" }))).toEqual({
      ok: true,
      msg: { type: "mesh:display", mode: "wireframe" },
    });
    expect(parseServerMessage(JSON.stringify({ type: "object:visibility", userId: "user-1", versionId: "version-1", visible: false }))).toEqual({
      ok: true,
      msg: { type: "object:visibility", userId: "user-1", versionId: "version-1", visible: false },
    });
    expect(parseServerMessage(JSON.stringify({ type: "object:part-visibility", userId: "user-1", versionId: "version-1", objectPath: "0/2", visible: true }))).toEqual({
      ok: true,
      msg: { type: "object:part-visibility", userId: "user-1", versionId: "version-1", objectPath: "0/2", visible: true },
    });
    expect(parseServerMessage(JSON.stringify({ type: "object:added", version }))).toEqual({
      ok: true,
      msg: { type: "object:added", version },
    });
    expect(parseServerMessage(JSON.stringify({ type: "object:removed", versionId: "version-1" }))).toEqual({
      ok: true,
      msg: { type: "object:removed", versionId: "version-1" },
    });
    expect(parseServerMessage(JSON.stringify({ type: "object:removed" })).ok).toBe(false);
    expect(parseServerMessage(JSON.stringify({ type: "object:removed", versionId: "" })).ok).toBe(false);
  });

  it("exposes the protocol limits", () => {
    expect(CAMERA_SEND_INTERVAL_MS).toBe(50);
    expect(MAX_NAME_LENGTH).toBe(50);
  });
});

describe("light protocol", () => {
  const angles = { yaw: 1, pitch: 0.5 };

  it("validates light messages and optional welcome state", () => {
    expect(ClientMessageSchema.safeParse({ type: "light", angles }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "light", angles: { yaw: Number.NaN, pitch: 0 } }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "light" }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "light", userId: "user-1", angles }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "light", angles }).success).toBe(false);

    const withoutLight = ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [] });
    expect(withoutLight.success).toBe(true);
    if (withoutLight.success) expect("light" in withoutLight.data).toBe(false);

    const withLight = ServerMessageSchema.safeParse({
      type: "welcome", selfId: "user-1", users: [], strokes: [], light: angles,
    });
    expect(withLight.success).toBe(true);
    if (withLight.success && withLight.data.type === "welcome") expect(withLight.data.light).toEqual(angles);

    const withoutHiddenObjects = ServerMessageSchema.safeParse({ type: "welcome", selfId: "user-1", users: [], strokes: [] });
    expect(withoutHiddenObjects.success).toBe(true);
    if (withoutHiddenObjects.success) expect("hiddenObjectIds" in withoutHiddenObjects.data).toBe(false);
  });

  it("parses light frames and exposes their send interval", () => {
    expect(parseClientMessage(JSON.stringify({ type: "light", angles }))).toEqual({
      ok: true,
      msg: { type: "light", angles },
    });
    expect(LIGHT_SEND_INTERVAL_MS).toBe(50);
  });
});
