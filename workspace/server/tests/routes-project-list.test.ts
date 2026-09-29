import { afterEach, describe, expect, it } from "vitest";
import { insertProject } from "../src/db/projects";
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

function modelFile(name: string): File {
  return new File([new TextEncoder().encode("glTF12345678")], name);
}

function upload(name: string, files: File[]): FormData {
  const form = new FormData();
  form.append("name", name);
  for (const file of files) form.append("file", file);
  return form;
}

describe("GET /api/projects", () => {
  it("identifies a cookie-less user and returns an empty list", async () => {
    const t = testApp();
    const response = await t.app.request("/api/projects");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(cookieFrom(response)).toMatch(/^rv_session=/);
  });

  it("lists a created project with its versions and owner role", async () => {
    const t = testApp();
    t.ids.push("p1", "v1", "v2");
    const created = await t.app.request("/api/projects", {
      method: "POST",
      body: upload("Robot", [modelFile("a.glb"), modelFile("b.glb")]),
    });
    const cookie = cookieFrom(created);
    const list = await t.app.request("/api/projects", { headers: { cookie } });

    expect(await list.json()).toEqual([{
      id: "p1",
      name: "Robot",
      createdAt: 1700000000000,
      lastOpenedAt: 1700000000000,
      versionCount: 2,
      role: "owner",
      canManage: true,
    }]);
  });

  it("lists a project for another user after that user opens its URL", async () => {
    const t = testApp();
    t.ids.push("p1", "v1");
    const created = await t.app.request("/api/projects", {
      method: "POST",
      body: upload("Robot", [modelFile("a.glb")]),
    });
    const ownerCookie = cookieFrom(created);
    const opened = await t.app.request("/api/projects/p1");
    const memberCookie = cookieFrom(opened);

    expect(await (await t.app.request("/api/projects", { headers: { cookie: memberCookie } })).json()).toEqual([{
      id: "p1", name: "Robot", createdAt: 1700000000000, lastOpenedAt: 1700000000000,
      versionCount: 1, role: "member", canManage: false,
    }]);
    expect((await (await t.app.request("/api/projects", { headers: { cookie: ownerCookie } })).json())[0]).toMatchObject({
      role: "owner", canManage: true,
    });
  });

  it("allows management of a seeded project with no owner", async () => {
    const t = testApp();
    seedProject(t);
    const opened = await t.app.request("/api/projects/p1");
    const list = await t.app.request("/api/projects", { headers: { cookie: cookieFrom(opened) } });
    expect(await list.json()).toMatchObject([{ id: "p1", role: "member", canManage: true }]);
  });

  it("does not list a project that the user has never opened", async () => {
    const t = testApp();
    insertProject(t.db, { id: "p1", name: "Unvisited", createdAt: 1 });
    const list = await t.app.request("/api/projects");
    expect(await list.json()).toEqual([]);
  });
});
