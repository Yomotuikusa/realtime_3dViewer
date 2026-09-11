import { readdirSync, existsSync } from "node:fs";
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

function modelFile(fileName: string, bytes = new TextEncoder().encode("glTF12345678")): File {
  return new File([new Uint8Array(bytes).buffer as ArrayBuffer], fileName);
}

function versionForm(files: File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append("file", file);
  return form;
}

async function postVersion(t: TestApp, projectId: string, files: File[]): Promise<Response> {
  return t.app.request(`/api/projects/${projectId}/versions`, {
    method: "POST",
    body: versionForm(files),
  });
}

describe("POST /api/projects/:projectId/versions", () => {
  it("adds a version and publishes it after persistence", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    const response = await postVersion(t, seeded.project.id, [modelFile("added.glb")]);

    expect(response.status).toBe(201);
    const version = await response.json();
    expect(version).toMatchObject({ projectId: "p1", number: 2, fileName: "added.glb" });
    expect(t.published).toEqual([{ projectId: "p1", msg: { type: "object:added", version } }]);
    const project = ProjectSchema.parse(
      await (await t.app.request("/api/projects/p1")).json(),
    );
    expect(project.versions.map((item) => item.number)).toEqual([1, 2]);
    expect(project.latestVersion.id).toBe(version.id);
    expect(existsSync(t.storage.modelFilePath(version.id))).toBe(true);
  });

  it("returns all versions after adding two versions", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    const first = await postVersion(t, seeded.project.id, [modelFile("second.glb")]);
    const second = await postVersion(t, seeded.project.id, [modelFile("third.glb")]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const project = ProjectSchema.parse(
      await (await t.app.request("/api/projects/p1")).json(),
    );
    expect(project.versions.map((item) => item.number)).toEqual([1, 2, 3]);
    expect(project.latestVersion.number).toBe(3);
  });

  it("rejects a missing project without saving or publishing", async () => {
    const t = testApp();
    const response = await postVersion(t, "missing", [modelFile("added.glb")]);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
    expect(t.published).toEqual([]);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it.each([
    ["missing", [] as File[]],
    ["multiple", [modelFile("a.glb"), modelFile("b.glb")]],
  ])("rejects %s files", async (_case, files) => {
    const t = testApp();
    seedProject(t);
    const response = await postVersion(t, "p1", files);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION");
    expect(t.published).toEqual([]);
  });

  it("rejects an unsupported file", async () => {
    const t = testApp();
    seedProject(t);
    const response = await postVersion(t, "p1", [modelFile("bad.txt")]);

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(t.published).toEqual([]);
  });

  it("deletes the file and does not publish when insertion fails", async () => {
    const t = testApp();
    seedProject(t);
    t.ids.push("v1");
    const response = await postVersion(t, "p1", [modelFile("added.glb")]);

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
    expect(t.published).toEqual([]);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });
});
