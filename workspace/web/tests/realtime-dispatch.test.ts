import { beforeEach, describe, expect, it } from "vitest";
import type { ServerMessage } from "@shared/protocol";
import { dispatchServerMessage } from "../src/app/realtime-dispatch";
import { useAnnotationStore } from "../src/store/annotation";
import { useCommentsStore } from "../src/store/comments";
import { useLightingStore } from "../src/store/lighting";
import { usePresenceStore } from "../src/store/presence";
import { useSessionStore } from "../src/store/session";

const user = { id: "u2", name: "Mio", color: "#112233", camera: null };
const camera = { position: [1, 2, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
const stroke = { id: "s1", userId: "u1", color: "#ff0000", points: [[0, 0, 0], [1, 1, 1]] as [[number, number, number], [number, number, number]], createdAt: 1 };
const comment = {
  id: "c1",
  projectId: "p1",
  versionId: "v1",
  authorName: "Rin",
  body: "Check this",
  anchor: [0, 0, 0] as [number, number, number],
  camera,
  strokes: [],
  status: "open" as const,
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  useAnnotationStore.getState().reset();
  useCommentsStore.getState().reset();
  useSessionStore.getState().reset();
  usePresenceStore.getState().reset();
  useLightingStore.getState().reset();
});

describe("realtime dispatch", () => {
  it("stores the self id and matching welcome color", () => {
    dispatchServerMessage({
      type: "welcome",
      selfId: "u1",
      users: [{ id: "u1", name: "Rin", color: "#f00", camera: null }, user],
      strokes: [stroke],
    });

    expect(useSessionStore.getState().selfId).toBe("u1");
    expect(useSessionStore.getState().color).toBe("#f00");
    expect(usePresenceStore.getState().users).toHaveProperty("u2", user);
    expect(useAnnotationStore.getState().strokes).toEqual({ s1: stroke });
  });

  it("keeps color null when the self user is absent", () => {
    dispatchServerMessage({ type: "welcome", selfId: "u1", users: [], strokes: [] });
    expect(useSessionStore.getState().selfId).toBe("u1");
    expect(useSessionStore.getState().color).toBeNull();
  });

  it("dispatches presence join, leave, and camera events", () => {
    dispatchServerMessage({ type: "user:joined", user });
    expect(usePresenceStore.getState().users).toHaveProperty("u2", user);
    dispatchServerMessage({ type: "camera", userId: "u2", camera, focalLength: 85 });
    expect(usePresenceStore.getState().users.u2?.camera).toEqual(camera);
    expect(usePresenceStore.getState().users.u2?.focalLength).toBe(85);
    dispatchServerMessage({ type: "camera", userId: "u2", camera: { ...camera, position: [2, 2, 3] } });
    expect(usePresenceStore.getState().users.u2?.focalLength).toBe(85);
    usePresenceStore.getState().follow("u2");
    dispatchServerMessage({ type: "user:left", userId: "u2" });
    expect(usePresenceStore.getState().users).not.toHaveProperty("u2");
    expect(usePresenceStore.getState().followingUserId).toBeNull();
  });

  it("ignores a camera event for an unknown user", () => {
    expect(() => dispatchServerMessage({ type: "camera", userId: "nope", camera })).not.toThrow();
    expect(usePresenceStore.getState().users).toEqual({});
  });

  it("formats server errors in the session store", () => {
    dispatchServerMessage({ type: "error", code: "BAD_REQUEST", message: "x" });
    expect(useSessionStore.getState().lastError).toBe("BAD_REQUEST: x");
  });

  it("dispatches stroke add, remove, and clear events", () => {
    const otherStroke = { ...stroke, id: "s2", userId: "u2" };
    dispatchServerMessage({ type: "stroke:add", stroke });
    dispatchServerMessage({ type: "stroke:add", stroke: otherStroke });
    expect(useAnnotationStore.getState().strokes).toEqual({ s1: stroke, s2: otherStroke });
    dispatchServerMessage({ type: "stroke:remove", strokeId: "s1" });
    expect(useAnnotationStore.getState().strokes).toEqual({ s2: otherStroke });
    dispatchServerMessage({ type: "stroke:clear", userId: "u2" });
    expect(useAnnotationStore.getState().strokes).toEqual({});
  });

  it("dispatches comment creation and updates", () => {
    dispatchServerMessage({ type: "comment:created", comment });
    expect(useCommentsStore.getState().items).toEqual([comment]);
    dispatchServerMessage({
      type: "comment:updated",
      comment: { ...comment, body: "Updated", status: "resolved", updatedAt: 2 },
    });
    expect(useCommentsStore.getState().items).toHaveLength(1);
    expect(useCommentsStore.getState().items[0]).toMatchObject({ body: "Updated", status: "resolved" });
  });

  it("ignores messages not handled by this phase", () => {
    const message: ServerMessage = {
      type: "camera",
      userId: "u2",
      camera: { position: [0, 0, 0], target: [0, 0, 0] },
    };
    expect(() => dispatchServerMessage(message)).not.toThrow();
    expect(useSessionStore.getState().selfId).toBeNull();
  });

  it("has the documented initial state and resets to it", () => {
    expect(useSessionStore.getState()).toMatchObject({
      selfId: null,
      color: null,
      name: "",
      connection: "closed",
      lastError: null,
    });
    useSessionStore.getState().setConnection("open");
    useSessionStore.getState().setName("Rin");
    useSessionStore.getState().reset();
    expect(useSessionStore.getState()).toMatchObject({
      selfId: null,
      color: null,
      name: "",
      connection: "closed",
      lastError: null,
    });
  });

  it("applies light events and welcome light state", () => {
    dispatchServerMessage({ type: "light", userId: "u2", angles: { yaw: 1, pitch: 0.5 } });
    expect(useLightingStore.getState().angles).toEqual({ yaw: 1, pitch: 0.5 });
    expect(useLightingStore.getState().origin).toBe("remote");

    useLightingStore.getState().reset();
    dispatchServerMessage({ type: "welcome", selfId: "u1", users: [], strokes: [], light: { yaw: 1, pitch: 0.5 } });
    expect(useLightingStore.getState().angles).toEqual({ yaw: 1, pitch: 0.5 });
    expect(useLightingStore.getState().origin).toBe("remote");
  });

  it("keeps the default light when welcome has no light and ignores errors", () => {
    dispatchServerMessage({ type: "welcome", selfId: "u1", users: [], strokes: [] });
    expect(useLightingStore.getState().angles).toEqual({ yaw: Math.PI / 4, pitch: Math.PI / 4 });
    expect(useLightingStore.getState().origin).toBe("local");
    useLightingStore.getState().applyRemote({ yaw: 1, pitch: 0.5 });
    dispatchServerMessage({ type: "error", code: "BAD_REQUEST", message: "x" });
    expect(useLightingStore.getState().angles).toEqual({ yaw: 1, pitch: 0.5 });
  });
});
