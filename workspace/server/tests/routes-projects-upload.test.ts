import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSchema } from "@shared/types";
import { MULTIPART_OVERHEAD_BYTES } from "../src/app";
import { makeTestApp, seedProject, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

function testApp(overrides: Partial<Parameters<typeof makeTestApp>[0]> = {}): TestApp {
  const value = makeTestApp(overrides);
  apps.push(value);
  return value;
}

function glbBytes(): Uint8Array {
  return new TextEncoder().encode("glTF12345678");
}

function modelFile(bytes: Uint8Array, fileName: string): File {
  return new File([new Uint8Array(bytes).buffer as ArrayBuffer], fileName);
}

function uploadForm(name: string | undefined, file: File | string | undefined): FormData {
  const form = new FormData();
  if (name !== undefined) form.append("name", name);
  if (file !== undefined) form.append("file", file);
  return form;
}

function multiUploadForm(name: string, files: File[]): FormData {
  const form = new FormData();
  form.append("name", name);
  for (const file of files) form.append("file", file);
  return form;
}

async function post(
  t: TestApp,
  name: string | undefined,
  file: File | string | undefined,
  headers?: HeadersInit,
): Promise<Response> {
  return t.app.request("/api/projects", {
    method: "POST",
    body: uploadForm(name, file),
    headers,
  });
}

function projectCount(t: TestApp): number {
  return (t.db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count;
}

describe("POST /api/projects", () => {
  it("rejects uploads over the configured file count before reading file bytes", async () => {
    const t = testApp({ maxUploadFiles: 2 });
    const files = ["a.glb", "b.glb", "c.glb"].map((name) => modelFile(glbBytes(), name));
    const arrayBuffer = vi.spyOn(File.prototype, "arrayBuffer");
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", files),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual({ code: "VALIDATION", message: "Too many files" });
    expect(projectCount(t)).toBe(0); expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
    expect(arrayBuffer).not.toHaveBeenCalled();
    arrayBuffer.mockRestore();
  });

  it("checks file count before file format", async () => {
    const t = testApp({ maxUploadFiles: 1 });
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", [
        modelFile(glbBytes(), "a.glb"),
        modelFile(new TextEncoder().encode("not a model"), "b.txt"),
      ]),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual({ code: "VALIDATION", message: "Too many files" });
    expect(projectCount(t)).toBe(0); expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("stores multiple uploaded models in submission order", async () => {
    const t = testApp({ maxUploadFiles: 2 });
    const firstBytes = glbBytes();
    const secondBytes = new TextEncoder().encode('{"asset":{}}');
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", [
        modelFile(firstBytes, "a.glb"),
        modelFile(secondBytes, "b.gltf"),
      ]),
    });

    expect(response.status).toBe(201);
    const project = ProjectSchema.parse(await response.json());
    expect(project.versions.map(({ number, fileName }) => ({ number, fileName }))).toEqual([
      { number: 1, fileName: "a.glb" },
      { number: 2, fileName: "b.gltf" },
    ]);
    expect(project.latestVersion!.id).toBe(project.versions[1]!.id);
    expect(existsSync(t.storage.modelFilePath(project.versions[0]!.id))).toBe(true);
    expect(existsSync(t.storage.modelFilePath(project.versions[1]!.id))).toBe(true);
  });

  it("validates every model before saving any file", async () => {
    const t = testApp();
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", [
        modelFile(glbBytes(), "a.glb"),
        modelFile(new TextEncoder().encode("not a model"), "c.txt"),
      ]),
    });

    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("does not save a valid first file when a later file is too large", async () => {
    const t = testApp({ maxUploadBytes: 12 });
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", [
        modelFile(glbBytes(), "a.glb"),
        modelFile(new Uint8Array(13), "b.glb"),
      ]),
    });

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("does not save a valid first file when a later model is invalid", async () => {
    const t = testApp();
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", [
        modelFile(glbBytes(), "a.glb"),
        modelFile(new TextEncoder().encode("FBX!"), "b.glb"),
      ]),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("deletes every saved file when a multi-file transaction fails", async () => {
    const t = testApp();
    seedProject(t);
    t.ids.push("p2", "v1", "v1");
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: multiUploadForm("Robot", [
        modelFile(glbBytes(), "a.glb"),
        modelFile(new TextEncoder().encode("glTFabcdefgh"), "b.glb"),
      ]),
    });

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
    expect(projectCount(t)).toBe(1);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("stores a project and serves its uploaded model", async () => {
    const t = testApp();
    const bytes = glbBytes();
    const response = await post(t, "Robot", modelFile(bytes, "a.glb"));

    expect(response.status).toBe(201);
    const project = ProjectSchema.parse(await response.json());
    expect(project.name).toBe("Robot");
    expect(project.latestVersion!.number).toBe(1);
    expect(project.latestVersion!.fileName).toBe("a.glb");
    expect(project.latestVersion!.byteSize).toBe(12);
    expect(t.published).toEqual([]);

    const fetched = await t.app.request(`/api/projects/${project.id}`);
    expect(fetched.status).toBe(200);
    const model = await t.app.request(
      `/api/projects/${project.id}/versions/${project.latestVersion!.id}/model`,
    );
    expect(model.status).toBe(200);
    expect(new Uint8Array(await model.arrayBuffer())).toEqual(bytes);
  });

  it("uses injected project and version ids and stores the version file", async () => {
    const t = testApp();
    t.ids.push("p1", "v1");
    const response = await post(t, "Robot", modelFile(glbBytes(), "a.glb"));
    const project = ProjectSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(project.id).toBe("p1");
    expect(project.latestVersion!.id).toBe("v1");
    expect(existsSync(t.storage.modelFilePath("v1"))).toBe(true);
  });

  it.each([
    [undefined, "a.glb"],
    ["   ", "a.glb"],
    ["x".repeat(101), "a.glb"],
  ])("rejects invalid project name %j", async (name, fileName) => {
    const t = testApp();
    const response = await post(t, name, modelFile(glbBytes(), fileName));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION");
    expect(projectCount(t)).toBe(0);
  });

  it("rejects a missing or non-File model field", async () => {
    for (const file of [undefined, "not a file"] as const) {
      const t = testApp();
      const response = await post(t, "Robot", file);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION");
      expect(projectCount(t)).toBe(0);
    }
  });

  it("rejects unsupported models before creating database rows or files", async () => {
    const t = testApp();
    const response = await post(t, "Robot", modelFile(glbBytes(), "a.stl"));
    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("rejects invalid GLB bytes", async () => {
    const t = testApp();
    const response = await post(
      t,
      "Robot",
      modelFile(new TextEncoder().encode("FBX!"), "a.glb"),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(projectCount(t)).toBe(0);
  });

  it("rejects an oversized advertised body before parsing it", async () => {
    const t = testApp({ maxUploadBytes: 100 });
    const response = await post(
      t,
      "Robot",
      modelFile(glbBytes(), "a.glb"),
      { "Content-Length": String(100 + MULTIPART_OVERHEAD_BYTES + 1) },
    );
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("checks File.size when Content-Length is absent", async () => {
    const t = testApp({ maxUploadBytes: 8 });
    const response = await post(t, "Robot", modelFile(glbBytes(), "a.glb"));
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("deletes the file when the database transaction fails", async () => {
    const t = testApp();
    seedProject(t);
    t.ids.push("p2", "v1");
    const response = await post(t, "Robot", modelFile(glbBytes(), "a.glb"));

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
    expect(projectCount(t)).toBe(1);
    expect(existsSync(t.storage.modelFilePath("v1"))).toBe(false);
  });

  it("trims the project name before saving", async () => {
    const t = testApp();
    const response = await post(t, "  Robot  ", modelFile(glbBytes(), "a.glb"));
    const project = ProjectSchema.parse(await response.json());
    expect(project.name).toBe("Robot");
    expect(readFileSync(t.storage.modelFilePath(project.latestVersion!.id))).toEqual(
      Buffer.from(glbBytes()),
    );
  });
});
