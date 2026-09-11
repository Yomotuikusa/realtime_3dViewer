import { describe, expect, it } from "vitest";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

describe("RoomHub object visibility", () => {
  it("relays visibility changes to other joined users", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.connect("p1");
    join(hub, "b", "Bob");

    expect(hub.handle("a", {
      type: "object:visibility",
      versionId: "v1",
      visible: false,
    })).toEqual([{
      target: "others",
      msg: { type: "object:visibility", userId: "a", versionId: "v1", visible: false },
    }]);
  });

  it("does not retain visibility state in the room welcome", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "object:visibility", versionId: "v1", visible: false });
    hub.connect("p1");
    const welcome = join(hub, "b", "Bob")[0]!.msg;
    expect(welcome.type).toBe("welcome");
    if (welcome.type === "welcome") expect("hiddenObjectIds" in welcome).toBe(false);
    hub.disconnect("a");
    hub.disconnect("b");

    hub.connect("p1");
    const newRoomWelcome = join(hub, "c", "Carol")[0]!.msg;
    expect(newRoomWelcome.type).toBe("welcome");
    if (newRoomWelcome.type === "welcome") expect("hiddenObjectIds" in newRoomWelcome).toBe(false);
  });

  it("ignores visibility messages before join or from unknown connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    const message = { type: "object:visibility" as const, versionId: "v1", visible: false };
    expect(hub.handle("a", message)).toEqual([]);
    expect(hub.handle("missing", message)).toEqual([]);
  });
});
