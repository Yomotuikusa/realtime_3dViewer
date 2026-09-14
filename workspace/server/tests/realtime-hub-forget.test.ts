import { describe, expect, it } from "vitest";
import {
  applyDisplayMessage,
  createRoomDisplayState,
  forgetObjectInDisplay,
  hiddenPartsOf,
} from "../src/realtime/room-display";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

function welcome(hub: RoomHub, connId: string, name: string) {
  const message = join(hub, connId, name)[0]!.msg;
  if (message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

describe("forgetting deleted objects from room display state", () => {
  it("removes matching hidden, part, compare, and playback references", () => {
    const state = createRoomDisplayState();
    applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v1", visible: false });
    applyDisplayMessage(state, "u1", { type: "object:visibility", versionId: "v2", visible: false });
    applyDisplayMessage(state, "u1", {
      type: "object:part-visibility", versionId: "v1", objectPath: "0", visible: false,
    });
    applyDisplayMessage(state, "u1", {
      type: "object:part-visibility", versionId: "v2", objectPath: "1", visible: false,
    });
    applyDisplayMessage(state, "u1", {
      type: "mesh:compare", compare: { baseId: "v1", targetId: "v2", thresholdPermille: 10 },
    });
    applyDisplayMessage(state, "u1", { type: "playback:source", versionId: "v1" });

    forgetObjectInDisplay(state, "v1");

    expect([...state.hiddenObjects]).toEqual(["v2"]);
    expect(hiddenPartsOf(state)).toEqual([{ versionId: "v2", objectPath: "1" }]);
    expect(state.meshCompare).toEqual({ baseId: null, targetId: "v2", thresholdPermille: 10 });
    expect(state.playbackSource).toBeNull();

    forgetObjectInDisplay(state, "v2");
    expect([...state.hiddenObjects]).toEqual([]);
    expect(hiddenPartsOf(state)).toEqual([]);
    expect(state.meshCompare).toEqual({ baseId: null, targetId: null, thresholdPermille: 10 });
  });
});

describe("RoomHub.forgetObject", () => {
  it("forgets a room object without broadcasting and omits it from welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "object:visibility", versionId: "v1", visible: false });
    hub.handle("a", { type: "object:visibility", versionId: "v2", visible: false });
    hub.handle("a", { type: "object:part-visibility", versionId: "v1", objectPath: "0", visible: false });
    hub.handle("a", { type: "object:part-visibility", versionId: "v2", objectPath: "1", visible: false });
    hub.handle("a", { type: "mesh:compare", compare: { baseId: "v1", targetId: "v2", thresholdPermille: 10 } });
    hub.handle("a", { type: "playback:source", versionId: "v1" });

    hub.forgetObject("p1", "v1");

    expect(hub.hiddenObjectsIn("p1")).toEqual(["v2"]);
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([{ versionId: "v2", objectPath: "1" }]);
    expect(hub.meshCompareIn("p1")).toEqual({ baseId: null, targetId: "v2", thresholdPermille: 10 });
    expect(hub.playbackSourceIn("p1")).toBeNull();
    hub.connect("p1");
    const joined = welcome(hub, "b", "Bob");
    expect(joined.hiddenObjectIds).toEqual(["v2"]);
    expect(joined.hiddenObjectParts).toEqual([{ versionId: "v2", objectPath: "1" }]);
    expect(() => hub.forgetObject("missing", "v1")).not.toThrow();
  });
});
