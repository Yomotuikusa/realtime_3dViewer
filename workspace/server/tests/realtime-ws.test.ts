import { afterEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import type { CameraState } from "@shared/types";
import { MAX_CONSECUTIVE_ERRORS } from "../src/realtime/ws";
import type { RealtimeFixture } from "./helpers/ws";
import { startRealtime } from "./helpers/ws";

const fixtures: RealtimeFixture[] = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.cleanup();
});

async function fixture(): Promise<RealtimeFixture> {
  const value = await startRealtime();
  fixtures.push(value);
  return value;
}

async function joined(
  value: RealtimeFixture,
  projectId = "p1",
): Promise<{ a: WebSocket; b: WebSocket; aId: string; bId: string }> {
  const a = await value.open(projectId);
  a.send(JSON.stringify({ type: "join", name: "Rin" }));
  const welcomeA = await value.next(a);
  const b = await value.open(projectId);
  b.send(JSON.stringify({ type: "join", name: "Mao" }));
  const joinedA = await value.next(a);
  const welcomeB = await value.next(b);
  expect(joinedA.type).toBe("user:joined");
  expect(welcomeB.type).toBe("welcome");
  if (welcomeA.type !== "welcome" || welcomeB.type !== "welcome") {
    throw new Error("join did not produce welcome messages");
  }
  expect(welcomeA.users).toHaveLength(1);
  expect(welcomeB.users).toHaveLength(2);
  expect(joinedA).toMatchObject({ type: "user:joined", user: { id: welcomeB.selfId } });
  if (joinedA.type === "user:joined") expect(joinedA.user.color).toMatch(/^#[0-9a-f]{6}$/i);
  return { a, b, aId: welcomeA.selfId, bId: welcomeB.selfId };
}

const camera: CameraState = { position: [1, 2, 3], target: [0, 1, 0] };
const stroke = {
  id: "stroke-1",
  userId: "client-supplied",
  color: "#22c55e",
  points: [[0, 0, 0], [1, 1, 1]],
  createdAt: 0,
};

describe("realtime WebSocket bridge", () => {
  it("welcomes users and broadcasts presence, camera, strokes, and departure", async () => {
    const value = await fixture();
    const { a, b, aId, bId } = await joined(value);

    b.send(JSON.stringify({ type: "camera", camera }));
    expect(await value.next(a)).toEqual({ type: "camera", userId: bId, camera });
    await expect(value.next(b)).rejects.toThrow("timeout");

    b.send(JSON.stringify({ type: "stroke:add", stroke }));
    expect(await value.next(a)).toMatchObject({ type: "stroke:add", stroke: { userId: bId } });
    expect(await value.next(b)).toMatchObject({ type: "stroke:add", stroke: { userId: bId } });

    const left = value.next(a);
    b.close();
    await value.closed(b);
    expect(await left).toEqual({ type: "user:left", userId: bId });
    expect(aId).not.toBe(bId);
  });

  it("rejects a missing projectId with BAD_REQUEST and 1008", async () => {
    const value = await fixture();
    for (const projectId of [undefined, ""]) {
      const ws = await value.open(projectId);
      const error = value.next(ws);
      const closed = value.closed(ws);
      expect(await error).toMatchObject({ type: "error", code: "BAD_REQUEST" });
      expect(await closed).toBe(1008);
    }
  });

  it("ignores non-join messages before join", async () => {
    const value = await fixture();
    const ws = await value.open("p1");
    ws.send(JSON.stringify({ type: "camera", camera }));
    await expect(value.next(ws)).rejects.toThrow("timeout");
  });

  it("returns validation errors and resets the consecutive error count after valid input", async () => {
    const value = await fixture();
    const ws = await value.open("p1");
    for (let index = 0; index < MAX_CONSECUTIVE_ERRORS - 1; index += 1) {
      ws.send(index === 0 ? "{not json" : '{"type":"nope"}');
      const error = await value.next(ws);
      expect(error).toMatchObject({ type: "error", code: "VALIDATION" });
      expect((error as { message: string }).message).not.toBe("");
    }
    ws.send(JSON.stringify({ type: "join", name: "Rin" }));
    expect((await value.next(ws)).type).toBe("welcome");
    ws.send('{"type":"nope"}');
    expect(await value.next(ws)).toMatchObject({ type: "error", code: "VALIDATION" });
    expect(ws.readyState).toBe(1);
  });

  it("closes after the twentieth consecutive validation error", async () => {
    const value = await fixture();
    const ws = await value.open("p1");
    const closed = value.closed(ws, 2000);
    for (let index = 0; index < MAX_CONSECUTIVE_ERRORS; index += 1) {
      ws.send('{"type":"nope"}');
      expect(await value.next(ws, 2000)).toMatchObject({ type: "error", code: "VALIDATION" });
    }
    expect(await closed).toBe(1008);
  });

  it("publishes only to joined users in the requested project and tolerates close", async () => {
    const value = await fixture();
    const { a, b } = await joined(value);
    const waiting = await value.open("p1");
    const other = await value.open("p2");
    other.send(JSON.stringify({ type: "join", name: "Other" }));
    expect((await value.next(other)).type).toBe("welcome");
    expect(() => value.realtime.publish("nobody", { type: "stroke:clear", userId: "nobody" })).not.toThrow();
    value.realtime.publish("p1", {
      type: "comment:created",
      comment: {
        id: "c1", projectId: "p1", versionId: "v1", authorName: "Rin", body: "Hi",
        anchor: [0, 0, 0], camera, strokes: [], status: "open", createdAt: 1, updatedAt: 1,
      },
    });
    expect((await value.next(a)).type).toBe("comment:created");
    expect((await value.next(b)).type).toBe("comment:created");
    await expect(value.next(waiting)).rejects.toThrow("timeout");
    await expect(value.next(other)).rejects.toThrow("timeout");
    await value.realtime.close();
    expect(() => value.realtime.publish("p1", { type: "stroke:clear", userId: "nobody" })).not.toThrow();
  });

  it("broadcasts stroke clear to every joined user", async () => {
    const value = await fixture();
    const { a, b, bId } = await joined(value);
    b.send(JSON.stringify({ type: "stroke:clear" }));
    expect(await value.next(a)).toEqual({ type: "stroke:clear", userId: bId });
    expect(await value.next(b)).toEqual({ type: "stroke:clear", userId: bId });
  });
});
