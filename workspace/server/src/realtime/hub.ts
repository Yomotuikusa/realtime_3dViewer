import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage } from "@shared/protocol";
import type { CameraState, PresenceUser, Stroke } from "@shared/types";

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

export interface RoomHubOptions {
  now?: () => number;
  newId?: () => string;
  guestDigits?: () => string;
}

interface Connection {
  projectId: string;
  user?: PresenceUser;
}

interface Room {
  users: Map<string, PresenceUser>;
  strokes: Map<string, Stroke>;
}

function defaultGuestDigits(): string {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}

function copyCamera(camera: CameraState): CameraState {
  return {
    position: [...camera.position] as CameraState["position"],
    target: [...camera.target] as CameraState["target"],
  };
}

function copyUser(user: PresenceUser): PresenceUser {
  return { ...user, camera: user.camera ? copyCamera(user.camera) : null };
}

function copyStroke(stroke: Stroke): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => [...point] as Stroke["points"][number]),
  };
}

export class RoomHub {
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly guestDigits: () => string;
  private readonly connections = new Map<string, Connection>();
  private readonly rooms = new Map<string, Room>();

  constructor(options: RoomHubOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.newId = options.newId ?? (() => nanoid(12));
    this.guestDigits = options.guestDigits ?? defaultGuestDigits;
  }

  connect(projectId: string): string | null {
    if (this.connections.size >= MAX_CONNECTIONS) return null;
    const connId = this.newId();
    this.connections.set(connId, { projectId });
    return connId;
  }

  disconnect(connId: string): Outbound[] {
    const connection = this.connections.get(connId);
    if (!connection || !connection.user) {
      this.connections.delete(connId);
      return [];
    }

    const room = this.rooms.get(connection.projectId);
    this.connections.delete(connId);
    if (!room) return [];

    room.users.delete(connId);
    if (room.users.size === 0) this.rooms.delete(connection.projectId);
    return [{ target: "others", msg: { type: "user:left", userId: connId } }];
  }

  handle(connId: string, msg: ClientMessage): Outbound[] {
    const connection = this.connections.get(connId);
    if (!connection) return [];

    if (msg.type === "join") return this.join(connId, connection, msg.name);
    if (!connection.user) return [];

    const room = this.rooms.get(connection.projectId);
    if (!room) return [];

    switch (msg.type) {
      case "camera":
        connection.user.camera = copyCamera(msg.camera);
        return [{
          target: "others",
          msg: { type: "camera", userId: connId, camera: copyCamera(msg.camera) },
        }];
      case "stroke:add":
        return this.addStroke(room, connId, msg.stroke);
      case "stroke:remove":
        return this.removeStroke(room, connId, msg.strokeId);
      case "stroke:clear":
        for (const [strokeId, stroke] of room.strokes) {
          if (stroke.userId === connId) room.strokes.delete(strokeId);
        }
        return [{ target: "all", msg: { type: "stroke:clear", userId: connId } }];
    }
  }

  connectionsIn(projectId: string): string[] {
    const room = this.rooms.get(projectId);
    return room ? [...room.users.keys()] : [];
  }

  projectOf(connId: string): string | null {
    return this.connections.get(connId)?.projectId ?? null;
  }

  usersIn(projectId: string): PresenceUser[] {
    const room = this.rooms.get(projectId);
    return room ? [...room.users.values()].map(copyUser) : [];
  }

  strokesIn(projectId: string): Stroke[] {
    const room = this.rooms.get(projectId);
    return room ? [...room.strokes.values()].map(copyStroke) : [];
  }

  private join(connId: string, connection: Connection, name: string): Outbound[] {
    if (connection.user) {
      return [{
        target: "self",
        msg: { type: "error", code: "BAD_REQUEST", message: "already joined" },
      }];
    }

    const existingRoom = this.rooms.get(connection.projectId);
    if (!existingRoom && this.rooms.size >= MAX_ROOMS) {
      return [{
        target: "self",
        msg: { type: "error", code: "BAD_REQUEST", message: "room limit reached" },
      }];
    }

    const room = existingRoom ?? {
      users: new Map<string, PresenceUser>(),
      strokes: new Map<string, Stroke>(),
    };
    this.rooms.set(connection.projectId, room);

    const trimmedName = name.trim();
    const user: PresenceUser = {
      id: connId,
      name: trimmedName || `Guest-${this.guestDigits()}`,
      color: this.colorFor(room),
      camera: null,
    };
    room.users.set(connId, user);
    connection.user = user;

    return [
      {
        target: "self",
        msg: {
          type: "welcome",
          selfId: connId,
          users: [...room.users.values()].map(copyUser),
          strokes: [...room.strokes.values()].map(copyStroke),
        },
      },
      { target: "others", msg: { type: "user:joined", user: copyUser(user) } },
    ];
  }

  private colorFor(room: Room): string {
    const used = new Set([...room.users.values()].map((user) => user.color));
    const unused = PRESENCE_PALETTE.find((color) => !used.has(color));
    return unused ?? PRESENCE_PALETTE[room.users.size % PRESENCE_PALETTE.length]!;
  }

  private addStroke(room: Room, connId: string, incoming: Stroke): Outbound[] {
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

    const stroke = copyStroke({ ...incoming, userId: connId, createdAt: this.now() });
    room.strokes.set(stroke.id, stroke);
    return [{ target: "all", msg: { type: "stroke:add", stroke: copyStroke(stroke) } }];
  }

  private removeStroke(room: Room, connId: string, strokeId: string): Outbound[] {
    const stroke = room.strokes.get(strokeId);
    if (!stroke || stroke.userId !== connId) return [];
    room.strokes.delete(strokeId);
    return [{ target: "all", msg: { type: "stroke:remove", strokeId } }];
  }
}
