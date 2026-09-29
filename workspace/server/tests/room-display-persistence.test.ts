import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb, type Db } from "../src/db/connection";
import { insertProject } from "../src/db/projects";
import { createRoomDisplayStore, loadRoomDisplay, saveRoomDisplay } from "../src/db/room-display";
import {
  displayWelcomeFields,
  restoreRoomDisplayState,
  type DisplayWelcomeFields,
} from "../src/realtime/room-display";
import { RoomHub } from "../src/realtime/hub";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  vi.restoreAllMocks();
});

function makeDb(): Db {
  const db = openDb(":memory:");
  databases.push(db);
  return db;
}

const fields: DisplayWelcomeFields = {
  light: { yaw: 1, pitch: -0.5 },
  lightBrightness: 2,
  hiddenObjectIds: ["v1", "v2"],
  hiddenObjectParts: [{ versionId: "v2", objectPath: "0/1" }],
  meshDisplay: "wireframe",
  meshCompare: { baseId: "v1", targetId: "v2", thresholdPermille: 5, colorized: false },
  jointDisplay: { visible: true, xray: false },
  motionTrail: { visible: true, target: { versionId: "v1", objectPath: "0/2" } },
  playbackSource: "v2",
};

describe("room display persistence", () => {
  it("restores every field as independent state", () => {
    const input = structuredClone(fields);
    const restored = restoreRoomDisplayState(input);
    const expected = structuredClone(input);

    input.hiddenObjectIds!.push("changed");
    input.hiddenObjectParts![0]!.objectPath = "changed";
    input.light!.yaw = 99;
    input.motionTrail!.target!.objectPath = "changed";
    expect(displayWelcomeFields(restored)).toEqual(expected);
  });

  it("round-trips, upserts, ignores missing projects, and cascades on delete", () => {
    const db = makeDb();
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
    saveRoomDisplay(db, "p1", fields, 10);
    expect(loadRoomDisplay(db, "p1")).toEqual(fields);
    saveRoomDisplay(db, "p1", { meshDisplay: "solid" }, 20);
    expect(db.prepare("SELECT COUNT(*) AS count FROM project_room_state").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT display_json, updated_at FROM project_room_state").get()).toEqual({
      display_json: JSON.stringify({ meshDisplay: "solid" }), updated_at: 20,
    });
    saveRoomDisplay(db, "missing", fields, 30);
    expect(db.prepare("SELECT COUNT(*) AS count FROM project_room_state").get()).toEqual({ count: 1 });
    db.prepare("DELETE FROM projects WHERE id = ?").run("p1");
    expect(db.prepare("SELECT COUNT(*) AS count FROM project_room_state").get()).toEqual({ count: 0 });
  });

  it("warns once for invalid saved JSON or fields", () => {
    const db = makeDb();
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
    db.prepare("INSERT INTO project_room_state VALUES (?, ?, ?)").run("p1", "{", 1);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(loadRoomDisplay(db, "p1")).toBeNull();
    expect(warning).toHaveBeenCalledTimes(1);
    db.prepare("UPDATE project_room_state SET display_json = ? WHERE project_id = ?")
      .run(JSON.stringify({ meshDisplay: "x" }), "p1");
    expect(loadRoomDisplay(db, "p1")).toBeNull();
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("absorbs save failures in the injected store", () => {
    const db = makeDb();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = createRoomDisplayStore(db, () => 10);
    db.close();
    databases.splice(databases.indexOf(db), 1);
    expect(() => store.save("p1", {})).not.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toContain("room_display_save_failed");
  });

  it("saves display changes and restores them after the room is gone", () => {
    const saved: DisplayWelcomeFields[] = [];
    const store = {
      load: () => saved.at(-1) ?? null,
      save: (_projectId: string, value: DisplayWelcomeFields) => saved.push(value),
    };
    const first = new RoomHub({ displayStore: store, newId: () => "a" });
    first.connect("p1");
    first.handle("a", { type: "join", name: "A" });
    first.handle("a", { type: "light", angles: { yaw: 1, pitch: 2 } });
    first.handle("a", { type: "light:brightness", brightness: 2 });
    first.handle("a", { type: "object:visibility", versionId: "v1", visible: false });
    first.handle("a", {
      type: "object:part-visibility", versionId: "v1", objectPath: "0", visible: false,
    });
    first.handle("a", { type: "mesh:display", mode: "wireframe" });
    first.handle("a", { type: "mesh:compare", compare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 } });
    first.handle("a", { type: "joint:display", display: { visible: true, xray: false } });
    first.handle("a", {
      type: "trail:display", trail: { visible: true, target: { versionId: "v1", objectPath: "0" } },
    });
    first.handle("a", { type: "playback:source", versionId: "v2" });
    expect(saved).toHaveLength(9);
    first.handle("a", { type: "camera", camera: { position: [0, 1, 2], target: [0, 0, 0] } });
    first.handle("a", {
      type: "stroke:add",
      stroke: { id: "s1", userId: "ignored", color: "#ff0000", points: [[0, 0, 0], [1, 1, 1]], createdAt: 1 },
    });
    first.handle("a", { type: "stroke:clear" });
    expect(saved).toHaveLength(9);
    first.disconnect("a");

    const second = new RoomHub({ displayStore: store, newId: () => "b" });
    second.connect("p1");
    const welcome = second.handle("b", { type: "join", name: "B" })[0]!.msg;
    expect(welcome).toMatchObject({
      type: "welcome",
      light: { yaw: 1, pitch: 2 },
      hiddenObjectIds: ["v1"],
      meshCompare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 },
      strokes: [],
    });
  });

  it("forgets references from saved state when no room exists", () => {
    let stored: DisplayWelcomeFields | null = {
      hiddenObjectIds: ["v1"],
      hiddenObjectParts: [{ versionId: "v1", objectPath: "0" }],
      meshCompare: { baseId: "v1", targetId: "v2", thresholdPermille: 5 },
      playbackSource: "v1",
    };
    const store = {
      load: () => stored,
      save: (_projectId: string, value: DisplayWelcomeFields) => { stored = value; },
    };
    const hub = new RoomHub({ displayStore: store });
    hub.forgetObject("p1", "v1");
    expect(stored).toEqual({
      meshCompare: { baseId: null, targetId: "v2", thresholdPermille: 5 },
    });
  });
});
