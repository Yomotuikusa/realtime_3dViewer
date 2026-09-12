import { nanoid } from "nanoid";
import type { ClientMessage } from "@shared/protocol";
import type { CameraState, JointDisplay, MeshCompare, MeshDisplayMode, ObjectPartRef, PresenceUser, Stroke } from "@shared/types";
import { cloneMotionTrail, type MotionTrail } from "@shared/trail";
import {
  applyDisplayMessage,
  displayWelcomeFields,
  hiddenPartsOf,
} from "./room-display";
import { addStroke, clearStrokes, removeStroke } from "./room-strokes";
import {
  colorFor,
  copyCamera,
  copyStroke,
  copyUser,
  createRoom,
  MAX_CONNECTIONS,
  MAX_ROOMS,
  type Connection,
  type Outbound,
  type Room,
} from "./room-state";

export { MAX_CONNECTIONS, MAX_ROOMS, MAX_ROOM_STROKES, PRESENCE_PALETTE } from "./room-state";
export type { Outbound, OutboundTarget } from "./room-state";

export interface RoomHubOptions {
  now?: () => number;
  newId?: () => string;
  guestDigits?: () => string;
}

function defaultGuestDigits(): string {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
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
      case "camera": {
        connection.user.camera = copyCamera(msg.camera);
        if (msg.focalLength !== undefined) {
          connection.user.focalLength = msg.focalLength;
        }
        const focalLength = connection.user.focalLength;
        return [{
          target: "others",
          msg: focalLength === undefined
            ? { type: "camera", userId: connId, camera: copyCamera(msg.camera) }
            : { type: "camera", userId: connId, camera: copyCamera(msg.camera), focalLength },
        }];
      }
      case "light":
      case "object:visibility":
      case "object:part-visibility":
      case "mesh:display":
      case "mesh:compare":
      case "joint:display":
      case "trail:display":
        return [{ target: "others", msg: applyDisplayMessage(room.display, connId, msg) }];
      case "stroke:add":
        return addStroke(room, connId, msg.stroke, this.now());
      case "stroke:remove":
        return removeStroke(room, connId, msg.strokeId);
      case "stroke:clear":
        return clearStrokes(room, connId);
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

  hiddenObjectsIn(projectId: string): string[] {
    const room = this.rooms.get(projectId);
    return room ? [...room.display.hiddenObjects] : [];
  }

  /** ルームで非表示の部位(挿入順・複製)。ルームが無ければ [] */
  hiddenObjectPartsIn(projectId: string): ObjectPartRef[] {
    const room = this.rooms.get(projectId);
    return room ? hiddenPartsOf(room.display) : [];
  }

  meshDisplayIn(projectId: string): MeshDisplayMode | null {
    return this.rooms.get(projectId)?.display.meshDisplay ?? null;
  }

  meshCompareIn(projectId: string): MeshCompare | null {
    const compare = this.rooms.get(projectId)?.display.meshCompare;
    return compare ? { ...compare } : null;
  }

  /** ルームのジョイント表示設定(複製)。ルームが無い・未設定なら null */
  jointDisplayIn(projectId: string): JointDisplay | null {
    const display = this.rooms.get(projectId)?.display.jointDisplay;
    return display ? { ...display } : null;
  }

  /** ルームの軌跡表示設定(複製)。ルームが無い・未設定なら null */
  motionTrailIn(projectId: string): MotionTrail | null {
    const trail = this.rooms.get(projectId)?.display.motionTrail;
    return trail ? cloneMotionTrail(trail) : null;
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

    const room = existingRoom ?? createRoom();
    this.rooms.set(connection.projectId, room);

    const trimmedName = name.trim();
    const user: PresenceUser = {
      id: connId,
      name: trimmedName || `Guest-${this.guestDigits()}`,
      color: colorFor(room),
      camera: null,
    };
    room.users.set(connId, user);
    connection.user = user;

    const users = [...room.users.values()].map(copyUser);
    const strokes = [...room.strokes.values()].map(copyStroke);
    return [
      {
        target: "self",
        msg: {
          type: "welcome",
          selfId: connId,
          users,
          strokes,
          ...displayWelcomeFields(room.display),
        },
      },
      { target: "others", msg: { type: "user:joined", user: copyUser(user) } },
    ];
}
}
