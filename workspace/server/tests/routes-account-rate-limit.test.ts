import { afterEach, describe, expect, it } from "vitest";
import { makeTestApp, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.cleanup();
});

function testApp(): TestApp {
  const app = makeTestApp({ trustProxy: true });
  apps.push(app);
  return app;
}

async function request(t: TestApp, path: string, body: unknown, ip: string): Promise<Response> {
  return await t.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("account attempt limits", () => {
  it("limits ID and IP login failures but permits another IP", async () => {
    const t = testApp();
    const registration = await request(t, "/api/account/register", { loginId: "tanaka", password: "correct horse" }, "192.0.2.1");
    expect(registration.status).toBe(201);
    for (let i = 0; i < 10; i += 1) {
      expect((await request(t, "/api/account/login", { loginId: "tanaka", password: "wrong pass" }, "192.0.2.1")).status).toBe(401);
    }
    const blocked = await request(t, "/api/account/login", { loginId: "tanaka", password: "correct horse" }, "192.0.2.1");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    expect((await request(t, "/api/account/login", { loginId: "tanaka", password: "correct horse" }, "192.0.2.2")).status).toBe(200);
  });

  it("counts failed IDs against the shared IP limit and does not count invalid JSON", async () => {
    const t = testApp();
    await request(t, "/api/account/register", { loginId: "tanaka", password: "correct horse" }, "192.0.2.1");
    for (let i = 0; i < 20; i += 1) {
      const invalid = await t.app.request("/api/account/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
        body: "{",
      });
      expect(invalid.status).toBe(400);
    }
    expect((await request(t, "/api/account/login", { loginId: "tanaka", password: "correct horse" }, "192.0.2.1")).status).toBe(200);
    for (let i = 0; i < 30; i += 1) {
      expect((await request(t, "/api/account/login", { loginId: `id${i}`, password: "wrong pass" }, "192.0.2.3")).status).toBe(401);
    }
    const blocked = await request(t, "/api/account/login", { loginId: "other", password: "wrong pass" }, "192.0.2.3");
    expect(blocked.status).toBe(429);
  });

  it("limits registration requests, including validation failures", async () => {
    const t = testApp();
    for (let i = 0; i < 10; i += 1) {
      expect((await request(t, "/api/account/register", { loginId: "x", password: "short" }, "192.0.2.4")).status).toBe(400);
    }
    const blocked = await request(t, "/api/account/register", { loginId: "tanaka", password: "correct horse" }, "192.0.2.4");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("3600");
    expect(blocked.headers.get("cache-control")).toBe("no-store");
  });
});
