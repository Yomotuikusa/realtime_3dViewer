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

function display(mode: "solid" | "wireframe" | "solid-wireframe") {
  return { type: "mesh:display" as const, mode };
}

describe("RoomHub mesh display", () => {
  it("relays display changes to others and stores the latest value for welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    expect(hub.handle("a", display("wireframe"))).toEqual([{
      target: "others",
      msg: { type: "mesh:display", userId: "a", mode: "wireframe" },
    }]);
    hub.connect("p1");
    expect(welcome(hub, "b", "Bob").meshDisplay).toBe("wireframe");
    expect(hub.meshDisplayIn("p1")).toBe("wireframe");
  });

  it("omits the display from welcome and returns null before anyone sends it", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    const message = welcome(hub, "a", "Alice");
    expect("meshDisplay" in message).toBe(false);
    expect(hub.meshDisplayIn("p1")).toBeNull();
  });

  it("uses last-writer-wins, including an explicit solid value", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", display("wireframe"));
    hub.connect("p1");
    join(hub, "b", "Bob");
    hub.handle("b", display("solid-wireframe"));
    hub.handle("b", display("solid-wireframe"));
    hub.connect("p1");
    expect(welcome(hub, "c", "Carol").meshDisplay).toBe("solid-wireframe");

    expect(hub.handle("a", display("solid"))).toEqual([{
      target: "others",
      msg: { type: "mesh:display", userId: "a", mode: "solid" },
    }]);
    expect(hub.meshDisplayIn("p1")).toBe("solid");
  });

  it("relays repeated values and ignores unknown or unjoined connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(hub.handle("a", display("wireframe"))).toEqual([]);
    expect(hub.handle("missing", display("wireframe"))).toEqual([]);
    join(hub, "a", "Alice");
    expect(hub.handle("a", display("wireframe"))).toHaveLength(1);
    expect(hub.handle("a", display("wireframe"))).toHaveLength(1);
  });

  it("keeps display state isolated between projects and removes it with the room", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", display("wireframe"));
    hub.connect("p2");
    expect("meshDisplay" in welcome(hub, "b", "Bob")).toBe(false);
    expect(hub.meshDisplayIn("p2")).toBeNull();

    hub.disconnect("a");
    hub.disconnect("b");
    hub.connect("p1");
    expect("meshDisplay" in welcome(hub, "c", "Carol")).toBe(false);
    expect(hub.meshDisplayIn("missing")).toBeNull();
  });

  it("does not affect presence, strokes, or hidden objects", () => {
    const hub = new RoomHub({ newId: () => "a", now: () => 10 });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "object:visibility", versionId: "v1", visible: false });
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
    const hiddenIds = hub.hiddenObjectsIn("p1");

    hub.handle("a", display("wireframe"));

    expect(hub.usersIn("p1")).toEqual(users);
    expect(hub.strokesIn("p1")).toEqual(strokes);
    expect(hub.hiddenObjectsIn("p1")).toEqual(hiddenIds);
  });
});
