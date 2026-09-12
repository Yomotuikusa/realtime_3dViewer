import type { Stroke } from "@shared/types";
import { MAX_ROOM_STROKES, copyStroke, type Outbound, type Room } from "./room-state";

/** ストロークを所有者として保存し、追加結果をルーム全員へ返す。 */
export function addStroke(room: Room, connId: string, incoming: Stroke, now: number): Outbound[] {
  const existingStroke = room.strokes.get(incoming.id);
  if (existingStroke && existingStroke.userId !== connId) {
    return [{
      target: "self",
      msg: { type: "error", code: "BAD_REQUEST", message: "stroke owned by another user" },
    }];
  }
  if (!existingStroke && room.strokes.size >= MAX_ROOM_STROKES) {
    return [{
      target: "self",
      msg: { type: "error", code: "BAD_REQUEST", message: "room stroke limit reached" },
    }];
  }

  const stroke = copyStroke({ ...incoming, userId: connId, createdAt: now });
  room.strokes.set(stroke.id, stroke);
  return [{ target: "all", msg: { type: "stroke:add", stroke: copyStroke(stroke) } }];
}

/** 所有者のストロークだけを削除する。 */
export function removeStroke(room: Room, connId: string, strokeId: string): Outbound[] {
  const stroke = room.strokes.get(strokeId);
  if (!stroke || stroke.userId !== connId) return [];
  room.strokes.delete(strokeId);
  return [{ target: "all", msg: { type: "stroke:remove", strokeId } }];
}

/** 所有者のストロークだけを消し、clear は常にルーム全員へ通知する。 */
export function clearStrokes(room: Room, connId: string): Outbound[] {
  for (const [strokeId, stroke] of room.strokes) {
    if (stroke.userId === connId) room.strokes.delete(strokeId);
  }
  return [{ target: "all", msg: { type: "stroke:clear", userId: connId } }];
}
