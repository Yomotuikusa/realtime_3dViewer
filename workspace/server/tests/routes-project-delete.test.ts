import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectSchema } from "@shared/types";
import { makeTestApp, seedComment, seedProject, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

function testApp(): TestApp {
  const value = makeTestApp();
  apps.push(value);
  return value;
}

async function deleteVersion(t: TestApp, projectId: string, versionId: string): Promise<Response> {
  return t.app.request(`/api/projects/${projectId}/versions/${versionId}`, { method: "DELETE" });
}

describe("DELETE /api/projects/:projectId/versions/:versionId", () => {
  it("deletes comments, the model file, and publishes once", async () => {
    const t = testApp();
    seedProject(t);
    seedComment(t, { projectId: "p1", versionId: "v1", id: "c1" });
    seedComment(t, { projectId: "p1", versionId: "v1", id: "c2" });

    const response = await deleteVersion(t, "p1", "v1");
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(existsSync(t.storage.modelFilePath("v1"))).toBe(false);
    expect(t.published).toEqual([{ projectId: "p1", msg: { type: "object:removed", versionId: "v1" } }]);
    expect((await (await t.app.request("/api/projects/p1/comments")).json())).toEqual([]);
    expect((await t.app.request("/api/projects/p1/versions/v1/model")).status).toBe(404);
    const project = ProjectSchema.parse(await (await t.app.request("/api/projects/p1")).json());
    expect(project).toMatchObject({ versions: [], latestVersion: null });
  });

  it.each([
    ["missing project", "nope", "v1", "Project not found"],
    ["missing version", "p1", "nope", "Model version not found"],
  ])("returns 404 for a %s without publishing", async (_case, projectId, versionId, message) => {
    const t = testApp();
    seedProject(t);
    const response = await deleteVersion(t, projectId, versionId);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND", message } });
    expect(t.published).toEqual([]);
  });

  it("returns 404 when deleting the same version twice", async () => {
    const t = testApp();
    seedProject(t);
    expect((await deleteVersion(t, "p1", "v1")).status).toBe(204);
    expect((await deleteVersion(t, "p1", "v1")).status).toBe(404);
    expect(t.published).toHaveLength(1);
  });
});
