import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { TestApp } from "./helpers/app";
import { makeTestApp, seedProject } from "./helpers/app";
import { migrate, openDb, type Db } from "../src/db/connection";
import { insertComment, type NewComment } from "../src/db/comments";
import { insertUser } from "../src/db/users";
import { insertModelVersion, insertProject } from "../src/db/projects";

const apps: TestApp[] = [];
const databases: Db[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
  for (const db of databases.splice(0)) db.close();
});

function testApp(): TestApp {
  const value = makeTestApp();
  apps.push(value);
  return value;
}

function input(versionId = "v1"): Record<string, unknown> {
  return {
    versionId,
    authorName: "Rin",
    body: "A note",
    anchor: [1, 2, 3],
    camera: { position: [4, 5, 6], target: [0, 1, 2] },
    strokes: [],
  };
}

async function post(t: TestApp, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie !== undefined) headers.cookie = cookie;
  return t.app.request("/api/projects/p1/comments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toMatch(/^rv_session=.+/);
  return setCookie!.split(";", 1)[0]!;
}

function userCount(t: TestApp): number {
  return (t.db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
}

describe("comment authors", () => {
  it("records one anonymous user and reuses it from its cookie", async () => {
    const t = testApp();
    seedProject(t);
    t.ids.push("c1", "c2");

    const first = await post(t, input());
    expect(first.status).toBe(201);
    const cookie = cookieFrom(first);
    const firstUser = t.db.prepare("SELECT id FROM users").get() as { id: string };
    expect(t.db.prepare("SELECT author_id FROM comments WHERE id = 'c1'").get()).toEqual({
      author_id: firstUser.id,
    });

    const second = await post(t, input(), cookie);
    expect(second.status).toBe(201);
    expect(second.headers.get("set-cookie")).toBeNull();
    expect(userCount(t)).toBe(1);
    expect(t.db.prepare("SELECT id, author_id FROM comments ORDER BY id").all()).toEqual([
      { id: "c1", author_id: firstUser.id },
      { id: "c2", author_id: firstUser.id },
    ]);
  });

  it("keeps the response shape and comment IDs independent from identity IDs", async () => {
    const t = testApp();
    seedProject(t);
    t.ids.push("c1");

    const response = await post(t, input());
    const comment = await response.json();
    expect(comment).toMatchObject({ id: "c1", status: "open" });
    expect(comment).not.toHaveProperty("authorId");
    expect(Object.keys(comment).sort()).toEqual([
      "anchor",
      "authorName",
      "body",
      "camera",
      "createdAt",
      "id",
      "playback",
      "projectId",
      "status",
      "strokes",
      "updatedAt",
      "versionId",
    ]);
  });

  it.each([
    ["missing project", "/api/projects/missing/comments", input()],
    ["invalid body", "/api/projects/p1/comments", { ...input(), body: undefined }],
    ["missing version", "/api/projects/p1/comments", input("missing")],
  ])("does not identify the user when %s", async (_name, path, body) => {
    const t = testApp();
    seedProject(t);
    const response = await t.app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(_name === "invalid body" ? 400 : 404);
    expect((await response.json()).error.code).toBe(_name === "invalid body" ? "VALIDATION" : "NOT_FOUND");
    expect(userCount(t)).toBe(0);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not identify a user while patching and preserves author_id", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    insertUser(t.db, { id: "u1", createdAt: 1 });
    insertComment(t.db, {
      id: "c1",
      projectId: "p1",
      versionId: version.id,
      authorName: "Tester",
      body: "seed",
      anchor: [0, 0, 0],
      camera: { position: [0, 0, 5], target: [0, 0, 0] },
      strokes: [],
      authorId: "u1",
      createdAt: 1,
    });

    const response = await t.app.request("/api/projects/p1/comments/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(userCount(t)).toBe(1);
    expect(t.db.prepare("SELECT author_id FROM comments WHERE id = 'c1'").get()).toEqual({
      author_id: "u1",
    });
  });
});

function databaseComment(overrides: Partial<NewComment> = {}): NewComment {
  return {
    id: "c1",
    projectId: "p1",
    versionId: "v1",
    authorName: "Tester",
    body: "body",
    anchor: [0, 0, 0],
    camera: { position: [0, 0, 1], target: [0, 0, 0] },
    strokes: [],
    createdAt: 1,
    ...overrides,
  };
}

function seedVersion(db: Db): void {
  insertProject(db, { id: "p1", name: "Project", createdAt: 1 });
  insertModelVersion(db, {
    id: "v1",
    projectId: "p1",
    fileName: "model.glb",
    byteSize: 1,
    createdAt: 1,
  });
}

describe("comment author database storage", () => {
  it("stores NULL by default, stores authorId, and enforces its foreign key", () => {
    const db = openDb(":memory:");
    databases.push(db);
    seedVersion(db);
    insertUser(db, { id: "u1", createdAt: 1 });

    const withoutAuthor = insertComment(db, databaseComment());
    const withAuthor = insertComment(db, databaseComment({ id: "c2", authorId: "u1" }));
    expect(withoutAuthor).not.toHaveProperty("authorId");
    expect(db.prepare("SELECT author_id FROM comments ORDER BY id").all()).toEqual([
      { author_id: null },
      { author_id: "u1" },
    ]);
    expect(withAuthor).not.toHaveProperty("authorId");
    expect(() => insertComment(db, databaseComment({ id: "c3", authorId: "missing" }))).toThrow();
  });

  it("adds nullable author_id to a legacy comments table and is idempotent", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
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
      INSERT INTO projects VALUES ('p1', 'Project', 1);
      INSERT INTO model_versions VALUES ('v1', 'p1', 1, 'model.glb', 1, 1);
      INSERT INTO comments VALUES ('c1', 'p1', 'v1', 'Tester', 'body',
        '[0,0,0]', '{"position":[0,0,1],"target":[0,0,0]}', '[]', 'open', 1, 1);
    `);
    databases.push(db);

    migrate(db);
    migrate(db);

    expect(db.prepare("PRAGMA table_info(comments)").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "author_id", notnull: 0 }),
    ]));
    expect(db.prepare("SELECT author_id FROM comments WHERE id = 'c1'").get()).toEqual({
      author_id: null,
    });
    expect((db.prepare("PRAGMA table_info(comments)").all() as Array<{ name: string }>)
      .filter((column) => column.name === "author_id")).toHaveLength(1);
  });
});
