import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RECONNECT_MAX_MS,
  RECONNECT_MIN_MS,
  type SocketLike,
  WsClient,
  wsUrl,
} from "../src/api/ws";

class MockSocket implements SocketLike {
  readyState = 0;
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeClient() {
  const sockets: MockSocket[] = [];
  const statuses: string[] = [];
  const messages: unknown[] = [];
  const client = new WsClient({
    url: "ws://example.test/ws?projectId=p1",
    createSocket: () => {
      const socket = new MockSocket();
      sockets.push(socket);
      return socket;
    },
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
  });
  return { client, sockets, statuses, messages };
}

describe("WsClient", () => {
  it("connects once, sends JSON only while open, and parses server messages", () => {
    const { client, sockets, statuses, messages } = makeClient();
    client.connect();
    client.connect();
    expect(sockets).toHaveLength(1);
    expect(statuses).toEqual(["connecting"]);
    expect(client.send({ type: "stroke:clear" })).toBe(false);

    const socket = sockets[0]!;
    socket.readyState = 1;
    socket.onopen?.();
    expect(statuses).toEqual(["connecting", "open"]);
    expect(client.status).toBe("open");
    expect(client.send({ type: "stroke:clear" })).toBe(true);
    expect(socket.send).toHaveBeenCalledWith('{"type":"stroke:clear"}');

    socket.onmessage?.({
      data: JSON.stringify({ type: "welcome", selfId: "u1", users: [], strokes: [] }),
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ type: "welcome", selfId: "u1", users: [], strokes: [] });
  });

  it("warns and ignores malformed or unknown messages", () => {
    const { client, sockets, messages } = makeClient();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    client.connect();
    const socket = sockets[0]!;
    socket.readyState = 1;
    socket.onopen?.();

    expect(() => socket.onmessage?.({ data: "{not json" })).not.toThrow();
    expect(() => socket.onmessage?.({ data: '{"type":"nope"}' })).not.toThrow();
    expect(messages).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("reconnects with exponential backoff and caps the delay", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      sockets[sockets.length - 1]!.onclose?.();
      vi.advanceTimersByTime(Math.min(RECONNECT_MIN_MS * 2 ** attempt, RECONNECT_MAX_MS) - 1);
      expect(sockets).toHaveLength(attempt + 1);
      vi.advanceTimersByTime(1);
      expect(sockets).toHaveLength(attempt + 2);
    }
  });

  it("starts the delay over after a successful reconnect", () => {
    vi.useFakeTimers();
    const { client, sockets } = makeClient();
    client.connect();
    sockets[0]!.onclose?.();
    vi.advanceTimersByTime(RECONNECT_MIN_MS);
    const reconnected = sockets[1]!;
    reconnected.readyState = 1;
    reconnected.onopen?.();
    reconnected.onclose?.();
    vi.advanceTimersByTime(RECONNECT_MIN_MS - 1);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it("does not reconnect after explicit close or duplicate failure events", () => {
    vi.useFakeTimers();
    const { client, sockets, statuses } = makeClient();
    client.connect();
    const socket = sockets[0]!;
    socket.onerror?.();
    socket.onclose?.();
    expect(statuses).toEqual(["connecting", "closed"]);

    client.close();
    socket.onclose?.();
    vi.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(sockets).toHaveLength(1);
    expect(statuses).toEqual(["connecting", "closed"]);
  });

  it("builds a same-origin websocket URL", () => {
    expect(wsUrl("p1")).toBe(`ws://${location.host}/ws?projectId=p1`);
    expect(wsUrl("a b")).toContain("projectId=a%20b");
  });
});
