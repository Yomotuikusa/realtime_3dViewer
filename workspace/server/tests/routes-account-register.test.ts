import { afterEach, describe, expect, it } from "vitest";
import { hashRecoveryCode } from "../src/identity/recovery-code";
import { hashSessionToken } from "../src/identity/session";
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
  const value = response.headers.get("set-cookie");
  expect(value).toBeTruthy();
  return value!.split(";", 1)[0]!;
}

function jsonRequest(t: TestApp, path: string, body: unknown, headers: HeadersInit = {}) {
  return t.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("account routes", () => {
  it("gets an anonymous account and updates its display name", async () => {
    const t = testApp();
    const first = await t.app.request("/api/account");
    const cookie = cookieFrom(first);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const account = await first.json();
    expect(account).toMatchObject({ loginId: null, displayName: null });

    const updated = await t.app.request("/api/account", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ displayName: "  Taro " }),
    });
    expect(updated.status).toBe(200);
    expect(updated.headers.get("set-cookie")).toBeNull();
    expect((await updated.json()).displayName).toBe("Taro");
  });

  it("validates account JSON and rejects a foreign origin", async () => {
    const t = testApp();
    for (const body of [{ displayName: "" }, { displayName: "x".repeat(51) }]) {
      const response = await t.app.request("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    const malformed = await t.app.request("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("VALIDATION");
    const foreign = await jsonRequest(t, "/api/account/register", {
      loginId: "tanaka", password: "correct horse",
    }, { origin: "http://evil.example" });
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error.code).toBe("FORBIDDEN");
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 });

    for (const body of [
      { loginId: "tanaka", password: "short" },
      { loginId: "tanaka12", password: "tanaka12" },
    ]) {
      const invalid = await jsonRequest(t, "/api/account/register", body);
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).error.code).toBe("VALIDATION");
      expect(invalid.headers.get("cache-control")).toBe("no-store");
    }
    const malformedRegister = await t.app.request("/api/account/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformedRegister.status).toBe(400);
    expect((await malformedRegister.json()).error.code).toBe("VALIDATION");
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 0 });
  });

  it("registers an account, stores only hashes, and rotates the session", async () => {
    const t = testApp();
    const response = await jsonRequest(t, "/api/account/register", {
      loginId: "Tanaka", password: "correct horse", displayName: "田中",
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie?.split(",")).toHaveLength(1);
    expect(setCookie).toMatch(/; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax/);
    const cookie = cookieFrom(response);
    expect(cookie).toMatch(/^rv_session=.+$/);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
    const body = await response.json();
    expect(body.account).toMatchObject({ loginId: "tanaka", displayName: "田中" });
    expect(body.recoveryCode).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/);
    const row = t.db.prepare("SELECT * FROM users").get() as Record<string, unknown>;
    expect(row.password_hash).toMatch(/^scrypt\$10\$8\$1\$/);
    expect(row.recovery_code_hash).toBe(hashRecoveryCode(body.recoveryCode));
    expect(JSON.stringify(row)).not.toContain("correct horse");
    expect(JSON.stringify(row)).not.toContain(body.recoveryCode);
    expect(t.db.prepare("SELECT * FROM sessions").all()).toHaveLength(1);
    expect(t.db.prepare("SELECT expires_at FROM sessions").get()).toEqual({
      expires_at: 1700000000000 + 2592000000,
    });
    expect(t.db.prepare("SELECT token_hash FROM sessions").get()).toEqual({
      token_hash: hashSessionToken(cookie.split("=", 2)[1]!),
    });
  });

  it("promotes the anonymous owner without consuming project IDs", async () => {
    const t = testApp();
    t.ids.push("p1", "v1");
    const form = new FormData();
    form.append("name", "Project");
    form.append("file", new File(["glTF12345678"], "model.glb"));
    const projectResponse = await t.app.request("/api/projects", { method: "POST", body: form });
    const cookie = cookieFrom(projectResponse);
    const owner = (t.db.prepare("SELECT owner_id FROM projects WHERE id = 'p1'").get() as { owner_id: string }).owner_id;
    const membersBefore = t.db.prepare("SELECT * FROM project_members").all();
    const registered = await jsonRequest(t, "/api/account/register", {
      loginId: "tanaka", password: "correct horse",
    }, { cookie });
    expect(registered.status).toBe(201);
    expect((await registered.json()).account.userId).toBe(owner);
    expect(t.db.prepare("SELECT owner_id FROM projects WHERE id = 'p1'").get()).toEqual({ owner_id: owner });
    expect(t.db.prepare("SELECT * FROM project_members").all()).toEqual(membersBefore);
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 });
    const rotatedCookie = cookieFrom(registered);
    expect(rotatedCookie).not.toBe(cookie);
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 });
    t.ids.push("p2", "v2");
    const nextForm = new FormData();
    nextForm.append("name", "Second");
    nextForm.append("file", new File(["glTF12345678"], "model.glb"));
    const next = await t.app.request("/api/projects", { method: "POST", body: nextForm, headers: { cookie: rotatedCookie } });
    expect((await next.json()).id).toBe("p2");
  });

  it("rejects duplicate registration and treats expired sessions as anonymous", async () => {
    const t = testApp();
    const registered = await jsonRequest(t, "/api/account/register", { loginId: "tanaka", password: "correct horse" });
    const cookie = cookieFrom(registered);
    const usersBefore = t.db.prepare("SELECT * FROM users").all();
    const sessionsBefore = t.db.prepare("SELECT * FROM sessions").all();
    const foreignDuplicate = await jsonRequest(t, "/api/account/register", {
      loginId: "TANAKA", password: "correct horse 2",
    });
    expect(foreignDuplicate.status).toBe(409);
    expect((await foreignDuplicate.json()).error.code).toBe("CONFLICT");
    expect(t.db.prepare("SELECT * FROM users").all()).toEqual(usersBefore);
    expect(t.db.prepare("SELECT * FROM sessions").all()).toEqual(sessionsBefore);
    const duplicate = await jsonRequest(t, "/api/account/register", { loginId: "TANAKA", password: "correct horse 2" }, { cookie });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe("CONFLICT");
    expect(duplicate.headers.get("cache-control")).toBe("no-store");
    const token = cookie.split("=", 2)[1]!;
    t.db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(1700000000000, hashSessionToken(token));
    const expired = await t.app.request("/api/account", { headers: { cookie } });
    expect(expired.status).toBe(200);
    expect((await expired.json()).loginId).toBeNull();
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 2 });
  });

  it("keeps a display name when registration omits it", async () => {
    const t = testApp();
    const account = await t.app.request("/api/account");
    const cookie = cookieFrom(account);
    const updated = await t.app.request("/api/account", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Taro" }),
    });
    expect(updated.status).toBe(200);
    const registered = await jsonRequest(t, "/api/account/register", {
      loginId: "tanaka", password: "correct horse",
    }, { cookie });
    expect(registered.status).toBe(201);
    expect((await registered.json()).account.displayName).toBe("Taro");
  });

  it("registers as a new user when an account session has expired", async () => {
    const t = testApp();
    const first = await jsonRequest(t, "/api/account/register", { loginId: "tanaka", password: "correct horse" });
    const oldCookie = cookieFrom(first);
    const oldAccount = await first.clone().json() as { account: { userId: string } };
    t.db.prepare("UPDATE sessions SET expires_at = ?").run(1700000000000);

    const second = await jsonRequest(t, "/api/account/register", {
      loginId: "suzuki", password: "correct horse 2",
    }, { cookie: oldCookie });
    expect(second.status).toBe(201);
    const body = await second.json();
    expect(body.account.userId).not.toBe(oldAccount.account.userId);
    expect(t.db.prepare("SELECT login_id FROM users WHERE id = ?").get(oldAccount.account.userId)).toEqual({
      login_id: "tanaka",
    });
    expect(t.db.prepare("SELECT login_id FROM users WHERE id = ?").get(body.account.userId)).toEqual({
      login_id: "suzuki",
    });
  });
});
