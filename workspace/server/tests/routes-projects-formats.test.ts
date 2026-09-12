import { readdirSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectSchema } from "@shared/types";
import { makeTestApp, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

function testApp(): TestApp {
  const value = makeTestApp();
  apps.push(value);
  return value;
}

function fbxBytes(binary = true): Uint8Array {
  return new TextEncoder().encode(
    binary ? "Kaydara FBX Binary  \0\x01\x02" : "FBXHeaderExtension:  {\nFBXVersion: 7400\n}",
  );
}

function objBytes(): Uint8Array {
  return new TextEncoder().encode("# cube\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n");
}

function modelFile(bytes: Uint8Array, fileName: string): File {
  return new File([new Uint8Array(bytes).buffer as ArrayBuffer], fileName);
}

function uploadForm(name: string, files: File[]): FormData {
  const form = new FormData();
  form.append("name", name);
  for (const file of files) form.append("file", file);
  return form;
}

async function post(t: TestApp, name: string, files: File[]): Promise<Response> {
  return t.app.request("/api/projects", { method: "POST", body: uploadForm(name, files) });
}

function versionForm(file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

async function postVersion(t: TestApp, projectId: string, file: File): Promise<Response> {
  return t.app.request(`/api/projects/${projectId}/versions`, {
    method: "POST",
    body: versionForm(file),
  });
}

function projectCount(t: TestApp): number {
  return (t.db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number }).count;
}

describe("POST /api/projects (FBX / OBJ)", () => {
  it("accepts a binary FBX and records its name and size", async () => {
    const t = testApp();
    const bytes = fbxBytes();
    const response = await post(t, "Robot", [modelFile(bytes, "a.fbx")]);

    expect(response.status).toBe(201);
    const project = ProjectSchema.parse(await response.json());
    expect(project.latestVersion.fileName).toBe("a.fbx");
    expect(project.latestVersion.byteSize).toBe(bytes.length);
  });

  it("accepts an ASCII FBX", async () => {
    const t = testApp();
    const response = await post(t, "Robot", [modelFile(fbxBytes(false), "a.fbx")]);

    expect(response.status).toBe(201);
  });

  it("accepts an OBJ text model", async () => {
    const t = testApp();
    const response = await post(t, "Robot", [modelFile(objBytes(), "a.obj")]);

    expect(response.status).toBe(201);
    const project = ProjectSchema.parse(await response.json());
    expect(project.latestVersion.fileName).toBe("a.obj");
  });

  it("accepts GLB and FBX in submission order", async () => {
    const t = testApp();
    const response = await post(t, "Robot", [
      modelFile(new TextEncoder().encode("glTF1234"), "a.glb"),
      modelFile(fbxBytes(), "b.fbx"),
    ]);

    expect(response.status).toBe(201);
    const project = ProjectSchema.parse(await response.json());
    expect(project.versions.map(({ number, fileName }) => ({ number, fileName }))).toEqual([
      { number: 1, fileName: "a.glb" },
      { number: 2, fileName: "b.fbx" },
    ]);
  });

  it("rejects glTF bytes named as FBX before creating rows or files", async () => {
    const t = testApp();
    const response = await post(t, "Robot", [
      modelFile(new TextEncoder().encode("glTF12345678"), "a.fbx"),
    ]);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(projectCount(t)).toBe(0);
    expect(readdirSync(`${t.dir}/uploads`)).toEqual([]);
  });

  it("rejects an OBJ without a vertex line", async () => {
    const t = testApp();
    const response = await post(t, "Robot", [
      modelFile(new TextEncoder().encode("mtllib a.mtl\n"), "a.obj"),
    ]);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(projectCount(t)).toBe(0);
  });

  it("adds an FBX as the second version after an OBJ", async () => {
    const t = testApp();
    const firstResponse = await post(t, "Robot", [modelFile(objBytes(), "a.obj")]);
    const firstProject = ProjectSchema.parse(await firstResponse.json());
    const response = await postVersion(t, firstProject.id, modelFile(fbxBytes(), "b.fbx"));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ number: 2, fileName: "b.fbx" });
  });
});
