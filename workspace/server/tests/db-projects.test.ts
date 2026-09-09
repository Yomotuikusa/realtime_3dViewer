import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb, withTransaction } from "../src/db/connection";
import {
  findModelVersion,
  findProject,
  insertModelVersion,
  insertProject,
} from "../src/db/projects";
import { makeTmpDir, removeTmpDir } from "./helpers/tmp";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeTmpDir(directory);
  }
});

function temporaryDirectory(): string {
  const directory = makeTmpDir("db");
  temporaryDirectories.push(directory);
  return directory;
}

describe("SQLite connection", () => {
  it("migrates all tables and the comments index in memory", () => {
    const db = openDb(":memory:");
    const objects = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type IN ('table', 'index')
           AND name IN ('projects', 'model_versions', 'comments', 'idx_comments_project')`,
      )
      .all() as Array<{ name: string }>;

    expect(objects.map((object) => object.name).sort()).toEqual([
      "comments",
      "idx_comments_project",
      "model_versions",
      "projects",
    ]);
    db.close();
  });

  it("can migrate an existing file more than once and enforces foreign keys", () => {
    const directory = temporaryDirectory();
    const path = join(directory, "repeat.sqlite");
    const first = openDb(path);
    first.close();
    const second = openDb(path);
    expect(() =>
      second
        .prepare(
          `INSERT INTO model_versions
            (id, project_id, number, file_name, byte_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("v1", "missing", 1, "model.glb", 1, 1),
    ).toThrow();
    second.close();
  });

  it("rolls back a transaction and rethrows its error", () => {
    const db = openDb(":memory:");
    expect(() =>
      withTransaction(db, () => {
        insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
        throw new Error("stop");
      }),
    ).toThrow("stop");
    expect(db.prepare("SELECT COUNT(*) AS count FROM projects").get()).toEqual({ count: 0 });
    db.close();
  });
});

describe("projects database layer", () => {
  it("returns null for a project without versions", () => {
    const db = openDb(":memory:");
    insertProject(db, { id: "p1", name: "Project", createdAt: 10 });
    expect(findProject(db, "p1")).toBeNull();
    db.close();
  });

  it("assigns increasing version numbers and finds the latest version", () => {
    const db = openDb(":memory:");
    insertProject(db, { id: "p1", name: "Project", createdAt: 10 });
    const first = insertModelVersion(db, {
      id: "v1",
      projectId: "p1",
      fileName: "first.glb",
      byteSize: 12,
      createdAt: 11,
    });
    const second = insertModelVersion(db, {
      id: "v2",
      projectId: "p1",
      fileName: "second.glb",
      byteSize: 34,
      createdAt: 12,
    });

    expect(first).toEqual({
      id: "v1",
      projectId: "p1",
      number: 1,
      fileName: "first.glb",
      byteSize: 12,
      createdAt: 11,
    });
    expect(second.number).toBe(2);
    expect(findProject(db, "p1")).toEqual({
      id: "p1",
      name: "Project",
      createdAt: 10,
      latestVersion: second,
    });
    db.close();
  });

  it("rejects duplicate projects and returns null for missing projects", () => {
    const db = openDb(":memory:");
    insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
    expect(() => insertProject(db, { id: "p1", name: "Again", createdAt: 2 })).toThrow();
    expect(findProject(db, "nope")).toBeNull();
    db.close();
  });

  it("scopes model version lookup to the requested project", () => {
    const db = openDb(":memory:");
    insertProject(db, { id: "pa", name: "A", createdAt: 1 });
    insertProject(db, { id: "pb", name: "B", createdAt: 2 });
    insertModelVersion(db, {
      id: "va",
      projectId: "pa",
      fileName: "a.gltf",
      byteSize: 20,
      createdAt: 3,
    });
    const version = insertModelVersion(db, {
      id: "vb",
      projectId: "pb",
      fileName: "b.glb",
      byteSize: 30,
      createdAt: 4,
    });

    expect(findModelVersion(db, "pa", "vb")).toBeNull();
    expect(findModelVersion(db, "pa", "va")).toEqual({
      id: "va",
      projectId: "pa",
      number: 1,
      fileName: "a.gltf",
      byteSize: 20,
      createdAt: 3,
    });
    expect(version.fileName).toBe("b.glb");
    db.close();
  });
});

describe("temporary directory helper", () => {
  it("creates and removes a directory under server/.vite/test-tmp", () => {
    const directory = makeTmpDir("x");
    expect(existsSync(directory)).toBe(true);
    expect(directory).toContain("server/.vite/test-tmp");
    removeTmpDir(directory);
    expect(existsSync(directory)).toBe(false);
  });
});
