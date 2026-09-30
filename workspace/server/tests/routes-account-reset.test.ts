import { afterEach, describe, expect, it } from "vitest";
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

async function register(t: TestApp) {
  const response = await post(t, "/api/account/register", { loginId: "tanaka", password: "correct horse" });
  const body = await response.json() as { account: { userId: string }; recoveryCode: string };
  return { ...body, cookie: cookieFrom(response) };
}

describe("account password reset routes", () => {
  it("resets by a normalized recovery code and invalidates old sessions", async () => {
    const t = testApp();
    const registered = await register(t);
    const otherLogin = await post(t, "/api/account/login", {
      loginId: "tanaka", password: "correct horse",
    }, undefined, "192.0.2.2");
    const otherCookie = cookieFrom(otherLogin);
    const reset = await post(t, "/api/account/password-reset", {
      loginId: "TANAKA",
      recoveryCode: registered.recoveryCode.replaceAll("-", "").toUpperCase(),
      newPassword: "reset password 1",
    });
    expect(reset.status).toBe(200);
    expect(reset.headers.get("cache-control")).toBe("no-store");
    expect(reset.headers.get("set-cookie")).toContain("Max-Age=2592000");
    const body = await reset.json() as { account: { loginId: string }; recoveryCode: string };
    expect(body.account.loginId).toBe("tanaka");
    expect(body.recoveryCode).not.toBe(registered.recoveryCode);
    expect(JSON.stringify(t.db.prepare("SELECT * FROM users").get())).not.toContain("reset password 1");

    const staleOther = await t.app.request("/api/account", { headers: { cookie: otherCookie } });
    expect(await staleOther.json()).toMatchObject({ loginId: null });
    expect((await post(t, "/api/account/login", {
      loginId: "tanaka", password: "correct horse",
    })).status).toBe(401);
    expect((await post(t, "/api/account/login", {
      loginId: "tanaka", password: "reset password 1",
    })).status).toBe(200);

    const reused = await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: registered.recoveryCode, newPassword: "another password",
    });
    expect(reused.status).toBe(401);
    expect(await reused.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Invalid login ID or recovery code" },
    });

    const nextReset = await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: body.recoveryCode, newPassword: "reset password 2",
    });
    expect(nextReset.status).toBe(200);
  });

  it("uses the same unauthorized response and dummy verification for unknown IDs", async () => {
    const t = testApp();
    const registered = await register(t);
    const before = t.db.prepare("SELECT password_hash, recovery_code_hash FROM users WHERE id = ?")
      .get(registered.account.userId);
    const knownIdWrongCode = await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: "0".repeat(32), newPassword: "new password 1",
    });
    const code = "0".repeat(32);
    const wrong = await post(t, "/api/account/password-reset", {
      loginId: "missing", recoveryCode: code, newPassword: "new password 1",
    });
    const invalidCode = await post(t, "/api/account/password-reset", {
      loginId: "missing", recoveryCode: "1".repeat(32), newPassword: "new password 1",
    }, undefined, "192.0.2.2");
    expect(knownIdWrongCode.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(invalidCode.status).toBe(401);
    const knownError = await knownIdWrongCode.json();
    const missingError = await wrong.json();
    expect(knownError).toEqual(missingError);
    expect(missingError).toEqual(await invalidCode.json());
    expect(t.db.prepare("SELECT password_hash, recovery_code_hash FROM users WHERE id = ?")
      .get(registered.account.userId)).toEqual(before);

    for (let i = 0; i < 10; i += 1) {
      expect((await post(t, "/api/account/password-reset", {
        loginId: "missing", recoveryCode: code, newPassword: "new password 1",
      }, undefined, "192.0.2.3")).status).toBe(401);
    }
    const blocked = await post(t, "/api/account/password-reset", {
      loginId: "missing", recoveryCode: code, newPassword: "new password 1",
    }, undefined, "192.0.2.3");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
  });

  it("merges an anonymous project's owner during reset", async () => {
    const t = testApp();
    const registered = await register(t);
    t.ids.push("p1", "v1");
    const form = new FormData();
    form.append("name", "Anonymous project");
    form.append("file", new File(["glTF12345678"], "model.glb"));
    const project = await t.app.request("/api/projects", { method: "POST", body: form });
    const anonymousCookie = cookieFrom(project);
    const reset = await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: registered.recoveryCode, newPassword: "reset password 1",
    }, anonymousCookie);
    expect(reset.status).toBe(200);
    expect(t.db.prepare("SELECT owner_id FROM projects WHERE id = 'p1'").get()).toEqual({
      owner_id: registered.account.userId,
    });
    expect(t.db.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 });
    expect(cookieFrom(reset)).not.toBe(anonymousCookie);
  });

  it("validates the new password before checking the recovery code", async () => {
    const t = testApp();
    const registered = await register(t);
    const invalid = await post(t, "/api/account/password-reset", {
      loginId: "tanaka", recoveryCode: registered.recoveryCode, newPassword: "tanaka",
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("VALIDATION");
  });

  it("consumes a recovery code atomically when reset requests race", async () => {
    const t = testApp();
    const registered = await register(t);
    const responses = await Promise.all([
      post(t, "/api/account/password-reset", {
        loginId: "tanaka", recoveryCode: registered.recoveryCode, newPassword: "reset password 1",
      }, undefined, "192.0.2.4"),
      post(t, "/api/account/password-reset", {
        loginId: "tanaka", recoveryCode: registered.recoveryCode, newPassword: "reset password 2",
      }, undefined, "192.0.2.4"),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  });
});
