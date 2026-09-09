import type { ServerMessage } from "@shared/protocol";
import { usePresenceStore } from "../store/presence";
import { useSessionStore } from "../store/session";

export function dispatchServerMessage(msg: ServerMessage): void {
  const session = useSessionStore.getState();
  const presence = usePresenceStore.getState();

  switch (msg.type) {
    case "welcome": {
      const color = msg.users.find((user) => user.id === msg.selfId)?.color ?? null;
      session.setSelf(msg.selfId, color);
      presence.applyWelcome(msg.users);
      break;
    }
    case "user:joined":
      presence.upsertUser(msg.user);
      break;
    case "user:left":
      presence.removeUser(msg.userId);
      break;
    case "camera":
      presence.updateCamera(msg.userId, msg.camera);
      break;
    case "error":
      session.setLastError(`${msg.code}: ${msg.message}`);
      break;
    default:
      break;
  }
}
