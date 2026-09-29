import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, openDb, type Db } from "../src/db/connection";
import { touchProjectMembership } from "../src/db/project-members";
import { insertProject } from "../src/db/projects";
import { findUserIdBySessionHash, insertSession, insertUser } from "../src/db/users";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

function tableNames(db: Db): string[] {
  return (db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all() as Array<{ name: string }>).map((row) => row.name);
}

function projectColumns(db: Db): Array<{ name: string; notnull: number }> {
  return db.prepare("PRAGMA table_info(projects)").all() as Array<{
    name: string;
    notnull: number;
  }>;
}

function legacyDb(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    INSERT INTO projects VALUES ('legacy-project', 'Legacy', 7);
  `);
  databases.push(db);
  return db;
}

describe("identity database layer", () => {
  it("inserts users and resolves a session hash", () => {
    const db = openDb(":memory:");
    databases.push(db);

    insertUser(db, { id: "u1", createdAt: 10 });
    insertSession(db, { tokenHash: "h1", userId: "u1", createdAt: 11 });

    expect(findUserIdBySessionHash(db, "h1")).toBe("u1");
    expect(findUserIdBySessionHash(db, "missing")).toBeNull();
  });

  it("enforces session and membership foreign keys", () => {
    const db = openDb(":memory:");
    databases.push(db);

    expect(() => insertSession(db, {
      tokenHash: "h1",
      userId: "missing",
      createdAt: 1,
    })).toThrow();
    insertUser(db, { id: "u1", createdAt: 1 });
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
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
  });

  it("keeps joined_at and updates only last_opened_at", () => {
    const db = openDb(":memory:");
    databases.push(db);
    insertUser(db, { id: "u1", createdAt: 1 });
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
    expect(db.prepare("SELECT owner_id FROM projects WHERE id = ?").get("p1")).toEqual({
      owner_id: null,
    });

    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 10 });
    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 20 });

    expect(db.prepare("SELECT * FROM project_members").all()).toEqual([{
      project_id: "p1",
      user_id: "u1",
      joined_at: 10,
      last_opened_at: 20,
    }]);
  });

  it("cascades users and projects to dependent identity rows", () => {
    const db = openDb(":memory:");
    databases.push(db);
    insertUser(db, { id: "u1", createdAt: 1 });
    insertSession(db, { tokenHash: "h1", userId: "u1", createdAt: 2 });
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 3 });

    db.prepare("DELETE FROM users WHERE id = ?").run("u1");
    expect(findUserIdBySessionHash(db, "h1")).toBeNull();
    db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("u1", 4);
    touchProjectMembership(db, { projectId: "p1", userId: "u1", openedAt: 5 });
    db.prepare("DELETE FROM projects WHERE id = ?").run("p1");
    expect(db.prepare("SELECT COUNT(*) AS count FROM project_members").get()).toEqual({ count: 0 });
  });

  it("migrates the legacy projects table and is idempotent", () => {
    const db = legacyDb();

    migrate(db);
    migrate(db);

    expect(tableNames(db)).toEqual(expect.arrayContaining([
      "users",
      "sessions",
      "project_members",
    ]));
    expect(projectColumns(db).find((column) => column.name === "owner_id")).toMatchObject({
      name: "owner_id",
      notnull: 0,
    });
    expect(db.prepare("SELECT id, name, created_at, owner_id FROM projects").all()).toEqual([{
      id: "legacy-project",
      name: "Legacy",
      created_at: 7,
      owner_id: null,
    }]);
    expect(projectColumns(db).filter((column) => column.name === "owner_id")).toHaveLength(1);
  });
});
