import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage } from "@shared/protocol";
import { WsClient, wsUrl } from "../api/ws";
import { dispatchServerMessage } from "./realtime-dispatch";
import { useSessionStore, type ConnectionStatus } from "../store/session";

export interface Realtime {
  send(msg: ClientMessage): boolean;
}

/** 接続状態を session に反映し、接続時はエラーを消して入室する。 */
export function onRealtimeStatus(
  status: ConnectionStatus,
  name: string,
  send: (msg: ClientMessage) => boolean,
): void {
  const session = useSessionStore.getState();
  session.setConnection(status);
  if (status === "open") {
    session.setLastError(null);
    send({ type: "join", name });
  }
}

export function useRealtime(projectId: string, name: string | null): Realtime {
  const clientRef = useRef<WsClient | null>(null);

  useEffect(() => {
    if (name === null) {
      clientRef.current?.close();
      clientRef.current = null;
      return;
    }

    const client = new WsClient({
      url: wsUrl(projectId),
      onMessage: dispatchServerMessage,
      onStatus: (status) => onRealtimeStatus(status, name, (msg) => client.send(msg)),
    });
    clientRef.current = client;
    client.connect();

    return () => {
      client.close();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [name, projectId]);

  const send = useCallback((msg: ClientMessage) => {
    return clientRef.current?.send(msg) ?? false;
  }, []);

  return { send };
}
