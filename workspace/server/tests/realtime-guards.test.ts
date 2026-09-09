import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { Stroke } from "@shared/types";
import {
  MAX_CONNECTIONS,
  MAX_ROOM_STROKES,
  MAX_ROOMS,
  RoomHub,
} from "../src/realtime/hub";
import { MAX_WS_PAYLOAD_BYTES } from "../src/realtime/ws";
import type { RealtimeFixture } from "./helpers/ws";
import { startRealtime } from "./helpers/ws";

const fixtures: RealtimeFixture[] = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.cleanup();
});

function testStroke(id: string, userId = "client", points: Stroke["points"] = [[0, 0, 0], [1, 1, 1]]): Stroke {
  return { id, userId, color: "#22c55e", points, createdAt: 1 };
}

function join(hub: RoomHub, connId: string): void {
  expect(hub.handle(connId, { type: "join", name: connId })).toHaveLength(2);
}

async function openWithOrigin(url: string, origin: string): Promise<{
  ws: WebSocket;
  message: Promise<Record<string, unknown>>;
  closed: Promise<number>;
}> {
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  ws.on("error", () => undefined);
  const message = new Promise<Record<string, unknown>>((resolve) => {
    ws.once("message", (data) => resolve(JSON.parse(String(data)) as Record<string, unknown>));
  });
  const closed = new Promise<number>((resolve) => ws.once("close", resolve));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return { ws, message, closed };
}

describe("realtime connection and state guards", () => {
  it("rejects unknown projects before registering a hub connection", async () => {
    const value = await startRealtime({ projectExists: () => false });
    fixtures.push(value);
    const ws = await value.open("missing");
    expect(await value.next(ws)).toEqual({
      type: "error",
      code: "NOT_FOUND",
      message: "Project not found",
    });
    expect(await value.closed(ws)).toBe(1008);
    expect(value.hub.connectionsIn("missing")).toEqual([]);
  });

  it("allows a same-host Origin and rejects foreign or malformed Origins", async () => {
    const value = await startRealtime();
    fixtures.push(value);
    const sameHost = await openWithOrigin(value.url, new URL(value.url).origin);
    sameHost.ws.send(JSON.stringify({ type: "join", name: "same-host" }));
    expect((await sameHost.message).type).toBe("welcome");
    sameHost.ws.close();
    await sameHost.closed;

    for (const origin of ["http://evil.example", "null", "not a URL"]) {
      const rejected = await openWithOrigin(value.url, origin);
      expect(await rejected.message).toEqual({
        type: "error",
        code: "BAD_REQUEST",
        message: "origin not allowed",
      });
      expect(await rejected.closed).toBe(1008);
    }
  });

  it("rejects a connection when the process connection limit is full", async () => {
    const value = await startRealtime();
    fixtures.push(value);
    for (let index = 0; index < MAX_CONNECTIONS; index += 1) {
      expect(value.hub.connect("p1")).not.toBeNull();
    }
    const ws = await value.open("p1");
    expect(await value.next(ws)).toEqual({
      type: "error",
      code: "BAD_REQUEST",
      message: "connection limit reached",
    });
    expect(await value.closed(ws)).toBe(1013);
  });

  it("enforces connection slots and returns one after disconnect", () => {
    const hub = new RoomHub();
    const ids: string[] = [];
    for (let index = 0; index < MAX_CONNECTIONS; index += 1) {
      const id = hub.connect(`p${index}`);
      expect(id).not.toBeNull();
      if (id) ids.push(id);
    }
    expect(hub.connect("overflow")).toBeNull();
    hub.disconnect(ids[0]!);
    expect(hub.connect("reopened")).not.toBeNull();
  });

  it("rejects a new room at the room limit without creating its user", () => {
    const hub = new RoomHub();
    for (let index = 0; index < MAX_ROOMS; index += 1) {
      const connId = hub.connect(`p${index}`)!;
      join(hub, connId);
    }
    const blocked = hub.connect("blocked")!;
    expect(hub.handle(blocked, { type: "join", name: "blocked" })).toEqual([
      { target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "room limit reached" } },
    ]);
    expect(hub.usersIn("blocked")).toEqual([]);

    const existing = hub.connect("p0")!;
    expect(hub.handle(existing, { type: "join", name: "existing" })[0]?.msg.type).toBe("welcome");
    hub.disconnect(existing);
    hub.disconnect(hub.connectionsIn("p0")[0]!);
    const reopened = hub.connect("reopened")!;
    expect(hub.handle(reopened, { type: "join", name: "reopened" })[0]?.msg.type).toBe("welcome");
  });

  it("protects stroke ownership and keeps the owner's replacement behavior", () => {
    const hub = new RoomHub({ newId: (() => { const ids = ["a", "b"]; return () => ids.shift()!; })() });
    const a = hub.connect("p1")!;
    const b = hub.connect("p1")!;
    join(hub, a);
    join(hub, b);
    hub.handle(a, { type: "stroke:add", stroke: testStroke("s1") });
    expect(hub.handle(b, { type: "stroke:add", stroke: testStroke("s1", "spoof") })).toEqual([
      { target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "stroke owned by another user" } },
    ]);
    expect(hub.strokesIn("p1")).toMatchObject([{ id: "s1", userId: a }]);
    expect(hub.handle(a, { type: "stroke:add", stroke: testStroke("s1", "replacement") })[0]?.target).toBe("all");
    expect(hub.handle(b, { type: "stroke:remove", strokeId: "s1" })).toEqual([]);
  });

  it("accepts a 2000-point stroke and removes oversized frames with 1009", async () => {
    const value = await startRealtime();
    fixtures.push(value);
    const ws = await value.open("p1");
    ws.send(JSON.stringify({ type: "join", name: "large" }));
    const welcome = await value.next(ws);
    if (welcome.type !== "welcome") throw new Error("join did not produce welcome");
    const points = Array.from({ length: MAX_ROOM_STROKES }, (_, index) => [index, index + 1, index + 2] as [number, number, number]);
    ws.send(JSON.stringify({ type: "stroke:add", stroke: testStroke("large", "ignored", points) }));
    const added = await value.next(ws);
    expect(added).toMatchObject({ type: "stroke:add", stroke: { id: "large", userId: welcome.selfId } });
    if (added.type !== "stroke:add") throw new Error("stroke was not broadcast");
    expect(added.stroke.points).toHaveLength(MAX_ROOM_STROKES);

    const oversized = Buffer.alloc(MAX_WS_PAYLOAD_BYTES + 1, 120);
    ws.send(oversized);
    expect(await value.closed(ws, 2000)).toBe(1009);
    expect(value.hub.projectOf(welcome.selfId)).toBeNull();
  });
});
