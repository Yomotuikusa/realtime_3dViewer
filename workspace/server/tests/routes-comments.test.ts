import { afterEach, describe, expect, it } from "vitest";
import type { TestApp } from "./helpers/app";
import { makeTestApp, seedComment, seedProject } from "./helpers/app";
import { insertModelVersion, insertProject } from "../src/db/projects";

const apps: TestApp[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

function testApp(): TestApp {
  const value = makeTestApp();
  apps.push(value);
  return value;
}

function input(versionId = "v1") {
  return {
    versionId,
    authorName: "Rin",
    body: "A note",
    anchor: [1, 2, 3],
    camera: { position: [4, 5, 6], target: [0, 1, 2] },
    strokes: [],
  };
}

async function post(t: TestApp, body: unknown): Promise<Response> {
  return t.app.request("/api/projects/p1/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("comment routes", () => {
  it("lists comments in created order and filters by status", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    seedComment(t, { projectId: "p1", versionId: version.id, id: "c30", createdAt: 30 });
    seedComment(t, {
      projectId: "p1",
      versionId: version.id,
      id: "c10",
      createdAt: 10,
      status: "resolved",
    });
    seedComment(t, { projectId: "p1", versionId: version.id, id: "c20", createdAt: 20 });
    insertProject(t.db, { id: "p2", name: "Other", createdAt: 1 });
    const otherVersion = insertModelVersion(t.db, {
      id: "v2",
      projectId: "p2",
      fileName: "other.glb",
      byteSize: 1,
      createdAt: 1,
    });
    seedComment(t, { projectId: "p2", versionId: otherVersion.id, id: "other", createdAt: 1 });

    const all = await t.app.request("/api/projects/p1/comments");
    expect(all.status).toBe(200);
    expect((await all.json()).map((comment: { id: string }) => comment.id)).toEqual([
      "c10",
      "c20",
      "c30",
    ]);

    const open = await t.app.request("/api/projects/p1/comments?status=open");
    expect((await open.json()).map((comment: { status: string }) => comment.status)).toEqual([
      "open",
      "open",
    ]);
    const bad = await t.app.request("/api/projects/p1/comments?status=done");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION");
  });

  it("returns an empty list and scopes missing projects", async () => {
    const t = testApp();
    seedProject(t);
    expect(await (await t.app.request("/api/projects/p1/comments")).json()).toEqual([]);
    const missing = await t.app.request("/api/projects/nope/comments");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("NOT_FOUND");
  });

  it("creates a comment, trims input, and publishes the saved comment", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    t.ids.push("c1");
    const body = { ...input(version.id), authorName: "  Rin  ", body: "  ok  ", strokes: [] };
    const response = await post(t, body);
    expect(response.status).toBe(201);
    const comment = await response.json();
    expect(comment).toMatchObject({
      id: "c1",
      authorName: "Rin",
      body: "ok",
      status: "open",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      anchor: body.anchor,
      camera: body.camera,
      strokes: [],
    });
    expect(t.published).toEqual([{ projectId: "p1", msg: { type: "comment:created", comment } }]);
    const listed = await t.app.request("/api/projects/p1/comments");
    expect((await listed.json()).map((item: { id: string }) => item.id)).toEqual(["c1"]);
  });

  it("rejects invalid JSON and comment input before writing or publishing", async () => {
    const t = testApp();
    seedProject(t);
    const malformed = await t.app.request("/api/projects/p1/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("VALIDATION");

    for (const invalid of [
      { ...input(), body: "" },
      { ...input(), body: "x".repeat(2001) },
      { ...input(), authorName: "   " },
      { ...input(), anchor: [0, 0] },
      { ...input(), camera: undefined },
      { ...input(), strokes: Array.from({ length: 201 }, () => ({})) },
    ]) {
      const response = await post(t, invalid);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION");
    }
    expect(t.published).toEqual([]);
    expect(await (await t.app.request("/api/projects/p1/comments")).json()).toEqual([]);
  });

  it("requires a version belonging to the project", async () => {
    const t = testApp();
    seedProject(t);
    insertProject(t.db, { id: "p2", name: "Other", createdAt: 1 });
    insertModelVersion(t.db, {
      id: "v2",
      projectId: "p2",
      fileName: "other.glb",
      byteSize: 1,
      createdAt: 1,
    });
    for (const versionId of ["missing-version", "v2"]) {
      const response = await post(t, input(versionId));
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe("NOT_FOUND");
    }
    expect(t.published).toEqual([]);
    expect(await (await t.app.request("/api/projects/p1/comments")).json()).toEqual([]);
  });

  it("updates status, preserves createdAt, and publishes each update", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    seedComment(t, { projectId: "p1", versionId: version.id, id: "c1", createdAt: 1 });
    const response = await t.app.request("/api/projects/p1/comments/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(response.status).toBe(200);
    const comment = await response.json();
    expect(comment.status).toBe("resolved");
    expect(comment.createdAt).toBe(1);
    expect(comment.updatedAt).toBe(1700000000000);
    expect(t.published).toEqual([{ projectId: "p1", msg: { type: "comment:updated", comment } }]);

    t.published.length = 0;
    const reopened = await t.app.request("/api/projects/p1/comments/c1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    expect((await reopened.json()).status).toBe("open");
    expect(t.published).toHaveLength(1);
  });

  it("rejects invalid or cross-project status updates without publishing", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    seedComment(t, { projectId: "p1", versionId: version.id, id: "c1" });
    for (const status of ["done", undefined]) {
      const response = await t.app.request("/api/projects/p1/comments/c1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(status === undefined ? {} : { status }),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION");
    }
    for (const path of [
      "/api/projects/p1/comments/nope",
      "/api/projects/other/comments/c1",
    ]) {
      const response = await t.app.request(path, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe("NOT_FOUND");
    }
    expect(t.published).toEqual([]);
  });

  it("seeds documented defaults and consumes the test id queue", () => {
    const t = testApp();
    const { version } = seedProject(t);
    t.ids.push("queued-comment");
    const comment = seedComment(t, { projectId: "p1", versionId: version.id });
    expect(comment).toMatchObject({
      id: "queued-comment",
      authorName: "Tester",
      body: "seed",
      status: "open",
      strokes: [],
      createdAt: 1700000000000,
    });
  });
});
