import { readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { Hono } from "hono";
import type { Hono as HonoType } from "hono";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

/** Return the response Content-Type for a static file path. */
export function contentTypeFor(filePath: string): string {
  return contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/** Resolve a URL path lexically while keeping it below the configured root. */
export function resolveStaticPath(root: string, urlPath: string): string | null {
  if (!urlPath.startsWith("/") || urlPath.includes("\\") || /\s|\0/.test(urlPath)) {
    return null;
  }

  const segments = urlPath.split("/");
  if (segments.some((segment) => segment === "..")) {
    return null;
  }

  const candidate = join(root, urlPath.slice(1));
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  const outside = relative(rootPath, candidatePath);
  if (outside === ".." || outside.startsWith(`..${sep}`) || outside.startsWith(sep)) {
    return null;
  }
  return candidate;
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

async function readRegularFile(path: string): Promise<Uint8Array | null> {
  try {
    if (!(await stat(path)).isFile()) return null;
    return await readFile(path);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function setFileHeaders(
  c: { header(name: string, value: string): void },
  filePath: string,
  immutable: boolean,
): void {
  c.header("Content-Type", contentTypeFor(filePath));
  c.header("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
}

/** Build the root-mounted static file and SPA fallback routes. */
export function staticRoutes(root: string): HonoType {
  const routes = new Hono();

  routes.all("*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      await next();
      return;
    }

    const rawPath = c.req.path;
    if (rawPath === "/api" || rawPath.startsWith("/api/")) {
      await next();
      return;
    }

    let urlPath: string;
    try {
      urlPath = decodeURIComponent(rawPath);
    } catch {
      await next();
      return;
    }

    if (!(await isDirectory(root))) {
      await next();
      return;
    }

    const requestedPath = resolveStaticPath(root, urlPath);
    if (requestedPath === null) {
      await next();
      return;
    }

    const requestedFile = await readRegularFile(requestedPath);
    let filePath = requestedPath;
    let data = requestedFile;
    let immutable = urlPath.startsWith("/assets/");

    if (data === null && (urlPath === "/" || extname(urlPath) === "")) {
      filePath = join(root, "index.html");
      data = await readRegularFile(filePath);
      immutable = false;
    }

    if (data === null) {
      await next();
      return;
    }

    setFileHeaders(c, filePath, immutable);
    if (c.req.method === "HEAD") return c.body(null);
    return c.body(data as Uint8Array<ArrayBuffer>);
  });

  return routes;
}
