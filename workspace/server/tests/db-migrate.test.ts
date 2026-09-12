import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { addColumnIfMissing, migrate, openDb, type Db } from "../src/db/connection";
import { listComments } from "../src/db/comments";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close();
  }
});

function legacyDb(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE model_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      number INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(project_id, number)
    );
    CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      version_id TEXT NOT NULL REFERENCES model_versions(id),
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      anchor_json TEXT NOT NULL,
      camera_json TEXT NOT NULL,
      strokes_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','resolved')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  databases.push(db);
  return db;
}

function commentColumns(db: Db): Array<{ name: string; notnull: number }> {
  return db.prepare("PRAGMA table_info(comments)").all() as Array<{
    name: string;
    notnull: number;
  }>;
}

describe("database migrations", () => {
  it("adds a nullable playback_json column to the legacy schema", () => {
    const db = legacyDb();

    migrate(db);

    expect(commentColumns(db).find((column) => column.name === "playback_json")).toMatchObject({
      notnull: 0,
    });
  });

  it("reads legacy comments as null playback after migration", () => {
    const db = legacyDb();
    db.exec(`
      INSERT INTO projects VALUES ('p1', 'Project', 1);
      INSERT INTO model_versions VALUES ('v1', 'p1', 1, 'model.glb', 1, 2);
      INSERT INTO comments
        (id, project_id, version_id, author_name, body, anchor_json, camera_json,
         strokes_json, status, created_at, updated_at)
      VALUES ('c1', 'p1', 'v1', 'Tester', 'legacy', '[0,0,0]',
              '{"position":[0,0,1],"target":[0,0,0]}', '[]', 'open', 3, 3);
    `);

    migrate(db);

    expect(listComments(db, "p1")[0]?.playback).toBeNull();
  });

  it("is idempotent and does not duplicate the migrated column", () => {
    const db = legacyDb();

    migrate(db);
    migrate(db);

    expect(commentColumns(db).filter((column) => column.name === "playback_json")).toHaveLength(1);
  });

  it("creates the playback column for a new database", () => {
    const db = openDb(":memory:");
    databases.push(db);

    expect(commentColumns(db).some((column) => column.name === "playback_json")).toBe(true);
  });

  it("adds only missing columns", () => {
    const db = legacyDb();
    migrate(db);
    const before = commentColumns(db).length;

    addColumnIfMissing(db, "comments", "playback_json", "TEXT");
    expect(commentColumns(db)).toHaveLength(before);

    addColumnIfMissing(db, "comments", "extra_col", "INTEGER");
    expect(commentColumns(db)).toHaveLength(before + 1);
  });
});
