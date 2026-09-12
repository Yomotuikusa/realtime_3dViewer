import { describe, expect, it } from "vitest";
import type { JointDisplay } from "@shared/types";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

function welcome(hub: RoomHub, connId: string, name: string) {
  const message = join(hub, connId, name)[0]!.msg;
  if (message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

function joint(display: JointDisplay) {
  return { type: "joint:display" as const, display };
}

const first: JointDisplay = { visible: true, xray: false };
const second: JointDisplay = { visible: false, xray: true };

describe("RoomHub joint display", () => {
  it("relays, stores, and uses the latest copied value in welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    const incoming = joint(first);
    expect(hub.handle("a", incoming)).toEqual([{
      target: "others",
      msg: { type: "joint:display", userId: "a", display: first },
    }]);
    expect(hub.jointDisplayIn("p1")).toEqual(first);
    expect(hub.jointDisplayIn("p1")).not.toBe(incoming.display);
    incoming.display.visible = false;
    expect(hub.jointDisplayIn("p1")).toEqual({ visible: true, xray: false });

    hub.handle("a", joint(second));
    expect(hub.jointDisplayIn("p1")).toEqual(second);
    hub.connect("p1");
    const later = welcome(hub, "b", "Bob");
    expect(later.jointDisplay).toEqual(hub.jointDisplayIn("p1"));
  });

  it("omits unset values, isolates projects, and clears state with the room", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    const firstWelcome = welcome(hub, "a", "Alice");
    expect("jointDisplay" in firstWelcome).toBe(false);
    expect(hub.jointDisplayIn("p1")).toBeNull();
    hub.handle("a", joint(first));

    hub.connect("p2");
    const otherWelcome = welcome(hub, "b", "Bob");
    expect("jointDisplay" in otherWelcome).toBe(false);
    expect(hub.jointDisplayIn("p2")).toBeNull();
    expect(hub.jointDisplayIn("missing")).toBeNull();
    hub.disconnect("a");
    hub.disconnect("b");
    expect(hub.jointDisplayIn("p1")).toBeNull();
    hub.connect("p1");
    expect("jointDisplay" in welcome(hub, "c", "Carol")).toBe(false);
  });

  it("ignores unjoined connections and keeps mesh display independent", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(hub.handle("a", joint(first))).toEqual([]);
    expect(hub.jointDisplayIn("p1")).toBeNull();
    expect(hub.handle("missing", joint(first))).toEqual([]);
    join(hub, "a", "Alice");
    hub.handle("a", { type: "mesh:display", mode: "wireframe" });
    expect(hub.jointDisplayIn("p1")).toBeNull();
    hub.handle("a", joint(first));
    expect(hub.meshDisplayIn("p1")).toBe("wireframe");
    expect(hub.jointDisplayIn("p1")).toEqual(first);
  });
});
