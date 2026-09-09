import { createServer, type Server } from "node:http";
import { attachRealtime, type Realtime, type RealtimeOptions } from "../../src/realtime/ws";
import { RoomHub } from "../../src/realtime/hub";
import type { ServerMessage } from "@shared/protocol";
import { WebSocket, type RawData } from "ws";

interface MessageWaiter {
  resolve: (message: ServerMessage) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RealtimeFixture {
  url: string;
  hub: RoomHub;
  realtime: Realtime;
  open(projectId?: string): Promise<WebSocket>;
  next(ws: WebSocket, timeoutMs?: number): Promise<ServerMessage>;
  closed(ws: WebSocket, timeoutMs?: number): Promise<number>;
  cleanup(): Promise<void>;
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

function waitForClose(ws: WebSocket, timeoutMs: number, closeCodes: Map<WebSocket, number>): Promise<number> {
  if (ws.readyState === WebSocket.CLOSED) return Promise.resolve(closeCodes.get(ws) ?? 1000);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener("close", onClose);
      reject(new Error(`WebSocket did not close within ${timeoutMs}ms`));
    }, timeoutMs);
    const onClose = (code: number): void => {
      clearTimeout(timer);
      resolve(code);
    };
    ws.once("close", onClose);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export function startRealtime(options?: Partial<RealtimeOptions>): Promise<RealtimeFixture> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected an ephemeral TCP address"));
        return;
      }

      const hub = new RoomHub();
      const realtime = attachRealtime(server, hub, {
        projectExists: options?.projectExists ?? (() => true),
      });
      const clients: WebSocket[] = [];
      const closeCodes = new Map<WebSocket, number>();
      const messageQueues = new Map<WebSocket, RawData[]>();
      const messageWaiters = new Map<WebSocket, MessageWaiter>();
      const fixture: RealtimeFixture = {
        url: `ws://127.0.0.1:${address.port}/ws`,
        hub,
        realtime,
        async open(projectId) {
          const query = projectId === undefined ? "" : `?projectId=${encodeURIComponent(projectId)}`;
          const ws = new WebSocket(`${this.url}${query}`);
          clients.push(ws);
          messageQueues.set(ws, []);
          ws.on("message", (data: RawData) => {
            const waiter = messageWaiters.get(ws);
            if (waiter) {
              clearTimeout(waiter.timer);
              messageWaiters.delete(ws);
              waiter.resolve(JSON.parse(String(data)) as ServerMessage);
              return;
            }
            messageQueues.get(ws)?.push(data);
          });
          ws.on("close", (code) => closeCodes.set(ws, code));
          await waitForOpen(ws);
          return ws;
        },
        next(ws, timeoutMs = 1000) {
          const queued = messageQueues.get(ws)?.shift();
          if (queued !== undefined) return Promise.resolve(JSON.parse(String(queued)) as ServerMessage);
          return new Promise((resolveNext, rejectNext) => {
            const timer = setTimeout(() => {
              messageWaiters.delete(ws);
              rejectNext(new Error(`WebSocket message timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            messageWaiters.set(ws, { resolve: resolveNext, timer });
          });
        },
        closed(ws, timeoutMs = 1000) {
          return waitForClose(ws, timeoutMs, closeCodes);
        },
        async cleanup() {
          const waits = clients
            .filter((ws) => ws.readyState !== WebSocket.CLOSED)
            .map((ws) => {
              ws.close();
              return waitForClose(ws, 1000, closeCodes).catch(() => undefined);
            });
          await Promise.all(waits);
          await realtime.close();
          await closeServer(server);
        },
      };
      resolve(fixture);
    });
  });
}
