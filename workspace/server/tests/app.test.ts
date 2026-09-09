import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app";
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
      expect(await response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Not Found" },
      });
    }
  });

  it("converts unexpected route errors into a generic 500 response", async () => {
    const testApp = makeTestApp();
    apps.push(testApp);
    testApp.db.close();
    const response = await testApp.app.request("/api/projects/p1");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL", message: "Internal Server Error" },
    });
  });

  it("resolves injectable ids and defaults", () => {
    const ids: string[] = ["p1"];
    const deps = {
      db: {} as AppDeps["db"],
      storage: {} as AppDeps["storage"],
      config: { port: 3000, dataDir: ".", maxUploadBytes: 1 },
      publish: () => {},
      newId: () => ids.shift() ?? `id-${fallback++}`,
    } satisfies AppDeps;
    let fallback = 1;
    expect(deps.newId()).toBe("p1");
    expect(deps.newId()).toBe("id-1");
    expect(deps.newId()).toBe("id-2");
  });
});
