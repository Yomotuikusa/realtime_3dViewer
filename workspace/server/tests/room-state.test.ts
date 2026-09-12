import { describe, expect, it } from "vitest";
import type { PresenceUser, Stroke } from "@shared/types";
import {
  MAX_CONNECTIONS,
  MAX_ROOM_STROKES,
  MAX_ROOMS,
  PRESENCE_PALETTE,
  colorFor,
  copyCamera,
  copyStroke,
  copyUser,
  createRoom,
} from "../src/realtime/room-state";

const user = (id: string, color: string): PresenceUser => ({ id, name: id, color, camera: null });
const stroke: Stroke = {
  id: "s1",
  userId: "owner",
  color: "#123456",
  points: [[1, 2, 3], [4, 5, 6]],
  createdAt: 10,
};

describe("room state", () => {
  it("creates an independent empty room state", () => {
    expect(PRESENCE_PALETTE).toEqual([
      "#ef4444", "#f97316", "#eab308", "#22c55e",
      "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
    ]);
    const first = createRoom();
    const second = createRoom();
    first.users.set("a", user("a", PRESENCE_PALETTE[0]!));
    first.strokes.set(stroke.id, stroke);
    first.display.hiddenObjects.add("v1");
    expect(second.users).toEqual(new Map());
    expect(second.strokes).toEqual(new Map());
    expect(second.display.hiddenObjects).toEqual(new Set());
    expect(first.users).not.toBe(second.users);
    expect(first.strokes).not.toBe(second.strokes);
    expect(first.display).not.toBe(second.display);
    expect([MAX_CONNECTIONS, MAX_ROOMS, MAX_ROOM_STROKES]).toEqual([1000, 200, 2000]);
  });

  it("selects the first unused color and cycles after the palette", () => {
    const room = createRoom();
    room.users.set("a", user("a", PRESENCE_PALETTE[0]!));
    room.users.set("b", user("b", PRESENCE_PALETTE[2]!));
    expect(colorFor(room)).toBe(PRESENCE_PALETTE[1]);
    room.users.clear();
    PRESENCE_PALETTE.forEach((color, index) => room.users.set(String(index), user(String(index), color)));
    expect(colorFor(room)).toBe(PRESENCE_PALETTE[0]);
  });

  it("copies camera, user, and stroke data deeply where needed", () => {
    const camera = { position: [1, 2, 3] as [number, number, number], target: [4, 5, 6] as [number, number, number] };
    const copiedCamera = copyCamera(camera);
    expect(copiedCamera).toEqual(camera);
    expect(copiedCamera.position).not.toBe(camera.position);
    expect(copiedCamera.target).not.toBe(camera.target);

    const noCamera = copyUser(user("a", PRESENCE_PALETTE[0]!));
    expect(noCamera.camera).toBeNull();
    const withCamera = copyUser({ ...user("a", PRESENCE_PALETTE[0]!), camera });
    expect(withCamera).toEqual({ ...user("a", PRESENCE_PALETTE[0]!), camera });
    expect(withCamera.camera).not.toBe(camera);
    expect(withCamera.camera?.position).not.toBe(camera.position);
    const copiedStroke = copyStroke(stroke);
    expect(copiedStroke).toEqual(stroke);
    expect(copiedStroke).not.toBe(stroke);
    expect(copiedStroke.points[0]).not.toBe(stroke.points[0]);
    expect(copiedStroke.points[1]).not.toBe(stroke.points[1]);
  });
});
