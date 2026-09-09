import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage } from "@shared/protocol";
import { WsClient, wsUrl } from "../api/ws";
import { dispatchServerMessage } from "./realtime-dispatch";
import { useSessionStore } from "../store/session";

export interface Realtime {
  send(msg: ClientMessage): boolean;
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
      onStatus: (status) => {
        useSessionStore.getState().setConnection(status);
        if (status === "open") {
          client.send({ type: "join", name });
        }
      },
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
