import { describe, expect, it } from "vitest";
import { DEFAULT_MESH_COMPARE, type MeshCompare } from "@shared/types";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

function welcome(hub: RoomHub, connId: string, name: string) {
  const message = join(hub, connId, name)[0]!.msg;
  if (message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

function compare(baseId: string | null, targetId: string | null, thresholdPermille: number) {
  return { type: "mesh:compare" as const, compare: { baseId, targetId, thresholdPermille } };
}

const c1: MeshCompare = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };
const c2: MeshCompare = { baseId: "v2", targetId: "v3", thresholdPermille: 10 };

describe("RoomHub mesh compare", () => {
  it("relays and stores a copied compare value for welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    const incoming = compare(c1.baseId, c1.targetId, c1.thresholdPermille);
    const out = hub.handle("a", incoming);

    expect(out).toEqual([{ target: "others", msg: { type: "mesh:compare", userId: "a", compare: c1 } }]);
    expect(out[0]!.msg.type === "mesh:compare" ? out[0]!.msg.compare : null).not.toBe(incoming.compare);
    expect(hub.meshCompareIn("p1")).toEqual(c1);
    expect(hub.meshCompareIn("p1")).not.toBe(incoming.compare);

    incoming.compare.baseId = "changed";
    expect(hub.meshCompareIn("p1")).toEqual(c1);
    hub.connect("p1");
    expect(welcome(hub, "b", "Bob").meshCompare).toEqual(c1);
  });

  it("includes the latest value in a later join and keeps explicit defaults", () => {
    const ids = ["a", "b", "c", "d"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", compare(c1.baseId, c1.targetId, c1.thresholdPermille));
    hub.connect("p1");
    join(hub, "b", "Bob");
    const second = compare(c2.baseId, c2.targetId, c2.thresholdPermille);
    expect(hub.handle("b", second)).toEqual([{ target: "others", msg: { type: "mesh:compare", userId: "b", compare: c2 } }]);
    expect(hub.handle("b", second)).toEqual([{ target: "others", msg: { type: "mesh:compare", userId: "b", compare: c2 } }]);
    hub.connect("p1");
    expect(welcome(hub, "c", "Carol").meshCompare).toEqual(c2);

    hub.handle("a", { type: "mesh:compare", compare: { ...DEFAULT_MESH_COMPARE } });
    expect(hub.meshCompareIn("p1")).toEqual(DEFAULT_MESH_COMPARE);
    hub.connect("p1");
    expect(welcome(hub, "d", "Dave").meshCompare).toEqual(DEFAULT_MESH_COMPARE);
  });

  it("omits unset values, isolates projects, and clears state with the room", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    const first = welcome(hub, "a", "Alice");
    expect("meshCompare" in first).toBe(false);
    expect(hub.meshCompareIn("p1")).toBeNull();
    hub.handle("a", compare("v1", "v2", 5));

    hub.connect("p2");
    const otherProject = welcome(hub, "b", "Bob");
    expect("meshCompare" in otherProject).toBe(false);
    expect(hub.meshCompareIn("p2")).toBeNull();
    hub.disconnect("a");
    hub.disconnect("b");
    expect(hub.meshCompareIn("p1")).toBeNull();
    hub.connect("p1");
    expect("meshCompare" in welcome(hub, "c", "Carol")).toBe(false);
  });

  it("ignores unjoined connections and does not affect other room state", () => {
    const hub = new RoomHub({ newId: () => "a", now: () => 10 });
    hub.connect("p1");
    expect(hub.handle("a", compare("v1", "v2", 5))).toEqual([]);
    expect(hub.handle("missing", compare("v1", "v2", 5))).toEqual([]);
    join(hub, "a", "Alice");
    hub.handle("a", { type: "mesh:display", mode: "wireframe" });
    hub.handle("a", { type: "object:visibility", versionId: "v1", visible: false });
    const stroke = {
      id: "s1", userId: "ignored", color: "#ff8800", points: [[0, 0, 0], [1, 1, 1]] as [[number, number, number], [number, number, number]], createdAt: 1,
    };
    hub.handle("a", { type: "stroke:add", stroke });
    const users = hub.usersIn("p1");
    const strokes = hub.strokesIn("p1");
    const hiddenIds = hub.hiddenObjectsIn("p1");
    hub.handle("a", compare("v1", "v2", 5));
    expect(hub.usersIn("p1")).toEqual(users);
    expect(hub.strokesIn("p1")).toEqual(strokes);
    expect(hub.hiddenObjectsIn("p1")).toEqual(hiddenIds);
    expect(hub.meshDisplayIn("p1")).toBe("wireframe");
    expect(hub.meshCompareIn("missing")).toBeNull();
  });
});
