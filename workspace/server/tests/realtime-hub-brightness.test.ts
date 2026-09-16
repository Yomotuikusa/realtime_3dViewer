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

describe("RoomHub shared light brightness", () => {
  it("relays brightness and restores it for later joins without restoring light angles", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    expect(hub.handle("a", { type: "light:brightness", brightness: 2 })).toEqual([{
      target: "others",
      msg: { type: "light:brightness", userId: "a", brightness: 2 },
    }]);
    hub.connect("p1");
    const laterWelcome = welcome(hub, "b", "Bob");
    expect(laterWelcome.lightBrightness).toBe(2);
    expect("light" in laterWelcome).toBe(false);
  });

  it("starts unset and ignores brightness from unknown or unjoined connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(hub.handle("a", { type: "light:brightness", brightness: 2 })).toEqual([]);
    expect(hub.handle("missing", { type: "light:brightness", brightness: 2 })).toEqual([]);
    const message = welcome(hub, "a", "Alice");
    expect("lightBrightness" in message).toBe(false);
  });

  it("uses last-writer-wins and exposes the current room value", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "light:brightness", brightness: 2 });
    hub.connect("p1");
    join(hub, "b", "Bob");
    hub.handle("b", { type: "light:brightness", brightness: 0.5 });

    expect(hub.handle("b", { type: "light:brightness", brightness: 0.5 })).toHaveLength(1);
    hub.connect("p1");
    expect(welcome(hub, "c", "Carol").lightBrightness).toBe(0.5);
  });

  it("isolates brightness by project and forgets it when a room empties", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "light:brightness", brightness: 2 });

    hub.connect("p2");
    expect("lightBrightness" in welcome(hub, "b", "Bob")).toBe(false);
    hub.disconnect("a");
    hub.connect("p1");
    expect("lightBrightness" in welcome(hub, "c", "Carol")).toBe(false);
  });
});
