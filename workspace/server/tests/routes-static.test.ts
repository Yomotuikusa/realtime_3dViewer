import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentTypeFor, resolveStaticPath } from "../src/routes/static";
import { makeTestApp } from "./helpers/app";
import { makeTmpDir, removeTmpDir } from "./helpers/tmp";

const apps: Array<ReturnType<typeof makeTestApp>> = [];
const roots: string[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function makeStaticApp(): { app: ReturnType<typeof makeTestApp>; root: string } {
  const container = makeTmpDir("dist");
  const root = join(container, "dist");
  mkdirSync(root);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), "<!doctype html><main>app</main>");
  writeFileSync(join(root, "assets", "app.js"), "console.log('app');");
  writeFileSync(join(root, "favicon.ico"), "icon");
  roots.push(container);
  const app = makeTestApp({ webDistDir: root });
  apps.push(app);
  return { app, root };
}

describe("static helpers", () => {
  it("maps supported extensions and defaults unknown extensions", () => {
    const types = {
      html: "text/html; charset=utf-8",
      js: "text/javascript; charset=utf-8",
      mjs: "text/javascript; charset=utf-8",
      css: "text/css; charset=utf-8",
      json: "application/json",
      svg: "image/svg+xml",
      png: "image/png",
      ico: "image/x-icon",
      woff2: "font/woff2",
      map: "application/json",
      glb: "model/gltf-binary",
      wasm: "application/wasm",
    };
    for (const [extension, type] of Object.entries(types)) {
      expect(contentTypeFor(`a.${extension}`)).toBe(type);
    }
    expect(contentTypeFor("a.unknownext")).toBe("application/octet-stream");
  });

  it("resolves only paths below the root", () => {
    expect(resolveStaticPath("/r", "/assets/a.js")).toBe(join("/r", "assets/a.js"));
    expect(resolveStaticPath("/r", "/")).toBe("/r");
    expect(resolveStaticPath("/r", "/../x")).toBeNull();
    expect(resolveStaticPath("/r", "/a/../../x")).toBeNull();
    expect(resolveStaticPath("/r", "/a b")).toBeNull();
  });
});

describe("static routes", () => {
  it("serves the entrypoint, assets, favicon, and SPA paths", async () => {
    const { app } = makeStaticApp();

    const index = await app.app.request("/");
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("<main>app</main>");
    expect(index.headers.get("content-type")).toContain("text/html; charset=utf-8");
    expect(index.headers.get("cache-control")).toBe("no-cache");

    const asset = await app.app.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("console.log('app');");
    expect(asset.headers.get("content-type")).toContain("text/javascript; charset=utf-8");
    expect(asset.headers.get("cache-control")).toContain("immutable");

    const favicon = await app.app.request("/favicon.ico");
    expect(favicon.status).toBe(200);
    expect(favicon.headers.get("content-type")).toContain("image/x-icon");
    expect(favicon.headers.get("cache-control")).toBe("no-cache");

    for (const path of ["/p/abc-123_X", "/p/abc/deep"]) {
      const response = await app.app.request(path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<main>app</main>");
    }
  });

  it("supports HEAD and does not serve missing files with extensions", async () => {
    const { app } = makeStaticApp();

    const head = await app.app.request("/", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers.get("content-type")).toContain("text/html; charset=utf-8");

    const missing = await app.app.request("/missing.png");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Not Found" },
    });
  });

  it("does not let static routes intercept APIs, writes, or traversal", async () => {
    const { app, root } = makeStaticApp();
    writeFileSync(join(root, "..", "outside.txt"), "outside-secret");

    const project = await app.app.request("/api/projects/nope");
    expect(project.status).toBe(404);
    expect(await project.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Project not found" },
    });

    const unknownApi = await app.app.request("/api/unknown-route");
    expect(unknownApi.status).toBe(404);
    expect(await unknownApi.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Not Found" },
    });

    const post = await app.app.request("/", { method: "POST" });
    expect(post.status).toBe(404);
    expect(await post.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Not Found" },
    });

    for (const path of ["/%2e%2e/outside.txt", "/../outside.txt"]) {
      const traversal = await app.app.request(path);
      expect(await traversal.text()).not.toContain("outside-secret");
    }
  });

  it("passes through when the dist root does not exist", async () => {
    const parent = makeTmpDir("missing-dist");
    const app = makeTestApp({ webDistDir: join(parent, "not-found") });
    apps.push(app);
    const response = await app.app.request("/");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Not Found" },
    });
    roots.push(parent);
  });
});
