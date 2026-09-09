import type { ServerMessage } from "@shared/protocol";
import { useSessionStore } from "../store/session";

export function dispatchServerMessage(msg: ServerMessage): void {
  const session = useSessionStore.getState();

  switch (msg.type) {
    case "welcome": {
      const color = msg.users.find((user) => user.id === msg.selfId)?.color ?? null;
      session.setSelf(msg.selfId, color);
      break;
    }
    case "error":
      session.setLastError(`${msg.code}: ${msg.message}`);
      break;
    default:
      break;
  }
}
