import { afterEach, describe, expect, it } from "vitest";
import { hashSessionToken } from "../src/identity/session";
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

function modelFile(): File {
  return new File([new TextEncoder().encode("glTF12345678")], "model.glb");
}

function upload(name: string): FormData {
  const form = new FormData();
  form.append("name", name);
  form.append("file", modelFile());
  return form;
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return setCookie!.split(";", 1)[0]!;
}

function count(t: TestApp, table: string): number {
  return (t.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

describe("anonymous project identity", () => {
  it("creates an owner, membership, and hashed cookie session on project creation", async () => {
    const t = testApp();
    t.ids.push("p1", "v1");
    const response = await t.app.request("/api/projects", { method: "POST", body: upload("Robot") });
    const cookie = cookieFrom(response);
    const token = cookie.split("=", 2)[1]!;
    const user = t.db.prepare("SELECT id FROM users").get() as { id: string };

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=34560000");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
    expect(count(t, "users")).toBe(1);
    expect(count(t, "sessions")).toBe(1);
    expect(t.db.prepare("SELECT token_hash FROM sessions").get()).toEqual({
      token_hash: hashSessionToken(token),
    });
    expect(t.db.prepare("SELECT owner_id FROM projects WHERE id = ?").get("p1")).toEqual({
      owner_id: user.id,
    });
    expect(t.db.prepare("SELECT * FROM project_members").all()).toEqual([{
      project_id: "p1",
      user_id: user.id,
      joined_at: 1700000000000,
      last_opened_at: 1700000000000,
    }]);

    t.ids.push("p2", "v2");
    const second = await t.app.request("/api/projects", {
      method: "POST",
      body: upload("Second"),
      headers: { cookie },
    });
    expect(second.status).toBe(201);
    expect(second.headers.get("set-cookie")).toBeNull();
    expect(count(t, "users")).toBe(1);
    expect(t.db.prepare("SELECT owner_id FROM projects WHERE id = ?").get("p2")).toEqual({
      owner_id: user.id,
    });
  });

  it("replaces an unknown cookie with a new anonymous session", async () => {
    const t = testApp();
    const response = await t.app.request("/api/projects", {
      method: "POST",
      body: upload("Robot"),
      headers: { cookie: "rv_session=unknown" },
    });

    expect(response.status).toBe(201);
    expect(cookieFrom(response)).not.toBe("rv_session=unknown");
    expect(count(t, "users")).toBe(1);
    expect(count(t, "sessions")).toBe(1);
  });

  it("does not identify invalid project creation requests", async () => {
    const t = testApp();
    const form = new FormData();
    form.append("file", modelFile());
    const response = await t.app.request("/api/projects", { method: "POST", body: form });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION");
    expect(count(t, "users")).toBe(0);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("identifies a seeded project only after it exists and preserves its response shape", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    const response = await t.app.request(`/api/projects/${seeded.project.id}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(seeded.project);
    expect(cookieFrom(response)).toMatch(/^rv_session=.+$/);
    expect(count(t, "users")).toBe(1);
    expect(t.db.prepare("SELECT owner_id FROM projects WHERE id = ?").get("p1")).toEqual({
      owner_id: null,
    });
    expect(count(t, "project_members")).toBe(1);
  });

  it("updates one membership row for repeated reads and does not identify missing projects", async () => {
    const t = testApp();
    seedProject(t);
    const first = await t.app.request("/api/projects/p1");
    const cookie = cookieFrom(first);
    const second = await t.app.request("/api/projects/p1", { headers: { cookie } });

    expect(second.status).toBe(200);
    expect(second.headers.get("set-cookie")).toBeNull();
    expect(count(t, "users")).toBe(1);
    expect(count(t, "project_members")).toBe(1);

    const missing = await t.app.request("/api/projects/nope");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("NOT_FOUND");
    expect(missing.headers.get("set-cookie")).toBeNull();
    expect(count(t, "users")).toBe(1);
  });

  it("does not identify comments, model delivery, or version addition", async () => {
    const t = testApp();
    const seeded = seedProject(t);
    const requests = [
      t.app.request("/api/projects/p1/comments"),
      t.app.request(`/api/projects/p1/versions/${seeded.version.id}/model`),
      t.app.request("/api/projects/p1/versions", { method: "POST", body: (() => {
        const form = new FormData();
        form.append("file", modelFile());
        return form;
      })() }),
    ];
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 201]);
    expect(responses.every((response) => response.headers.get("set-cookie") === null)).toBe(true);
    expect(count(t, "users")).toBe(0);
  });

  it("keeps project and version IDs independent from identity IDs", async () => {
    const t = testApp();
    t.ids.push("p1", "v1");
    const response = await t.app.request("/api/projects", { method: "POST", body: upload("Robot") });
    const project = await response.json();

    expect(project.id).toBe("p1");
    expect(project.latestVersion.id).toBe("v1");
  });
});
