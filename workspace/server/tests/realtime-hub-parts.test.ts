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

function part(versionId: string, objectPath: string, visible: boolean) {
  return { type: "object:part-visibility" as const, versionId, objectPath, visible };
}

describe("RoomHub object part visibility", () => {
  it("relays changes, stores hidden parts, and restores them in welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    expect(hub.handle("a", part("v1", "0/2", false))).toEqual([{
      target: "others",
      msg: {
        type: "object:part-visibility", userId: "a", versionId: "v1", objectPath: "0/2", visible: false,
      },
    }]);
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([{ versionId: "v1", objectPath: "0/2" }]);

    hub.connect("p1");
    const joined = welcome(hub, "b", "Bob");
    expect(joined.hiddenObjectParts).toEqual([{ versionId: "v1", objectPath: "0/2" }]);
    expect("hiddenObjectIds" in joined).toBe(false);

    expect(hub.handle("a", part("v1", "0/2", true))).toEqual([{
      target: "others",
      msg: {
        type: "object:part-visibility", userId: "a", versionId: "v1", objectPath: "0/2", visible: true,
      },
    }]);
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([]);
  });

  it("keeps independent paths and versions in insertion order", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");

    for (const message of [part("v1", "0/1", false), part("v1", "0/1", false)]) {
      expect(hub.handle("a", message)).toHaveLength(1);
    }
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([{ versionId: "v1", objectPath: "0/1" }]);
    hub.handle("a", part("v1", "2", false));
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([
      { versionId: "v1", objectPath: "0/1" },
      { versionId: "v1", objectPath: "2" },
    ]);
    hub.handle("a", part("v1", "0/1", true));
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([{ versionId: "v1", objectPath: "2" }]);
    hub.handle("a", part("v2", "0/1", false));
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([
      { versionId: "v1", objectPath: "2" },
      { versionId: "v2", objectPath: "0/1" },
    ]);
  });

  it("keeps object visibility separate from part visibility", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "object:visibility", versionId: "v1", visible: false });
    hub.handle("a", part("v1", "0/2", false));

    hub.connect("p1");
    const joined = welcome(hub, "b", "Bob");
    expect(joined.hiddenObjectIds).toEqual(["v1"]);
    expect(joined.hiddenObjectParts).toEqual([{ versionId: "v1", objectPath: "0/2" }]);
    hub.handle("a", part("v1", "0/2", true));
    expect(hub.hiddenObjectsIn("p1")).toEqual(["v1"]);
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([]);
  });

  it("isolates rooms and forgets parts after room deletion", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", part("v1", "0/2", false));
    hub.connect("p2");
    expect("hiddenObjectParts" in welcome(hub, "b", "Bob")).toBe(false);
    expect(hub.hiddenObjectPartsIn("p2")).toEqual([]);

    hub.disconnect("a");
    hub.disconnect("b");
    hub.connect("p1");
    expect("hiddenObjectParts" in welcome(hub, "c", "Carol")).toBe(false);
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([]);
  });

  it("ignores part visibility before join or from unknown connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    const message = part("v1", "0/2", false);
    expect(hub.handle("a", message)).toEqual([]);
    expect(hub.handle("missing", message)).toEqual([]);
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([]);
    expect(hub.hiddenObjectPartsIn("missing")).toEqual([]);
  });

  it("returns independent copies and does not affect other room state", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()!, now: () => 10 });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "light", angles: { yaw: 1, pitch: 0.5 } });
    hub.handle("a", {
      type: "stroke:add",
      stroke: {
        id: "s1", userId: "ignored", color: "#ff8800", points: [[0, 0, 0], [1, 1, 1]], createdAt: 1,
      },
    });
    const users = hub.usersIn("p1");
    const strokes = hub.strokesIn("p1");
    hub.handle("a", part("v1", "0/2", false));
    const hidden = hub.hiddenObjectPartsIn("p1");
    hidden.push({ versionId: "caller-only", objectPath: "1" });
    hidden[0]!.objectPath = "caller-only";
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([{ versionId: "v1", objectPath: "0/2" }]);
    expect(hub.usersIn("p1")).toEqual(users);
    expect(hub.strokesIn("p1")).toEqual(strokes);

    hub.connect("p1");
    const joined = welcome(hub, "b", "Bob");
    if (!joined.hiddenObjectParts) throw new Error("expected hidden object parts");
    joined.hiddenObjectParts.push({ versionId: "caller-only", objectPath: "1" });
    joined.hiddenObjectParts[0]!.objectPath = "caller-only";
    expect(hub.hiddenObjectPartsIn("p1")).toEqual([{ versionId: "v1", objectPath: "0/2" }]);
    expect(joined.light).toEqual({ yaw: 1, pitch: 0.5 });
  });
});
