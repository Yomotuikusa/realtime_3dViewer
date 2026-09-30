import { afterEach, describe, expect, it } from "vitest";
import { hashRecoveryCode } from "../src/identity/recovery-code";
import { makeTestApp, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.cleanup();
});

function testApp() {
  const app = makeTestApp({ trustProxy: true });
  apps.push(app);
  return app;
}

function cookieFrom(response: Response): string {
  const value = response.headers.get("set-cookie");
  expect(value).toBeTruthy();
  return value!.split(";", 1)[0]!;
}

async function post(t: TestApp, path: string, body: unknown, cookie?: string, ip = "192.0.2.1") {
  return await t.app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function register(t: TestApp, loginId = "tanaka") {
  const response = await post(t, "/api/account/register", { loginId, password: "correct horse" });
  expect(response.status).toBe(201);
  const body = await response.json() as { account: { userId: string }; recoveryCode: string };
  return { ...body, cookie: cookieFrom(response) };
}

describe("account password routes", () => {
  it("changes the password, rotates this session, and invalidates other sessions", async () => {
    const t = testApp();
    const registered = await register(t);
    const secondLogin = await post(t, "/api/account/login", {
      loginId: "tanaka", password: "correct horse",
    }, undefined, "192.0.2.2");
    const secondCookie = cookieFrom(secondLogin);

    const changed = await post(t, "/api/account/password", {
      currentPassword: "correct horse", newPassword: "new password 1",
    }, registered.cookie);
    expect(changed.status).toBe(200);
    const changedBody = await changed.json() as { userId: string; loginId: string; displayName: null };
    expect(changedBody).toEqual({
      userId: registered.account.userId, loginId: "tanaka", displayName: null,
    });
    expect(JSON.stringify(changedBody)).not.toContain("new password 1");
    const newCookie = cookieFrom(changed);
    expect(newCookie).not.toBe(registered.cookie);
    expect(changed.headers.get("set-cookie")).toContain("Max-Age=2592000");
    expect(changed.headers.get("cache-control")).toBe("no-store");
    expect(t.db.prepare("SELECT recovery_code_hash FROM users WHERE id = ?").get(registered.account.userId))
      .toEqual({ recovery_code_hash: hashRecoveryCode(registered.recoveryCode) });

    const staleSecond = await t.app.request("/api/account", { headers: { cookie: secondCookie } });
    const staleFirst = await t.app.request("/api/account", { headers: { cookie: registered.cookie } });
    const current = await t.app.request("/api/account", { headers: { cookie: newCookie } });
    expect(await staleSecond.json()).toMatchObject({ loginId: null });
    expect(await staleFirst.json()).toMatchObject({ loginId: null });
    expect(await current.json()).toMatchObject({ loginId: "tanaka" });

    expect((await post(t, "/api/account/login", {
      loginId: "tanaka", password: "correct horse",
    })).status).toBe(401);
    expect((await post(t, "/api/account/login", {
      loginId: "tanaka", password: "new password 1",
    })).status).toBe(200);
  });

  it("rejects unauthenticated, invalid, and incorrect password changes", async () => {
    const t = testApp();
    const unauthenticated = await post(t, "/api/account/password", {
      currentPassword: "correct horse", newPassword: "new password 1",
    });
    expect(unauthenticated.status).toBe(401);
    expect((await unauthenticated.json()).error).toEqual({ code: "UNAUTHORIZED", message: "Sign in required" });

    t.ids.push("p1", "v1");
    const form = new FormData();
    form.append("name", "Anonymous project");
    form.append("file", new File(["glTF12345678"], "model.glb"));
    const project = await t.app.request("/api/projects", { method: "POST", body: form });
    const anonymousCookie = cookieFrom(project);
    const anonymous = await post(t, "/api/account/password", {
      currentPassword: "correct horse", newPassword: "new password 1",
    }, anonymousCookie);
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).error).toEqual({ code: "UNAUTHORIZED", message: "Sign in required" });

    const registered = await register(t);
    const wrong = await post(t, "/api/account/password", {
      currentPassword: "wrong password", newPassword: "new password 1",
    }, registered.cookie);
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).error).toEqual({ code: "FORBIDDEN", message: "Current password is incorrect" });
    expect((await post(t, "/api/account/login", {
      loginId: "tanaka", password: "correct horse",
    })).status).toBe(200);

    for (const newPassword of ["tanaka", "TANAKA", "1234567"]) {
      const invalid = await post(t, "/api/account/password", {
        currentPassword: "correct horse", newPassword,
      }, registered.cookie, "192.0.2.2");
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).error.code).toBe("VALIDATION");
    }
  });

  it("shares the ID and IP failure limits with login", async () => {
    const t = testApp();
    const registered = await register(t);
    for (let i = 0; i < 10; i += 1) {
      const response = await post(t, "/api/account/password", {
        currentPassword: "wrong password", newPassword: "new password 1",
      }, registered.cookie);
      expect(response.status).toBe(403);
    }
    const blocked = await post(t, "/api/account/password", {
      currentPassword: "correct horse", newPassword: "new password 1",
    }, registered.cookie);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
  });

  it("regenerates a recovery code without changing the session", async () => {
    const t = testApp();
    const registered = await register(t);
    const regenerated = await post(t, "/api/account/recovery-code", { password: "correct horse" }, registered.cookie);
    expect(regenerated.status).toBe(200);
    expect(regenerated.headers.get("cache-control")).toBe("no-store");
    expect(regenerated.headers.get("set-cookie")).toBeNull();
    const body = await regenerated.json() as { account: { loginId: string }; recoveryCode: string };
    expect(body.account.loginId).toBe("tanaka");
    expect(body.recoveryCode).not.toBe(registered.recoveryCode);
    expect(body.recoveryCode).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/);
    expect(JSON.stringify(body)).not.toContain("correct horse");
    expect(JSON.stringify(t.db.prepare("SELECT * FROM users").get())).not.toContain(body.recoveryCode);
    expect(JSON.stringify(t.db.prepare("SELECT * FROM users").get())).not.toContain("correct horse");
    const current = await t.app.request("/api/account", { headers: { cookie: registered.cookie } });
    expect(await current.json()).toMatchObject({ loginId: "tanaka" });
    expect((await post(t, "/api/account/recovery-code", { password: "wrong password" }, registered.cookie)).status)
      .toBe(403);
    expect((await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: registered.recoveryCode, newPassword: "reset password 1",
    })).status).toBe(401);
    expect((await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: body.recoveryCode, newPassword: "reset password 1",
    })).status).toBe(200);

    const unauthenticated = await post(t, "/api/account/recovery-code", { password: "correct horse" });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");
    expect((await unauthenticated.json()).error).toEqual({ code: "UNAUTHORIZED", message: "Sign in required" });
  });
});
