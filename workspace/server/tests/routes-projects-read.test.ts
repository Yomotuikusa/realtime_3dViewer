import { afterEach, describe, expect, it } from "vitest";
import { ProjectSchema } from "@shared/types";
import { makeTestApp, seedProject, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

function testApp(): TestApp {
  const value = makeTestApp();
  apps.push(value);
  return value;
}

describe("project read routes", () => {
  it("gets a seeded project", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    const response = await t.app.request(`/api/projects/${seeded.project.id}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(ProjectSchema.parse(body).latestVersion.id).toBe(seeded.version.id);
  });

  it("returns NOT_FOUND for a missing project or unrelated version", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    for (const path of [
      "/api/projects/nope",
      `/api/projects/p1/versions/nope/model`,
      `/api/projects/other/versions/${seeded.version.id}/model`,
    ]) {
      const response = await t.app.request(path);
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe("NOT_FOUND");
    }
  });

  it("serves GLB bytes with immutable caching and length", async () => {
    const t = testApp();
    const bytes = new Uint8Array([10, 20, 30]);
    const seeded = seedProject(t, { fileName: "a.glb", bytes });
    const response = await t.app.request(`/api/projects/p1/versions/${seeded.version.id}/model`);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("content-type")).toBe("model/gltf-binary");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("content-length")).toBe(String(bytes.length));
  });

  it("serves GLTF as JSON media type and reports a missing file", async () => {
    const t = testApp();
    const seeded = seedProject(t, { fileName: "a.gltf", bytes: new Uint8Array([123]) });
    const response = await t.app.request(`/api/projects/p1/versions/${seeded.version.id}/model`);
    expect(response.headers.get("content-type")).toBe("model/gltf+json");
    await t.storage.deleteModelFile(seeded.version.id);
    const missing = await t.app.request(`/api/projects/p1/versions/${seeded.version.id}/model`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("NOT_FOUND");
  });

  it.each([
    ["a.fbx", "application/octet-stream"],
    ["a.obj", "text/plain; charset=utf-8"],
    ["a.bin", "application/octet-stream"],
  ])("uses the expected media type for %s", async (fileName, contentType) => {
    const t = testApp();
    const seeded = seedProject(t, { fileName });
    const response = await t.app.request(`/api/projects/p1/versions/${seeded.version.id}/model`);

    expect(response.headers.get("content-type")).toBe(contentType);
  });
});
