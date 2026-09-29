import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/db/connection";
import { touchProjectMembership } from "../src/db/project-members";
import { insertProject } from "../src/db/projects";
import { insertUser } from "../src/db/users";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

function setup(): Db {
  const db = openDb(":memory:");
  databases.push(db);
  insertUser(db, { id: "u1", createdAt: 1 });
  insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
  return db;
}

describe("project membership database layer", () => {
  it("keeps joined_at and updates only last_opened_at", () => {
    const db = setup();

    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 10 });
    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 20 });

    expect(db.prepare("SELECT * FROM project_members").all()).toEqual([{
      project_id: "p1",
      user_id: "u1",
      joined_at: 10,
      last_opened_at: 20,
    }]);
  });

  it("enforces project and user foreign keys and cascades project deletion", () => {
    const db = setup();

    expect(() => touchProjectMembership(db, {
      projectId: "missing",
      userId: "u1",
      openedAt: 1,
    })).toThrow();
    expect(() => touchProjectMembership(db, {
      projectId: "p1",
      userId: "missing",
      openedAt: 1,
    })).toThrow();
    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 1 });
    db.prepare("DELETE FROM projects WHERE id = ?").run("p1");

    expect(db.prepare("SELECT COUNT(*) AS count FROM project_members").get()).toEqual({ count: 0 });
  });

  it("stores a null owner when ownerId is omitted", () => {
    const db = setup();

    expect(db.prepare("SELECT owner_id FROM projects WHERE id = ?").get("p1")).toEqual({ owner_id: null });
  });
});
