import { readFile } from "node:fs/promises";
import type { Hono } from "hono";
import { Hono as HonoApp } from "hono";
import { ProjectNameSchema } from "@shared/api";
import type { AppDeps } from "../app";
import {
  findModelVersion,
  findProject,
  insertModelVersion,
  insertProject,
} from "../db/projects";
import { withTransaction } from "../db/connection";
import { HttpError } from "../errors";
import {
  assertModelBytes,
  modelExtension,
} from "./upload-validation";

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

  routes.post("/", async (c) => {
    const body = await c.req.parseBody();
    const name = ProjectNameSchema.parse(body.name);
    const file = body.file;
    if (!(file instanceof File)) {
      throw new HttpError(400, "VALIDATION", "A model file is required");
    }

    const ext = modelExtension(file.name);
    if (file.size > deps.config.maxUploadBytes) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Upload is too large");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    assertModelBytes(ext, bytes);

    const projectId = deps.newId();
    const versionId = deps.newId();
    const createdAt = deps.now();
    await deps.storage.saveModelFile(versionId, bytes);

    try {
      withTransaction(deps.db, () => {
        insertProject(deps.db, { id: projectId, name, createdAt });
        insertModelVersion(deps.db, {
          id: versionId,
          projectId,
          fileName: file.name,
          byteSize: bytes.length,
          createdAt,
        });
      });
    } catch (error) {
      await deps.storage.deleteModelFile(versionId);
      throw error;
    }

    const project = findProject(deps.db, projectId);
    if (!project) {
      throw new Error("Created project could not be found");
    }
    return c.json(project, 201);
  });

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
