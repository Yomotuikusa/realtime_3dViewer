import { describe, expect, it } from "vitest";
import { makeTestApp } from "./helpers/app";

describe("session cookie transport security", () => {
  it("adds Secure for an HTTPS public origin and keeps the existing attributes", async () => {
    const t = makeTestApp({ publicOrigin: "https://review.example.com" });
    try {
      const response = await t.app.request("/api/projects");
      const cookie = response.headers.get("Set-Cookie") ?? "";
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
    } finally {
      t.cleanup();
    }
  });

  it("does not add Secure for an HTTP or unset public origin", async () => {
    for (const publicOrigin of [null, "http://localhost:3000"] as const) {
      const t = makeTestApp(publicOrigin === null ? {} : { publicOrigin });
      try {
        const response = await t.app.request("/api/projects");
        expect(response.headers.get("Set-Cookie") ?? "").not.toContain("Secure");
      } finally {
        t.cleanup();
      }
    }
  });
});
