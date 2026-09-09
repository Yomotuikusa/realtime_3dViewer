import { readFile } from "node:fs/promises";
import type { Hono } from "hono";
import { Hono as HonoApp } from "hono";
import type { AppDeps } from "../app";
import { findModelVersion, findProject } from "../db/projects";
import { HttpError } from "../errors";

function notFound(message: string): never {
  throw new HttpError(404, "NOT_FOUND", message);
}

async function readModelFile(path: string): Promise<Uint8Array> {
  try {
    return await readFile(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      notFound("Model file not found");
    }
    throw error;
  }
}

export function projectRoutes(deps: Required<AppDeps>): Hono {
  const routes = new HonoApp();

  routes.get("/:projectId", (c) => {
    const project = findProject(deps.db, c.req.param("projectId"));
    if (!project) {
      notFound("Project not found");
    }
    return c.json(project);
  });

  routes.get("/:projectId/versions/:versionId/model", async (c) => {
    const projectId = c.req.param("projectId");
    const version = findModelVersion(deps.db, projectId, c.req.param("versionId"));
    if (!version) {
      notFound("Model version not found");
    }

    const data = await readModelFile(deps.storage.modelFilePath(version.id));
    const contentType = version.fileName.toLowerCase().endsWith(".gltf")
      ? "model/gltf+json"
      : "model/gltf-binary";
    c.header("Content-Type", contentType);
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Content-Length", String(data.byteLength));
    return c.body(data as Uint8Array<ArrayBuffer>);
  });

  return routes;
}
