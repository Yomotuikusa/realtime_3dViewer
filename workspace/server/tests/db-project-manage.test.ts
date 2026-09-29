import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/db/connection";
import {
  canManageProject,
  listProjectSummaries,
  removeProjectMembership,
  touchProjectMembership,
} from "../src/db/project-members";
import { insertComment } from "../src/db/comments";
import {
  deleteProject,
  findProjectOwnerId,
  insertModelVersion,
  insertProject,
  renameProject,
} from "../src/db/projects";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

function database(): Db {
  const db = openDb(":memory:");
  databases.push(db);
  return db;
}

function addVersion(db: Db, projectId: string, id: string): void {
  insertModelVersion(db, {
    id,
    projectId,
    fileName: `${id}.glb`,
    byteSize: 1,
    createdAt: 1,
  });
}

describe("project management database operations", () => {
  it("finds owners and renames an existing project", () => {
    const db = database();
    db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("u1", 1);
    insertProject(db, { id: "owned", name: "Old", createdAt: 1, ownerId: "u1" });
    insertProject(db, { id: "legacy", name: "Legacy", createdAt: 1 });

    expect(findProjectOwnerId(db, "owned")).toBe("u1");
    expect(findProjectOwnerId(db, "legacy")).toBeNull();
    expect(findProjectOwnerId(db, "missing")).toBeUndefined();
    expect(renameProject(db, "owned", "New")).toBe(true);
    expect(db.prepare("SELECT name FROM projects WHERE id = ?").get("owned")).toEqual({ name: "New" });
    expect(renameProject(db, "missing", "Nope")).toBe(false);
  });

  it("uses the shared management rule for project summaries", () => {
    const db = database();
    for (const userId of ["u1", "u2"]) {
      db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run(userId, 1);
    }
    insertProject(db, { id: "owned-by-other", name: "Owned", createdAt: 1, ownerId: "u2" });
    insertProject(db, { id: "legacy", name: "Legacy", createdAt: 2 });
    touchProjectMembership(db, { projectId: "owned-by-other", userId: "u1", openedAt: 1 });
    touchProjectMembership(db, { projectId: "legacy", userId: "u1", openedAt: 2 });

    expect(listProjectSummaries(db, "u1")).toMatchObject([
      { id: "legacy", role: "member", canManage: true },
      { id: "owned-by-other", role: "member", canManage: false },
    ]);
  });

  it("uses owner-or-null rules and removes one membership", () => {
    expect(canManageProject("u1", "u1")).toBe(true);
    expect(canManageProject("u1", "u2")).toBe(false);
    expect(canManageProject(null, "u2")).toBe(true);

    const db = database();
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
    for (const userId of ["u1", "u2"]) {
      db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run(userId, 1);
      touchProjectMembership(db, { projectId: "p1", userId, openedAt: 1 });
    }
    removeProjectMembership(db, "p1", "u1");
    removeProjectMembership(db, "p1", "missing");

    expect(db.prepare("SELECT user_id FROM project_members ORDER BY user_id").all()).toEqual([
      { user_id: "u2" },
    ]);
  });

  it("deletes comments, versions, memberships, and the project in version order", () => {
    const db = database();
    for (const userId of ["u1", "u2"]) {
      db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run(userId, 1);
    }
    insertProject(db, { id: "p1", name: "Delete me", createdAt: 1, ownerId: "u1" });
    insertProject(db, { id: "p2", name: "Keep me", createdAt: 2, ownerId: "u2" });
    for (const userId of ["u1", "u2"]) {
      touchProjectMembership(db, { projectId: "p1", userId, openedAt: 1 });
    }
    addVersion(db, "p1", "v1");
    addVersion(db, "p1", "v2");
    addVersion(db, "p2", "other-v1");
    insertComment(db, {
      id: "c1", projectId: "p1", versionId: "v1", authorName: "Tester", body: "comment",
      anchor: [0, 0, 0], camera: { position: [0, 0, 1], target: [0, 0, 0] }, strokes: [], createdAt: 1,
    });

    expect(deleteProject(db, "p1")).toEqual(["v1", "v2"]);
    expect(deleteProject(db, "p1")).toBeNull();
    for (const table of ["model_versions", "comments", "project_members"]) {
      expect(db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`).get("p1"))
        .toEqual({ count: 0 });
    }
    expect(db.prepare("SELECT COUNT(*) AS count FROM projects WHERE id = ?").get("p1"))
      .toEqual({ count: 0 });
    expect(db.prepare("SELECT id FROM projects").all()).toEqual([{ id: "p2" }]);
    expect(db.prepare("SELECT id FROM model_versions").all()).toEqual([{ id: "other-v1" }]);
  });
});
