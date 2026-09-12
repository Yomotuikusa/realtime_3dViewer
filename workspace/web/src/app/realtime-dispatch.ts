import type { ServerMessage } from "@shared/protocol";
import { DEFAULT_MESH_COMPARE, DEFAULT_MESH_DISPLAY } from "@shared/types";
import { useAnnotationStore } from "../store/annotation";
import { useCommentsStore } from "../store/comments";
import { useDisplayStore } from "../store/display";
import { useLightingStore } from "../store/lighting";
import { useObjectsStore } from "../store/objects";
import { usePresenceStore } from "../store/presence";
import { useSessionStore } from "../store/session";

export function dispatchServerMessage(msg: ServerMessage): void {
  const session = useSessionStore.getState();
  const presence = usePresenceStore.getState();
  const annotation = useAnnotationStore.getState();
  const comments = useCommentsStore.getState();
  const display = useDisplayStore.getState();
  const lighting = useLightingStore.getState();
  const objects = useObjectsStore.getState();

  switch (msg.type) {
    case "welcome": {
      const color = msg.users.find((user) => user.id === msg.selfId)?.color ?? null;
      session.setSelf(msg.selfId, color);
      presence.applyWelcome(msg.users);
      annotation.applyWelcome(msg.strokes);
      if (msg.light !== undefined) {
        lighting.applyRemote(msg.light);
      }
      objects.applyWelcome(msg.hiddenObjectIds ?? []);
      display.setMeshDisplay(msg.meshDisplay ?? DEFAULT_MESH_DISPLAY);
      display.setMeshCompare(msg.meshCompare ?? DEFAULT_MESH_COMPARE);
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
    case "light":
      lighting.applyRemote(msg.angles);
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
    case "object:visibility":
      objects.setVisible(msg.versionId, msg.visible);
      break;
    case "object:added":
      objects.append(msg.version);
      break;
    case "mesh:display":
      display.setMeshDisplay(msg.mode);
      break;
    case "mesh:compare":
      display.setMeshCompare(msg.compare);
      break;
    case "object:part-visibility":
      // 仮の分岐。ストアへの反映は 101 が実装する
      break;
    case "error":
      session.setLastError(`${msg.code}: ${msg.message}`);
      break;
    default:
      msg satisfies never;
      break;
  }
}
