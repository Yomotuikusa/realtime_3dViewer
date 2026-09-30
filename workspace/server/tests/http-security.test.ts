import { describe, expect, it } from "vitest";
import { seedProject, makeTestApp } from "./helpers/app";

describe("HTTP security middleware", () => {
  it("adds HSTS only when the public origin is HTTPS", async () => {
    const httpsApp = makeTestApp({ publicOrigin: "https://review.example.com" });
    const httpApp = makeTestApp();
    try {
      const secureResponse = await httpsApp.app.request("/api/projects");
      const rejectedResponse = await httpsApp.app.request("/api/projects", {
        method: "POST",
        headers: { Origin: "http://evil.example" },
      });
      const plainResponse = await httpApp.app.request("/api/projects");
      expect(secureResponse.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
      expect(rejectedResponse.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
      expect(plainResponse.headers.has("Strict-Transport-Security")).toBe(false);
    } finally {
      httpsApp.cleanup();
      httpApp.cleanup();
    }
  });

  it("rejects cross-origin state-changing API requests", async () => {
    const t = makeTestApp();
    try {
      const post = await t.app.request("/api/projects", {
        method: "POST",
        headers: { Origin: "http://evil.example" },
      });
      expect(post.status).toBe(403);
      expect((await post.json()).error.code).toBe("FORBIDDEN");
      expect((t.db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count).toBe(0);

      const patch = await t.app.request("/api/projects/p1", {
        method: "PATCH",
        headers: { Origin: "http://localhost" },
      });
      expect(patch.status).not.toBe(403);
      const noOrigin = await t.app.request("/api/projects/p1", { method: "DELETE" });
      expect(noOrigin.status).not.toBe(403);
      const get = await t.app.request("/api/projects", {
        headers: { Origin: "http://evil.example" },
      });
      expect(get.status).toBe(200);
      const nullOrigin = await t.app.request("/api/projects", {
        method: "POST",
        headers: { Origin: "null" },
      });
      expect(nullOrigin.status).toBe(403);
    } finally {
      t.cleanup();
    }
  });

  it("uses the configured public origin for allowed state changes", async () => {
    const t = makeTestApp({ publicOrigin: "https://review.example.com" });
    try {
      seedProject(t);
      const rejected = await t.app.request("/api/projects/p1", {
        method: "POST",
        headers: { Origin: "http://localhost" },
      });
      expect(rejected.status).toBe(403);
      const allowed = await t.app.request("/api/projects/p1/membership", {
        method: "DELETE",
        headers: { Origin: "https://review.example.com" },
      });
      expect(allowed.status).not.toBe(403);
    } finally {
      t.cleanup();
    }
  });
});
