import type { ServerMessage } from "@shared/protocol";
import type { CameraState, PresenceUser, Stroke } from "@shared/types";
import { createRoomDisplayState, type RoomDisplayState } from "./room-display";

/** Colors are selected in room-local join order. */
export const PRESENCE_PALETTE: readonly string[] = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export const MAX_ROOM_STROKES = 2000;
export const MAX_ROOMS = 200;
export const MAX_CONNECTIONS = 1000;

export type OutboundTarget = "self" | "others" | "all";
export interface Outbound {
  target: OutboundTarget;
  msg: ServerMessage;
}

export interface Connection {
  projectId: string;
  user?: PresenceUser;
}

export interface Room {
  users: Map<string, PresenceUser>;
  strokes: Map<string, Stroke>;
  display: RoomDisplayState;
}

/** 空のルームを作る。users / strokes / display は呼び出しごとに新しいインスタンス */
export function createRoom(): Room {
  return {
    users: new Map<string, PresenceUser>(),
    strokes: new Map<string, Stroke>(),
    display: createRoomDisplayState(),
  };
}

/** PRESENCE_PALETTE の先頭から最初の未使用色。全色使用済みなら人数で巡回する */
export function colorFor(room: Room): string {
  const used = new Set([...room.users.values()].map((user) => user.color));
  const unused = PRESENCE_PALETTE.find((color) => !used.has(color));
  return unused ?? PRESENCE_PALETTE[room.users.size % PRESENCE_PALETTE.length]!;
}

export function copyCamera(camera: CameraState): CameraState {
  return {
    position: [...camera.position] as CameraState["position"],
    target: [...camera.target] as CameraState["target"],
  };
}

export function copyUser(user: PresenceUser): PresenceUser {
  return { ...user, camera: user.camera ? copyCamera(user.camera) : null };
}

export function copyStroke(stroke: Stroke): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => [...point] as Stroke["points"][number]),
  };
}
