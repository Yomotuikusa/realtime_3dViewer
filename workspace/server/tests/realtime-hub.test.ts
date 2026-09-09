import { describe, expect, it } from "vitest";
import type { CameraState, Stroke } from "@shared/types";
import {
  MAX_ROOM_STROKES,
  PRESENCE_PALETTE,
  RoomHub,
} from "../src/realtime/hub";

const camera: CameraState = { position: [1, 2, 3], target: [4, 5, 6] };

function stroke(id: string, userId = "spoofed", createdAt = 1): Stroke {
  return {
    id,
    userId,
    color: "#ff8800",
    points: [[0, 0, 0], [1, 1, 1]],
    createdAt,
  };
}

function join(hub: RoomHub, connId: string, name: string) {
  return hub.handle(connId, { type: "join", name });
}

describe("RoomHub", () => {
  it("registers connections before join and reports only joined connections", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    expect(hub.connect("p1")).toBe("a");
    expect(hub.connect("p1")).toBe("b");
    expect(hub.projectOf("a")).toBe("p1");
    expect(hub.usersIn("p1")).toEqual([]);
    expect(hub.connectionsIn("p1")).toEqual([]);
    expect(hub.disconnect("a")).toEqual([]);
    expect(hub.projectOf("a")).toBeNull();
  });

  it("welcomes a user and broadcasts the joined user", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(join(hub, "a", "Rin")).toEqual([
      {
        target: "self",
        msg: {
          type: "welcome",
          selfId: "a",
          users: [{ id: "a", name: "Rin", color: PRESENCE_PALETTE[0], camera: null }],
          strokes: [],
        },
      },
      {
        target: "others",
        msg: {
          type: "user:joined",
          user: { id: "a", name: "Rin", color: PRESENCE_PALETTE[0], camera: null },
        },
      },
    ]);
    expect(hub.connectionsIn("p1")).toEqual(["a"]);
  });

  it("keeps welcome users in join order and reuses colors after departure", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    hub.connect("p1");
    hub.connect("p1");
    join(hub, "a", "A");
    hub.handle("a", { type: "stroke:add", stroke: stroke("existing") });
    const bWelcome = join(hub, "b", "B");
    expect(bWelcome[0]).toMatchObject({
      target: "self",
      msg: {
        type: "welcome",
        users: [{ id: "a" }, { id: "b", color: PRESENCE_PALETTE[1] }],
        strokes: [{ id: "existing", userId: "a" }],
      },
    });
    expect(join(hub, "b", "B")).toEqual([
      { target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "already joined" } },
    ]);
    const b = hub.usersIn("p1").find((user) => user.id === "b");
    expect(b?.color).toBe(PRESENCE_PALETTE[1]);
    expect(hub.usersIn("p1")).toHaveLength(2);
    hub.disconnect("a");
    const welcome = join(hub, "c", "C");
    expect(welcome[0]).toMatchObject({
      target: "self",
      msg: { type: "welcome", users: [{ id: "b" }, { id: "c" }] },
    });
    expect(hub.usersIn("p1").find((user) => user.id === "c")).toMatchObject({
      id: "c",
      color: PRESENCE_PALETTE[0],
    });
  });

  it("assigns a fallback color when all eight palette colors are used", () => {
    const ids = Array.from({ length: 9 }, (_, index) => String(index));
    const hub = new RoomHub({ newId: () => ids.shift()! });
    for (let index = 0; index < 9; index += 1) {
      hub.connect("p1");
      join(hub, String(index), String(index));
    }
    expect(hub.usersIn("p1")[8]).toMatchObject({ color: PRESENCE_PALETTE[0] });
  });

  it("normalizes names and creates guest names", () => {
    const ids = ["guest", "named"];
    const hub = new RoomHub({ newId: () => ids.shift()!, guestDigits: () => "0042" });
    hub.connect("p1");
    hub.connect("p1");
    join(hub, "guest", "   ");
    join(hub, "named", "  Rin  ");
    expect(hub.usersIn("p1").map((user) => user.name)).toEqual(["Guest-0042", "Rin"]);
  });

  it("ignores non-join messages before join and unknown connections", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    expect(hub.handle("a", { type: "camera", camera })).toEqual([]);
    expect(hub.handle("a", { type: "stroke:add", stroke: stroke("x") })).toEqual([]);
    expect(hub.handle("a", { type: "stroke:clear" })).toEqual([]);
    expect(hub.handle("zz", { type: "stroke:clear" })).toEqual([]);
    expect(hub.disconnect("zz")).toEqual([]);
    expect(hub.strokesIn("p1")).toEqual([]);
  });

  it("updates camera and keeps projects isolated", () => {
    const ids = ["a", "d"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    hub.connect("p2");
    join(hub, "a", "A");
    join(hub, "d", "D");
    expect(hub.handle("a", { type: "camera", camera })).toEqual([
      { target: "others", msg: { type: "camera", userId: "a", camera } },
    ]);
    expect(hub.usersIn("p1")[0]!).toMatchObject({ camera });
    expect(hub.connectionsIn("p2")).toEqual(["d"]);
    expect(hub.usersIn("p1").some((user) => user.id === "d")).toBe(false);
  });

  it("overwrites stroke ownership and timestamps, including duplicate ids", () => {
    let time = 10;
    const hub = new RoomHub({ newId: () => "a", now: () => time++ });
    hub.connect("p1");
    join(hub, "a", "A");
    const first = hub.handle("a", { type: "stroke:add", stroke: stroke("same", "b", 1) });
    expect(first[0]).toMatchObject({ target: "all", msg: { type: "stroke:add", stroke: { userId: "a", createdAt: 10 } } });
    expect(hub.handle("a", { type: "stroke:add", stroke: stroke("same", "b", 2) })).toEqual([
      {
        target: "all",
        msg: { type: "stroke:add", stroke: { ...stroke("same", "a", 11), createdAt: 11 } },
      },
    ]);
    expect(hub.strokesIn("p1")).toMatchObject([{ id: "same", userId: "a", createdAt: 11 }]);
  });

  it("rejects stroke additions at the room limit", () => {
    const hub = new RoomHub({ newId: () => "a" });
    hub.connect("p1");
    join(hub, "a", "A");
    for (let index = 0; index < MAX_ROOM_STROKES; index += 1) {
      hub.handle("a", { type: "stroke:add", stroke: stroke(`stroke-${index}`) });
    }
    const result = hub.handle("a", { type: "stroke:add", stroke: stroke("overflow") });
    expect(result).toEqual([
      { target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "room stroke limit reached" } },
    ]);
    expect(hub.handle("a", { type: "stroke:add", stroke: stroke("stroke-0") })).toMatchObject([
      { target: "all", msg: { type: "stroke:add", stroke: { id: "stroke-0" } } },
    ]);
    expect(hub.strokesIn("p1")).toHaveLength(MAX_ROOM_STROKES);
  });

  it("only lets an owner remove a stroke and clear its own strokes", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    hub.connect("p1");
    join(hub, "a", "A");
    join(hub, "b", "B");
    hub.handle("a", { type: "stroke:add", stroke: stroke("a1") });
    hub.handle("a", { type: "stroke:add", stroke: stroke("a2") });
    hub.handle("b", { type: "stroke:add", stroke: stroke("b1") });
    expect(hub.handle("b", { type: "stroke:remove", strokeId: "a1" })).toEqual([]);
    expect(hub.handle("a", { type: "stroke:remove", strokeId: "missing" })).toEqual([]);
    expect(hub.handle("a", { type: "stroke:remove", strokeId: "a1" })).toEqual([
      { target: "all", msg: { type: "stroke:remove", strokeId: "a1" } },
    ]);
    expect(hub.handle("a", { type: "stroke:clear" })).toEqual([
      { target: "all", msg: { type: "stroke:clear", userId: "a" } },
    ]);
    expect(hub.strokesIn("p1")).toMatchObject([{ id: "b1", userId: "b" }]);
    expect(hub.handle("a", { type: "stroke:clear" })).toEqual([
      { target: "all", msg: { type: "stroke:clear", userId: "a" } },
    ]);
  });

  it("leaves strokes on departure, then destroys an empty room", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    hub.connect("p1");
    join(hub, "a", "A");
    join(hub, "b", "B");
    hub.handle("a", { type: "stroke:add", stroke: stroke("a1") });
    expect(hub.disconnect("a")).toEqual([{ target: "others", msg: { type: "user:left", userId: "a" } }]);
    expect(hub.usersIn("p1").some((user) => user.id === "a")).toBe(false);
    expect(hub.strokesIn("p1")).toMatchObject([{ id: "a1", userId: "a" }]);
    expect(hub.disconnect("a")).toEqual([]);
    expect(hub.disconnect("b")).toEqual([{ target: "others", msg: { type: "user:left", userId: "b" } }]);
    hub.connect("p1");
    expect(join(hub, "c", "C")[0]).toMatchObject({ target: "self", msg: { strokes: [] } });
  });
});
