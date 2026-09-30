import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/identity/password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/identity/password")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import { verifyPassword } from "../src/identity/password";
import { makeTestApp, type TestApp } from "./helpers/app";

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
  return response.headers.get("set-cookie")!.split(";", 1)[0]!;
}

async function jsonRequest(t: TestApp, path: string, body: unknown, cookie?: string): Promise<Response> {
  return await t.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function register(t: TestApp, loginId: string): Promise<{ cookie: string; userId: string }> {
  const response = await jsonRequest(t, "/api/account/register", { loginId, password: "correct horse" });
  const body = await response.json() as { account: { userId: string } };
  return { cookie: cookieFrom(response), userId: body.account.userId };
}

describe("account login routes", () => {
  it("logs in with normalized IDs, returns an account, and uses a dummy hash", async () => {
    const t = testApp();
    const registered = await register(t, "tanaka");
    const login = await jsonRequest(t, "/api/account/login", { loginId: "TANAKA", password: "correct horse" });
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ userId: registered.userId, loginId: "tanaka", displayName: null });
    expect(login.headers.get("set-cookie")).toMatch(/Max-Age=2592000/);
    expect(login.headers.get("cache-control")).toBe("no-store");

    const wrong = await jsonRequest(t, "/api/account/login", { loginId: "tanaka", password: "wrong pass" });
    const missing = await jsonRequest(t, "/api/account/login", { loginId: "missing", password: "wrong pass" });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(await wrong.json()).toEqual(await missing.json());
    expect((verifyPassword as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect((await t.db.prepare("SELECT password_hash FROM users").get() as { password_hash: string }).password_hash)
      .not.toContain("correct horse");
  });

  it("merges anonymous project data and replaces an account session without merging accounts", async () => {
    const t = testApp();
    const accountB = await register(t, "bravo");
    t.ids.push("anonymous-project", "anonymous-version");
    const form = new FormData();
    form.append("name", "Anonymous");
    form.append("file", new File(["glTF12345678"], "model.glb"));
    const created = await t.app.request("/api/projects", { method: "POST", body: form });
    const anonymousCookie = cookieFrom(created);
    const login = await jsonRequest(t, "/api/account/login", { loginId: "bravo", password: "correct horse" }, anonymousCookie);
    expect(login.status).toBe(200);
    expect(t.db.prepare("SELECT owner_id FROM projects WHERE id = 'anonymous-project'").get()).toEqual({ owner_id: accountB.userId });
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users WHERE login_id IS NULL").get()).toEqual({ count: 0 });
    const projects = await t.app.request("/api/projects", { headers: { cookie: cookieFrom(login) } });
    expect((await projects.json()).map((project: { id: string }) => project.id)).toContain("anonymous-project");

    const accountC = await register(t, "charlie");
    const switched = await jsonRequest(t, "/api/account/login", { loginId: "charlie", password: "correct horse" }, cookieFrom(login));
    expect(switched.status).toBe(200);
    expect((await switched.json()).userId).toBe(accountC.userId);
    expect(t.db.prepare("SELECT login_id FROM users WHERE id = ?").get(accountB.userId)).toEqual({ login_id: "bravo" });
  });

  it("logs out by deleting the session and returns 204 even without a cookie", async () => {
    const t = testApp();
    const account = await register(t, "tanaka");
    const logout = await t.app.request("/api/account/logout", { method: "POST", headers: { cookie: account.cookie } });
    expect(logout.status).toBe(204);
    expect(logout.body).toBeNull();
    expect(logout.headers.get("set-cookie")).toMatch(/rv_session=; Max-Age=0/);
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?").get(account.userId)).toEqual({ count: 0 });
    expect((await t.app.request("/api/account/logout", { method: "POST" })).status).toBe(204);
    const newAccount = await t.app.request("/api/account", { headers: { cookie: account.cookie } });
    expect((await newAccount.json()).loginId).toBeNull();
  });
});
