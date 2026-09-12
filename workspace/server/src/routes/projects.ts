import { readFile } from "node:fs/promises";
import type { Hono } from "hono";
import { Hono as HonoApp } from "hono";
import { MODEL_CONTENT_TYPES, modelFormat, ProjectNameSchema } from "@shared/api";
import type { ModelVersion } from "@shared/types";
import type { AppDeps } from "../app";
import {
  findModelVersion,
  findProject,
  insertModelVersion,
  insertProject,
} from "../db/projects";
import { withTransaction } from "../db/connection";
import { HttpError } from "../errors";
import { readUploadedModels } from "./project-upload";

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
    const body = await c.req.parseBody({ all: true });
    const name = ProjectNameSchema.parse(body.name);
    const models = await readUploadedModels(body.file, deps.config.maxUploadBytes);

    const projectId = deps.newId();
    const createdAt = deps.now();
    const versions = models.map((model) => ({
      id: deps.newId(),
      ...model,
    }));
    const savedVersionIds: string[] = [];

    try {
      for (const version of versions) {
        savedVersionIds.push(version.id);
        await deps.storage.saveModelFile(version.id, version.bytes);
      }
      withTransaction(deps.db, () => {
        insertProject(deps.db, { id: projectId, name, createdAt });
        for (const version of versions) {
          insertModelVersion(deps.db, {
            id: version.id,
            projectId,
            fileName: version.fileName,
            byteSize: version.bytes.length,
            createdAt,
          });
        }
      });
    } catch (error) {
      await Promise.all(savedVersionIds.map((id) => deps.storage.deleteModelFile(id)));
      throw error;
    }

    const project = findProject(deps.db, projectId);
    if (!project) {
      throw new Error("Created project could not be found");
    }
    return c.json(project, 201);
  });

  routes.post("/:projectId/versions", async (c) => {
    const projectId = c.req.param("projectId");
    if (!findProject(deps.db, projectId)) {
      notFound("Project not found");
    }

    const body = await c.req.parseBody({ all: true });
    if (Array.isArray(body.file) && body.file.length > 1) {
      throw new HttpError(400, "VALIDATION", "Exactly one model file is required");
    }
    const models = await readUploadedModels(body.file, deps.config.maxUploadBytes);
    if (models.length !== 1) {
      throw new HttpError(400, "VALIDATION", "Exactly one model file is required");
    }

    const model = models[0]!;
    const versionId = deps.newId();
    const createdAt = deps.now();
    await deps.storage.saveModelFile(versionId, model.bytes);
    let version: ModelVersion;
    try {
      version = insertModelVersion(deps.db, {
        id: versionId,
        projectId,
        fileName: model.fileName,
        byteSize: model.bytes.length,
        createdAt,
      });
    } catch (error) {
      await deps.storage.deleteModelFile(versionId);
      throw error;
    }

    deps.publish(projectId, { type: "object:added", version });
    return c.json(version, 201);
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
    const format = modelFormat(version.fileName);
    const contentType = format ? MODEL_CONTENT_TYPES[format] : "application/octet-stream";
    c.header("Content-Type", contentType);
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Content-Length", String(data.byteLength));
    return c.body(data as Uint8Array<ArrayBuffer>);
  });

  return routes;
}
