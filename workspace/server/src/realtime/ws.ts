import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "@shared/protocol";
import type { Outbound, RoomHub } from "./hub";

/** Same-connection schema violations before the server closes with 1008. */
export const MAX_CONSECUTIVE_ERRORS = 20;

export interface Realtime {
  /** Broadcast to all joined users in a project. */
  publish(projectId: string, msg: ServerMessage): void;
  /** Close the WebSocket server. */
  close(): Promise<void>;
}

interface SocketConnection {
  projectId: string;
  socket: WebSocket;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logSendFailure(error: unknown): void {
  console.error(JSON.stringify({
    level: "error",
    msg: "realtime_send_failed",
    error: errorMessage(error),
  }));
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(msg), (error) => {
      if (error) logSendFailure(error);
    });
  } catch (error) {
    logSendFailure(error);
  }
}

function projectIdFromRequest(request: IncomingMessage): string | null {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const projectId = url.searchParams.get("projectId");
    return projectId === null || projectId === "" ? null : projectId;
  } catch {
    return null;
  }
}

export function attachRealtime(server: Server, hub: RoomHub): Realtime {
  const sockets = new Map<string, SocketConnection>();
  const wss = new WebSocketServer({ server, path: "/ws" });
  let closePromise: Promise<void> | null = null;

  const sendOutbound = (sourceId: string, projectId: string, outbound: Outbound): void => {
    const targets = outbound.target === "self"
      ? [sourceId]
      : hub.connectionsIn(projectId).filter((connId) =>
        outbound.target === "all" || connId !== sourceId,
      );
    for (const connId of targets) {
      const connection = sockets.get(connId);
      if (connection) send(connection.socket, outbound.msg);
    }
  };

  const sendOutbounds = (sourceId: string, projectId: string, outbounds: Outbound[]): void => {
    for (const outbound of outbounds) sendOutbound(sourceId, projectId, outbound);
  };

  wss.on("connection", (socket, request) => {
    const projectId = projectIdFromRequest(request);
    if (projectId === null) {
      send(socket, {
        type: "error",
        code: "BAD_REQUEST",
        message: "projectId query parameter is required",
      });
      socket.close(1008);
      return;
    }

    const connId = hub.connect(projectId);
    sockets.set(connId, { projectId, socket });
    let consecutiveErrors = 0;
    let finalized = false;

    const finalize = (): void => {
      if (finalized) return;
      finalized = true;
      sockets.delete(connId);
      sendOutbounds(connId, projectId, hub.disconnect(connId));
    };

    socket.on("message", (data) => {
      const parsed = parseClientMessage(String(data));
      if (!parsed.ok) {
        consecutiveErrors += 1;
        send(socket, { type: "error", code: "VALIDATION", message: parsed.error });
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) socket.close(1008);
        return;
      }

      consecutiveErrors = 0;
      sendOutbounds(connId, projectId, hub.handle(connId, parsed.msg));
    });
    socket.on("close", finalize);
    socket.on("error", finalize);
  });

  return {
    publish(projectId, msg) {
      if (closePromise) return;
      for (const connId of hub.connectionsIn(projectId)) {
        const connection = sockets.get(connId);
        if (connection) send(connection.socket, msg);
      }
    },
    close() {
      if (closePromise) return closePromise;
      closePromise = new Promise<void>((resolve, reject) => {
        for (const { socket } of sockets.values()) socket.close(1001);
        wss.close((error) => error ? reject(error) : resolve());
      });
      return closePromise;
    },
  };
}
