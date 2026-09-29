import { existsSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_JSON_BODY_BYTES } from "../src/app";
import { insertComment } from "../src/db/comments";
import { insertModelVersion, insertProject } from "../src/db/projects";
import { hashSessionToken } from "../src/identity/session";
import { makeTestApp, seedProject, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.cleanup();
});

function testApp(): TestApp {
  const app = makeTestApp();
  apps.push(app);
  return app;
}

function cookieFrom(response: Response): string {
  const value = response.headers.get("set-cookie");
  expect(value).toMatch(/^rv_session=.+/);
  return value!.split(";", 1)[0]!;
}

function count(t: TestApp, table: string, projectId: string): number {
  return (t.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`).get(projectId) as { count: number }).count;
}

async function jsonRequest(t: TestApp, path: string, method: string, body: string, cookie?: string): Promise<Response> {
  return await t.app.request(path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body,
  });
}

describe("project management routes", () => {
  it("renames with a trimmed name and validates before identifying invalid requests", async () => {
    const t = testApp();
    t.db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("u1", 1);
    t.db.prepare("INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)")
      .run(hashSessionToken("owner-token"), "u1", 1);
    insertProject(t.db, { id: "p1", name: "Old", createdAt: 1, ownerId: "u1" });
    const missingBefore = t.db.prepare("SELECT COUNT(*) AS count FROM users").get();
    const ownerCookie = "rv_session=owner-token";
    expect((await jsonRequest(t, "/api/projects/p1", "PATCH", "{\"name\": \"  New  \"}", ownerCookie)).status).toBe(200);
    expect(t.db.prepare("SELECT name FROM projects WHERE id = ?").get("p1")).toEqual({ name: "New" });

    for (const body of ["{\"name\": \"\"}", "{\"name\": \"  \"}", `{"name":"${"a".repeat(101)}"}`, "not-json"]) {
      const response = await jsonRequest(t, "/api/projects/p1", "PATCH", body, ownerCookie);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION");
    }
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual(missingBefore);
  });

  it("forbids a different owner and lets anyone manage a legacy project", async () => {
    const t = testApp();
    t.db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("owner", 1);
    insertProject(t.db, { id: "owned", name: "Owned", createdAt: 1, ownerId: "owner" });
    const memberOpen = await t.app.request("/api/projects/owned");
    const memberCookie = cookieFrom(memberOpen);
    const forbidden = await jsonRequest(t, "/api/projects/owned", "PATCH", '{"name":"Changed"}', memberCookie);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(t.db.prepare("SELECT name FROM projects WHERE id = ?").get("owned")).toEqual({ name: "Owned" });

    insertProject(t.db, { id: "legacy", name: "Legacy", createdAt: 1 });
    const legacy = await jsonRequest(t, "/api/projects/legacy", "PATCH", '{"name":"  New legacy "}');
    expect(legacy.status).toBe(200);
    expect((await legacy.json()).name).toBe("New legacy");
  });

  it("returns 404 without creating a user and enforces the 1 MiB JSON limit", async () => {
    const t = testApp();
    const missing = await jsonRequest(t, "/api/projects/missing", "PATCH", '{"name":"Nope"}');
    expect(missing.status).toBe(404);
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 });

    insertProject(t.db, { id: "p1", name: "Project", createdAt: 1 });
    const tooLarge = await t.app.request("/api/projects/p1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_JSON_BODY_BYTES + 1),
      },
      body: "{}",
    });
    expect(tooLarge.status).toBe(413);
    expect((await tooLarge.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("deletes a project, its non-cascading children, and its model files without publishing", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    const second = insertModelVersion(t.db, {
      id: "v2", projectId: "p1", fileName: "second.glb", byteSize: 1, createdAt: 2,
    });
    writeFileSync(t.storage.modelFilePath(second.id), new Uint8Array([2]));
    insertProject(t.db, { id: "p2", name: "Keep", createdAt: 2 });
    const other = insertModelVersion(t.db, {
      id: "other-v1", projectId: "p2", fileName: "other.glb", byteSize: 1, createdAt: 2,
    });
    writeFileSync(t.storage.modelFilePath(other.id), new Uint8Array([3]));
    for (const userId of ["u1", "u2"]) {
      t.db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run(userId, 1);
      t.db.prepare("INSERT INTO project_members (project_id, user_id, joined_at, last_opened_at) VALUES (?, ?, ?, ?)")
        .run("p1", userId, 1, 1);
    }
    insertComment(t.db, {
      id: "c1", projectId: "p1", versionId: seeded.version.id, authorName: "Tester", body: "Comment",
      anchor: [0, 0, 0], camera: { position: [0, 0, 1], target: [0, 0, 0] }, strokes: [], createdAt: 1,
    });

    const deleted = await t.app.request("/api/projects/p1", { method: "DELETE" });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    expect(t.published).toEqual([]);
    expect(existsSync(t.storage.modelFilePath("v1"))).toBe(false);
    expect(existsSync(t.storage.modelFilePath("v2"))).toBe(false);
    expect(existsSync(t.storage.modelFilePath("other-v1"))).toBe(true);
    for (const table of ["model_versions", "comments", "project_members"]) {
      expect(count(t, table, "p1")).toBe(0);
    }
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM projects WHERE id = ?").get("p1")).toEqual({ count: 0 });
    expect((await t.app.request("/api/projects/p1", { method: "DELETE" })).status).toBe(404);
  });

  it("forbids deletion by a member and returns 404 for a missing project", async () => {
    const t = testApp();
    t.db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("owner", 1);
    insertProject(t.db, { id: "p1", name: "Project", createdAt: 1, ownerId: "owner" });
    const opened = await t.app.request("/api/projects/p1");
    const forbidden = await t.app.request("/api/projects/p1", {
      method: "DELETE", headers: { cookie: cookieFrom(opened) },
    });
    expect(forbidden.status).toBe(403);
    expect(t.db.prepare("SELECT id FROM projects").all()).toEqual([{ id: "p1" }]);
    expect((await t.app.request("/api/projects/missing", { method: "DELETE" })).status).toBe(404);
  });

  it("removes only the current user's membership and allows reopening the project", async () => {
    const t = testApp();
    insertProject(t.db, { id: "p1", name: "Project", createdAt: 1 });
    const opened = await t.app.request("/api/projects/p1");
    const cookie = cookieFrom(opened);
    t.db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("other", 1);
    t.db.prepare("INSERT INTO project_members (project_id, user_id, joined_at, last_opened_at) VALUES (?, ?, ?, ?)")
      .run("p1", "other", 1, 1);

    expect((await t.app.request("/api/projects/p1/membership", { method: "DELETE", headers: { cookie } })).status).toBe(204);
    await expect((await t.app.request("/api/projects", { headers: { cookie } })).json()).resolves.toEqual([]);
    expect(t.db.prepare("SELECT user_id FROM project_members ORDER BY user_id").all()).toEqual([{ user_id: "other" }]);
    expect((await t.app.request("/api/projects/p1", { headers: { cookie } })).status).toBe(200);
    await expect((await t.app.request("/api/projects", { headers: { cookie } })).json()).resolves.toHaveLength(1);
    expect((await t.app.request("/api/projects/p1/membership", { method: "DELETE", headers: { cookie } })).status).toBe(204);
    expect((await t.app.request("/api/projects/missing/membership", { method: "DELETE" })).status).toBe(404);
  });
});
