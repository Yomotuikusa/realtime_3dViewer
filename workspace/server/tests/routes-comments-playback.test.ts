import { afterEach, describe, expect, it } from "vitest";
import type { TestApp } from "./helpers/app";
import { makeTestApp, seedComment, seedProject } from "./helpers/app";

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

describe("comment playback routes", () => {
  it("persists playback in the response, event, and list", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    t.ids.push("c1");
    const playback = { clipIndex: 0, frame: 12 };

    const response = await post(t, { ...input(version.id), playback });
    expect(response.status).toBe(201);
    const comment = await response.json();
    expect(comment.playback).toEqual(playback);
    expect(t.published).toEqual([{ projectId: "p1", msg: { type: "comment:created", comment } }]);

    const listed = await t.app.request("/api/projects/p1/comments");
    expect((await listed.json())[0].playback).toEqual(playback);
  });

  it("normalizes omitted and null playback to null", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    t.ids.push("c1", "c2");

    expect((await (await post(t, input(version.id))).json()).playback).toBeNull();
    expect((await (await post(t, { ...input(version.id), playback: null })).json()).playback).toBeNull();
  });

  it("rejects invalid playback without saving or publishing", async () => {
    const t = testApp();
    const { version } = seedProject(t);

    for (const playback of [
      { clipIndex: -1, frame: 0 },
      { clipIndex: 0, frame: 1.5 },
    ]) {
      const response = await post(t, { ...input(version.id), playback });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION");
    }
    expect(t.published).toEqual([]);
    expect(await (await t.app.request("/api/projects/p1/comments")).json()).toEqual([]);
  });

  it("includes seeded playback in the list and defaults seeded comments to null", async () => {
    const t = testApp();
    const { version } = seedProject(t);
    seedComment(t, {
      projectId: "p1",
      versionId: version.id,
      id: "with-playback",
      playback: { clipIndex: 2, frame: 3 },
    });
    seedComment(t, { projectId: "p1", versionId: version.id, id: "without-playback" });

    const response = await t.app.request("/api/projects/p1/comments");
    expect(await response.json()).toMatchObject([
      { id: "with-playback", playback: { clipIndex: 2, frame: 3 } },
      { id: "without-playback", playback: null },
    ]);
  });
});
