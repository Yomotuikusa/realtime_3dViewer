import { describe, expect, it } from "vitest";
import {
  applyDisplayMessage,
  createRoomDisplayState,
  displayWelcomeFields,
  hiddenPartsOf,
} from "../src/realtime/room-display";

describe("room display state", () => {
  it("creates independent empty states", () => {
    const first = createRoomDisplayState();
    const second = createRoomDisplayState();

    expect(first).toEqual({
      light: null,
      hiddenObjects: new Set(),
      hiddenParts: new Map(),
      meshDisplay: null,
      meshCompare: null,
    });
    expect(second).toEqual({
      light: null,
      hiddenObjects: new Set(),
      hiddenParts: new Map(),
      meshDisplay: null,
      meshCompare: null,
    });
    expect(first.hiddenObjects).not.toBe(second.hiddenObjects);
    expect(first.hiddenParts).not.toBe(second.hiddenParts);
  });

  it("copies light angles into state and the relay message", () => {
    const state = createRoomDisplayState();
    const input = { type: "light" as const, angles: { yaw: 1, pitch: 0.5 } };

    const result = applyDisplayMessage(state, "u1", input);

    expect(result).toEqual({ type: "light", userId: "u1", angles: input.angles });
    expect(state.light).toEqual(input.angles);
    if (result.type !== "light") throw new Error("expected light message");
    expect(state.light).not.toBe(input.angles);
    expect(result.angles).not.toBe(state.light);
  });

  it("keeps hidden versions in insertion order and removes them when visible", () => {
    const state = createRoomDisplayState();

    expect(applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: false })).toEqual({
      type: "object:visibility", userId: "u1", versionId: "v1", visible: false,
    });
    expect([...state.hiddenObjects]).toEqual(["v1"]);
    expect(applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: false })).toEqual({
      type: "object:visibility", userId: "u1", versionId: "v1", visible: false,
    });
    expect([...state.hiddenObjects]).toEqual(["v1"]);
    expect(applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: true })).toEqual({
      type: "object:visibility", userId: "u1", versionId: "v1", visible: true,
    });
    expect([...state.hiddenObjects]).toEqual([]);
  });

  it("keeps hidden parts keyed by version and path in insertion order", () => {
    const state = createRoomDisplayState();
    const hidden = (versionId: string, objectPath: string, visible: boolean) => ({
      type: "object:part-visibility" as const,
      versionId,
      objectPath,
      visible,
    });

    expect(applyDisplayMessage(state, "u1", hidden("v1", "0/1", false))).toEqual({
      type: "object:part-visibility", userId: "u1", versionId: "v1", objectPath: "0/1", visible: false,
    });
    expect(hiddenPartsOf(state)).toEqual([{ versionId: "v1", objectPath: "0/1" }]);
    expect(applyDisplayMessage(state, "u1", hidden("v1", "0/1", false))).toEqual({
      type: "object:part-visibility", userId: "u1", versionId: "v1", objectPath: "0/1", visible: false,
    });
    expect(hiddenPartsOf(state)).toEqual([{ versionId: "v1", objectPath: "0/1" }]);

    expect(applyDisplayMessage(state, "u1", hidden("v1", "2", false))).toHaveProperty("type", "object:part-visibility");
    expect(hiddenPartsOf(state)).toEqual([
      { versionId: "v1", objectPath: "0/1" },
      { versionId: "v1", objectPath: "2" },
    ]);
    expect(applyDisplayMessage(state, "u1", hidden("v1", "0/1", true))).toHaveProperty("type", "object:part-visibility");
    expect(hiddenPartsOf(state)).toEqual([{ versionId: "v1", objectPath: "2" }]);

    applyDisplayMessage(state, "u1", hidden("v2", "0/1", false));
    expect(hiddenPartsOf(state)).toEqual([
      { versionId: "v1", objectPath: "2" },
      { versionId: "v2", objectPath: "0/1" },
    ]);
  });

  it("stores and relays mesh display mode", () => {
    const state = createRoomDisplayState();

    expect(applyDisplayMessage(state, "u1", { type: "mesh:display", mode: "wireframe" })).toEqual({
      type: "mesh:display", userId: "u1", mode: "wireframe",
    });
    expect(state.meshDisplay).toBe("wireframe");
  });

  it("copies mesh compare settings for state and relay", () => {
    const state = createRoomDisplayState();
    const compare = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };

    const result = applyDisplayMessage(state, "u1", { type: "mesh:compare", compare });

    expect(result).toEqual({ type: "mesh:compare", userId: "u1", compare });
    expect(state.meshCompare).toEqual(compare);
    if (result.type !== "mesh:compare") throw new Error("expected mesh compare message");
    expect(state.meshCompare).not.toBe(compare);
    expect(result.compare).not.toBe(state.meshCompare);
  });

  it("omits all unset welcome fields", () => {
    const fields = displayWelcomeFields(createRoomDisplayState());

    expect(fields).toEqual({});
    expect("light" in fields).toBe(false);
    expect("hiddenObjectIds" in fields).toBe(false);
    expect("hiddenObjectParts" in fields).toBe(false);
    expect("meshDisplay" in fields).toBe(false);
    expect("meshCompare" in fields).toBe(false);
  });

  it("restores all configured fields as copies", () => {
    const state = createRoomDisplayState();
    applyDisplayMessage(state, "u1", { type: "light", angles: { yaw: 1, pitch: 0.5 } });
    applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: false });
    applyDisplayMessage(state, "u1", {
      type: "object:part-visibility", versionId: "v1", objectPath: "0/1", visible: false,
    });
    applyDisplayMessage(state, "u1", { type: "mesh:display", mode: "wireframe" });
    applyDisplayMessage(state, "u1", {
      type: "mesh:compare",
      compare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 },
    });

    const fields = displayWelcomeFields(state);

    expect(fields).toEqual({
      light: { yaw: 1, pitch: 0.5 },
      hiddenObjectIds: ["v1"],
      hiddenObjectParts: [{ versionId: "v1", objectPath: "0/1" }],
      meshDisplay: "wireframe",
      meshCompare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 },
    });
    if (!fields.light || !fields.meshCompare || !fields.hiddenObjectIds) {
      throw new Error("expected all display welcome fields");
    }
    expect(fields.light).not.toBe(state.light);
    expect(fields.meshCompare).not.toBe(state.meshCompare);
    expect(fields.hiddenObjectIds).not.toBe(state.hiddenObjects);
    fields.hiddenObjectIds.push("v2");
    expect([...state.hiddenObjects]).toEqual(["v1"]);
    if (!fields.hiddenObjectParts) throw new Error("expected hidden object parts");
    fields.hiddenObjectParts.push({ versionId: "v2", objectPath: "2" });
    fields.hiddenObjectParts[0]!.objectPath = "caller-only";
    expect(hiddenPartsOf(state)).toEqual([{ versionId: "v1", objectPath: "0/1" }]);

    const parts = hiddenPartsOf(state);
    parts.push({ versionId: "v3", objectPath: "3" });
    parts[0]!.objectPath = "caller-only";
    expect(hiddenPartsOf(state)).toEqual([{ versionId: "v1", objectPath: "0/1" }]);
  });
});
