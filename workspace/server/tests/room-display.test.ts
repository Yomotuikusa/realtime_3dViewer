import { describe, expect, it } from "vitest";
import {
  applyDisplayMessage,
  createRoomDisplayState,
  displayWelcomeFields,
  forgetObjectInDisplay,
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
      jointDisplay: null,
      motionTrail: null,
      playbackSource: null,
    });
    expect(second).toEqual({
      light: null,
      hiddenObjects: new Set(),
      hiddenParts: new Map(),
      meshDisplay: null,
      meshCompare: null,
      jointDisplay: null,
      motionTrail: null,
      playbackSource: null,
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

  it("copies joint display settings, applies the latest value, and preserves other state", () => {
    const state = createRoomDisplayState();
    const display = { visible: true, xray: false };
    applyDisplayMessage(state, "u1", { type: "mesh:display", mode: "wireframe" });
    applyDisplayMessage(state, "u1", { type: "mesh:compare", compare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 } });
    applyDisplayMessage(state, "u1", { type: "light", angles: { yaw: 1, pitch: 0.5 } });
    applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: false });

    const result = applyDisplayMessage(state, "u1", { type: "joint:display", display });
    expect(result).toEqual({ type: "joint:display", userId: "u1", display });
    expect(state.jointDisplay).toEqual(display);
    expect(state.jointDisplay).not.toBe(display);
    if (result.type !== "joint:display") throw new Error("expected joint display message");
    expect(result.display).not.toBe(state.jointDisplay);

    const next = { visible: false, xray: true };
    applyDisplayMessage(state, "u1", { type: "joint:display", display: next });
    expect(state.jointDisplay).toEqual(next);
    expect(state.meshDisplay).toBe("wireframe");
    expect(state.meshCompare).toEqual({ baseId: "v1", targetId: "v2", thresholdPermille: 5 });
    expect(state.light).toEqual({ yaw: 1, pitch: 0.5 });
    expect([...state.hiddenObjects]).toEqual(["v1"]);
  });

  it("copies motion trail settings for state, relay, and welcome", () => {
    const state = createRoomDisplayState();
    const trail = { visible: true, target: { versionId: "v1", objectPath: "0/2" } };
    const result = applyDisplayMessage(state, "u1", { type: "trail:display", trail });

    expect(result).toEqual({ type: "trail:display", userId: "u1", trail });
    expect(state.motionTrail).toEqual(trail);
    if (result.type !== "trail:display" || state.motionTrail === null) throw new Error("expected motion trail");
    expect(state.motionTrail).not.toBe(trail);
    expect(state.motionTrail.target).not.toBe(trail.target);
    expect(result.trail).not.toBe(state.motionTrail);
    expect(result.trail).not.toBe(trail);
    expect(result.trail.target).not.toBe(trail.target);
    const fields = displayWelcomeFields(state);
    expect(fields.motionTrail).toEqual(trail);
    expect(fields.motionTrail).not.toBe(state.motionTrail);
    expect(fields.motionTrail?.target).not.toBe(state.motionTrail.target);
  });

  it("omits all unset welcome fields", () => {
    const fields = displayWelcomeFields(createRoomDisplayState());

    expect(fields).toEqual({});
    expect("light" in fields).toBe(false);
    expect("hiddenObjectIds" in fields).toBe(false);
    expect("hiddenObjectParts" in fields).toBe(false);
    expect("meshDisplay" in fields).toBe(false);
    expect("meshCompare" in fields).toBe(false);
    expect("jointDisplay" in fields).toBe(false);
    expect("motionTrail" in fields).toBe(false);
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
    applyDisplayMessage(state, "u1", { type: "joint:display", display: { visible: true, xray: false } });
    applyDisplayMessage(state, "u1", {
      type: "trail:display", trail: { visible: true, target: { versionId: "v1", objectPath: "0/2" } },
    });

    const fields = displayWelcomeFields(state);

    expect(fields).toEqual({
      light: { yaw: 1, pitch: 0.5 },
      hiddenObjectIds: ["v1"],
      hiddenObjectParts: [{ versionId: "v1", objectPath: "0/1" }],
      meshDisplay: "wireframe",
      meshCompare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 },
      jointDisplay: { visible: true, xray: false },
      motionTrail: { visible: true, target: { versionId: "v1", objectPath: "0/2" } },
    });
    if (!fields.light || !fields.meshCompare || !fields.hiddenObjectIds) {
      throw new Error("expected all display welcome fields");
    }
    expect(fields.light).not.toBe(state.light);
    expect(fields.meshCompare).not.toBe(state.meshCompare);
    expect(fields.jointDisplay).not.toBe(state.jointDisplay);
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

  it("forgets deleted versions from hidden, compare, and playback state", () => {
    const state = createRoomDisplayState();
    applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: false });
    applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v2", visible: false });
    applyDisplayMessage(state, "u1", {
      type: "object:part-visibility", versionId: "v1", objectPath: "0", visible: false,
    });
    applyDisplayMessage(state, "u1", {
      type: "mesh:compare", compare: { baseId: "v1", targetId: "v2", thresholdPermille: 10 },
    });
    applyDisplayMessage(state, "u1", { type: "playback:source", versionId: "v1" });

    forgetObjectInDisplay(state, "v1");

    expect([...state.hiddenObjects]).toEqual(["v2"]);
    expect(hiddenPartsOf(state)).toEqual([]);
    expect(state.meshCompare).toEqual({ baseId: null, targetId: "v2", thresholdPermille: 10 });
    expect(state.playbackSource).toBeNull();

    forgetObjectInDisplay(state, "v2");
    expect(state.meshCompare).toEqual({ baseId: null, targetId: null, thresholdPermille: 10 });
  });
});
