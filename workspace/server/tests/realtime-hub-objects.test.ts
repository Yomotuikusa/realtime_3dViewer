import { describe, expect, it } from "vitest";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

function welcome(hub: RoomHub, connId: string, name: string) {
  const message = join(hub, connId, name)[0]!.msg;
  if (message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

function visibility(versionId: string, visible: boolean) {
  return { type: "object:visibility" as const, versionId, visible };
}

describe("RoomHub object visibility", () => {
  it("relays changes, stores hidden ids, and restores them in welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    expect(hub.handle("a", visibility("v1", false))).toEqual([{
      target: "others",
      msg: { type: "object:visibility", userId: "a", versionId: "v1", visible: false },
    }]);
    expect(hub.hiddenObjectsIn("p1")).toEqual(["v1"]);

    hub.connect("p1");
    expect(welcome(hub, "b", "Bob").hiddenObjectIds).toEqual(["v1"]);

    expect(hub.handle("a", visibility("v1", true))).toEqual([{
      target: "others",
      msg: { type: "object:visibility", userId: "a", versionId: "v1", visible: true },
    }]);
    expect(hub.hiddenObjectsIn("p1")).toEqual([]);
  });

  it("keeps Set insertion order and relays duplicate state changes", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");

    for (const message of [visibility("v1", false), visibility("v2", false), visibility("v1", true)]) {
      expect(hub.handle("a", message)).toHaveLength(1);
    }
    expect(hub.handle("a", visibility("v1", false))).toEqual([{
      target: "others",
      msg: { type: "object:visibility", userId: "a", versionId: "v1", visible: false },
    }]);
    expect(hub.handle("a", visibility("v1", false))).toEqual([{
      target: "others",
      msg: { type: "object:visibility", userId: "a", versionId: "v1", visible: false },
    }]);
    expect(hub.hiddenObjectsIn("p1")).toEqual(["v2", "v1"]);
  });

  it("returns copies of hidden ids to callers", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", visibility("v1", false));

    const hiddenIds = hub.hiddenObjectsIn("p1");
    hiddenIds.push("caller-only");
    expect(hub.hiddenObjectsIn("p1")).toEqual(["v1"]);

    hub.connect("p1");
    const joined = welcome(hub, "b", "Bob");
    joined.hiddenObjectIds!.push("caller-only");
    expect(hub.hiddenObjectsIn("p1")).toEqual(["v1"]);
  });

  it("omits hiddenObjectIds when empty and forgets them after room deletion", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", visibility("v1", false));
    hub.connect("p1");
    expect(welcome(hub, "b", "Bob").hiddenObjectIds).toEqual(["v1"]);

    hub.connect("p2");
    expect("hiddenObjectIds" in welcome(hub, "c", "Carol")).toBe(false);

    hub.handle("a", visibility("v1", true));
    hub.connect("p1");
    expect("hiddenObjectIds" in welcome(hub, "d", "Dana")).toBe(false);
    hub.handle("b", visibility("v2", false));
    hub.disconnect("a");
    hub.disconnect("b");
    hub.disconnect("d");
    hub.connect("p1");
    expect("hiddenObjectIds" in welcome(hub, "e", "Eri")).toBe(false);
  });

  it("ignores visibility messages before join or from unknown connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    const message = visibility("v1", false);
    expect(hub.handle("a", message)).toEqual([]);
    expect(hub.handle("missing", message)).toEqual([]);
    expect(hub.hiddenObjectsIn("p1")).toEqual([]);
    expect(hub.hiddenObjectsIn("missing")).toEqual([]);
  });

  it("does not change presence, strokes, or light state", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()!, now: () => 10 });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "light", angles: { yaw: 1, pitch: 0.5 } });
    hub.handle("a", {
      type: "stroke:add",
      stroke: {
        id: "s1",
        userId: "ignored",
        color: "#ff8800",
        points: [[0, 0, 0], [1, 1, 1]],
        createdAt: 1,
      },
    });
    const users = hub.usersIn("p1");
    const strokes = hub.strokesIn("p1");

    hub.handle("a", visibility("v1", false));

    expect(hub.usersIn("p1")).toEqual(users);
    expect(hub.strokesIn("p1")).toEqual(strokes);
    hub.connect("p1");
    expect(welcome(hub, "b", "Bob").light).toEqual({ yaw: 1, pitch: 0.5 });
  });

  it("forgets deleted versions without broadcasting and leaves other display state", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", visibility("v1", false));
    hub.handle("a", visibility("v2", false));
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
