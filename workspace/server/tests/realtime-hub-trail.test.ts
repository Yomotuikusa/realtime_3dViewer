import { describe, expect, it } from "vitest";
import type { MotionTrail } from "@shared/trail";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

function welcome(hub: RoomHub, connId: string, name: string) {
  const message = join(hub, connId, name)[0]!.msg;
  if (message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

function trail(value: MotionTrail) {
  return { type: "trail:display" as const, trail: value };
}

const first: MotionTrail = { visible: true, target: { versionId: "v1", objectPath: "0/2" } };

describe("RoomHub motion trail display", () => {
  it("relays, stores, copies, and restores the latest value in welcome", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    const incoming = trail(first);

    expect(hub.handle("a", incoming)).toEqual([{ target: "others", msg: { type: "trail:display", userId: "a", trail: first } }]);
    expect(hub.motionTrailIn("p1")).toEqual(first);
    expect(hub.motionTrailIn("p1")).not.toBe(incoming.trail);
    expect(hub.motionTrailIn("p1")?.target).not.toBe(incoming.trail.target);
    incoming.trail.visible = false;
    expect(hub.motionTrailIn("p1")).toEqual({ visible: true, target: first.target });

    hub.connect("p1");
    expect(welcome(hub, "b", "Bob").motionTrail).toEqual({ visible: true, target: first.target });
  });

  it("omits unset values and isolates missing or empty rooms", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    expect("motionTrail" in welcome(hub, "a", "Alice")).toBe(false);
    expect(hub.motionTrailIn("p1")).toBeNull();
    expect(hub.motionTrailIn("missing")).toBeNull();
  });
});
