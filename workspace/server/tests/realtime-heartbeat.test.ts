import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { RealtimeFixture } from "./helpers/ws";
import { startRealtime } from "./helpers/ws";

const fixtures: RealtimeFixture[] = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.cleanup();
});

async function join(
  fixture: RealtimeFixture,
  projectId: string,
  name: string,
  clientOptions?: { autoPong?: boolean },
): Promise<{ ws: WebSocket; id: string }> {
  const ws = await fixture.open(projectId, clientOptions);
  ws.send(JSON.stringify({ type: "join", name }));
  const welcome = await fixture.next(ws);
  if (welcome.type !== "welcome") throw new Error("join did not produce welcome");
  return { ws, id: welcome.selfId };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("WebSocket heartbeat", () => {
  it("terminates an unresponsive joined client, broadcasts departure, and frees its slot", async () => {
    const fixture = await startRealtime({ heartbeatIntervalMs: 50 });
    fixtures.push(fixture);
    const a = await join(fixture, "p1", "A");
    const b = await join(fixture, "p1", "B", { autoPong: false });
    expect((await fixture.next(a.ws)).type).toBe("user:joined");

    const left = fixture.next(a.ws, 300);
    await expect(fixture.closed(b.ws, 300)).resolves.toBe(1006);
    expect(await left).toEqual({ type: "user:left", userId: b.id });
    expect(fixture.hub.connectionsIn("p1")).toEqual([a.id]);
  });

  it("keeps a client that responds to ping alive", async () => {
    const fixture = await startRealtime({ heartbeatIntervalMs: 50 });
    fixtures.push(fixture);
    const client = await join(fixture, "p1", "A");

    await waitMs(300);
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    expect(fixture.hub.connectionsIn("p1")).toEqual([client.id]);
    await expect(fixture.next(client.ws, 50)).rejects.toThrow("timeout");
  });

  it("does not terminate clients when the heartbeat is disabled", async () => {
    const fixture = await startRealtime({ heartbeatIntervalMs: 0 });
    fixtures.push(fixture);
    const client = await join(fixture, "p1", "A", { autoPong: false });

    await waitMs(300);
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    expect(fixture.hub.connectionsIn("p1")).toEqual([client.id]);
  });

  it("does not create a heartbeat timer for intervals below one millisecond", async () => {
    const fixture = await startRealtime({ heartbeatIntervalMs: 0.5 });
    fixtures.push(fixture);
    const client = await join(fixture, "p1", "A", { autoPong: false });

    await waitMs(300);
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    expect(fixture.hub.connectionsIn("p1")).toEqual([client.id]);
  });
});
