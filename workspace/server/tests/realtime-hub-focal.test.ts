import { describe, expect, it } from "vitest";
import type { CameraState, Stroke } from "@shared/types";
import { RoomHub } from "../src/realtime/hub";

const camera: CameraState = { position: [1, 2, 3], target: [4, 5, 6] };

function stroke(id: string): Stroke {
  return {
    id,
    userId: "spoofed",
    color: "#ff8800",
    points: [[0, 0, 0], [1, 1, 1]],
    createdAt: 1,
  };
}

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

describe("RoomHub camera focal length", () => {
  it("stores and relays an explicitly sent focal length", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");

    expect(hub.handle("a", { type: "camera", camera, focalLength: 85 })).toEqual([{
      target: "others",
      msg: { type: "camera", userId: "a", camera, focalLength: 85 },
    }]);
    expect(hub.usersIn("p1")[0]).toMatchObject({ id: "a", focalLength: 85 });
  });

  it("omits focal length until the first value is sent", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");

    const result = hub.handle("a", { type: "camera", camera });
    expect("focalLength" in result[0]!.msg).toBe(false);
    const user = hub.usersIn("p1")[0]!;
    expect(user.focalLength).toBeUndefined();
    expect("focalLength" in user).toBe(false);
  });

  it("retains the last focal length when a later camera omits it", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "camera", camera, focalLength: 85 });

    const result = hub.handle("a", { type: "camera", camera });
    expect(result[0]!.msg).toMatchObject({ focalLength: 85 });
    expect(hub.usersIn("p1")[0]!.focalLength).toBe(85);
  });

  it("replaces the retained focal length when a new value is sent", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "camera", camera, focalLength: 85 });

    const result = hub.handle("a", { type: "camera", camera, focalLength: 24 });
    expect(result[0]!.msg).toMatchObject({ focalLength: 24 });
    expect(hub.usersIn("p1")[0]!.focalLength).toBe(24);
  });

  it.each([85, 24, 300, 14])("updates and relays focal length %d", (focalLength) => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");

    const result = hub.handle("a", { type: "camera", camera, focalLength });
    expect(result[0]!.msg).toMatchObject({ focalLength });
    expect(hub.usersIn("p1")[0]!.focalLength).toBe(focalLength);
  });

  it("includes a stored value in welcome and omits it for a new participant", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "camera", camera, focalLength: 85 });
    hub.connect("p1");

    const welcome = join(hub, "b", "Bob");
    expect(welcome[0]!.msg).toMatchObject({
      type: "welcome",
      users: [{ id: "a", focalLength: 85 }, { id: "b" }],
    });
    const joined = welcome[1]!.msg;
    if (joined.type !== "user:joined") throw new Error("expected user:joined");
    expect("focalLength" in joined.user).toBe(false);
  });

  it("does not expose internal focal length through usersIn results", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "camera", camera, focalLength: 85 });

    const users = hub.usersIn("p1");
    users[0]!.focalLength = 24;
    expect(hub.usersIn("p1")[0]!.focalLength).toBe(85);
  });

  it("starts a rejoined participant without focal length", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "camera", camera, focalLength: 85 });
    hub.disconnect("a");
    hub.connect("p1");
    join(hub, "b", "Alice");

    const user = hub.usersIn("p1").find((candidate) => candidate.id === "b")!;
    expect(user.focalLength).toBeUndefined();
    expect("focalLength" in user).toBe(false);
  });

  it("ignores focal length from camera messages before join", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(hub.handle("a", { type: "camera", camera, focalLength: 85 })).toEqual([]);
    expect(join(hub, "a", "Alice")[0]!.msg).toMatchObject({ users: [{ id: "a" }] });
    expect("focalLength" in hub.usersIn("p1")[0]!).toBe(false);
  });

  it("leaves focal length unchanged while handling stroke add and clear", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "Alice");
    hub.handle("a", { type: "camera", camera, focalLength: 85 });

    expect(hub.handle("a", { type: "stroke:add", stroke: stroke("s1") })[0]!.msg.type).toBe("stroke:add");
    expect(hub.handle("a", { type: "stroke:clear" })).toEqual([
      { target: "all", msg: { type: "stroke:clear", userId: "a" } },
    ]);
    expect(hub.usersIn("p1")[0]!.focalLength).toBe(85);
  });
});
