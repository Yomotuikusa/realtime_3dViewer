import { describe, expect, it } from "vitest";
import { RoomHub } from "../src/realtime/hub";

const angles = { yaw: 1, pitch: 0.5 };
const otherAngles = { yaw: -2, pitch: 1.2 };

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

function welcomeLight(result: ReturnType<typeof join>) {
  const message = result[0]!.msg;
  if (message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

describe("RoomHub shared light", () => {
  it("relays light to others, stores it for welcome, and clones outbound values", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    const result = hub.handle("a", { type: "light", angles });
    expect(result).toEqual([{ target: "others", msg: { type: "light", userId: "a", angles } }]);
    if (result[0]!.msg.type !== "light") throw new Error("expected light");
    result[0]!.msg.angles.yaw = 99;

    hub.connect("p1");
    expect(welcomeLight(join(hub, "b", "Bob")).light).toEqual(angles);
  });

  it("omits light from a welcome when no value was sent", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    const welcome = welcomeLight(join(hub, "a", "Alice"));
    expect("light" in welcome).toBe(false);
  });

  it("uses last-writer-wins without changing presence or strokes", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "light", angles });
    hub.connect("p1");
    join(hub, "b", "Bob");
    hub.handle("b", { type: "light", angles: otherAngles });
    hub.connect("p1");

    expect(welcomeLight(join(hub, "c", "Carol")).light).toEqual(otherAngles);
    expect(hub.usersIn("p1").every((user) => !("light" in user))).toBe(true);
    expect(hub.strokesIn("p1")).toEqual([]);
  });

  it("ignores light messages from unknown or unjoined connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(hub.handle("a", { type: "light", angles })).toEqual([]);
    expect(hub.handle("missing", { type: "light", angles })).toEqual([]);
  });

  it("does not share light between projects and forgets it with an empty room", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "light", angles });
    hub.connect("p2");
    expect("light" in welcomeLight(join(hub, "b", "Bob"))).toBe(false);

    hub.disconnect("a");
    hub.connect("p1");
    expect("light" in welcomeLight(join(hub, "c", "Carol"))).toBe(false);
  });
});
