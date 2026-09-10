import type { ServerMessage } from "@shared/protocol";
import { useAnnotationStore } from "../store/annotation";
import { useCommentsStore } from "../store/comments";
import { usePresenceStore } from "../store/presence";
import { useSessionStore } from "../store/session";

export function dispatchServerMessage(msg: ServerMessage): void {
  const session = useSessionStore.getState();
  const presence = usePresenceStore.getState();
  const annotation = useAnnotationStore.getState();
  const comments = useCommentsStore.getState();

  switch (msg.type) {
    case "welcome": {
      const color = msg.users.find((user) => user.id === msg.selfId)?.color ?? null;
      session.setSelf(msg.selfId, color);
      presence.applyWelcome(msg.users);
      annotation.applyWelcome(msg.strokes);
      break;
    }
    case "user:joined":
      presence.upsertUser(msg.user);
      break;
    case "user:left":
      presence.removeUser(msg.userId);
      break;
    case "camera":
      presence.updateCamera(msg.userId, msg.camera, msg.focalLength);
      break;
    case "stroke:add":
      annotation.addStroke(msg.stroke);
      break;
    case "stroke:remove":
      annotation.removeStroke(msg.strokeId);
      break;
    case "stroke:clear":
      annotation.clearByUser(msg.userId);
      break;
    case "comment:created":
    case "comment:updated":
      comments.upsert(msg.comment);
      break;
    case "error":
      session.setLastError(`${msg.code}: ${msg.message}`);
      break;
    default:
      msg satisfies never;
      break;
  }
}
