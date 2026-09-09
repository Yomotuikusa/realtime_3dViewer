import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTestApp } from "./helpers/app";

const apps: Array<ReturnType<typeof makeTestApp>> = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

describe("createApp", () => {
  it("returns JSON NOT_FOUND for unknown API and non-API paths", async () => {
    const testApp = makeTestApp();
    apps.push(testApp);
    for (const path of ["/api/unknown", "/"]) {
      const response = await testApp.app.request(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(await response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Not Found" },
      });
    }
  });

  it("converts unexpected route errors into a generic 500 response", async () => {
    const testApp = makeTestApp();
    apps.push(testApp);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    testApp.db.close();
    const response = await testApp.app.request("/api/projects/p1");
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL", message: "Internal Server Error" },
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(errorLog.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: "error",
      msg: "request_failed",
      method: "GET",
      path: "/api/projects/p1",
    });
    expect(entry.error).toEqual(expect.any(String));
    expect(entry.stack).toEqual(expect.any(String));
    errorLog.mockRestore();
  });

  it("does not log expected HTTP errors", async () => {
    const testApp = makeTestApp();
    apps.push(testApp);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await testApp.app.request("/api/projects/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
