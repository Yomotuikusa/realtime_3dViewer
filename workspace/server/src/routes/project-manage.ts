import type { Context, Hono } from "hono";
import { Hono as HonoApp } from "hono";
import { RenameProjectInput } from "@shared/api";
import type { AppDeps } from "../app";
import { findProjectOwnerId, findProject, renameProject, deleteProject } from "../db/projects";
import { canManageProject, removeProjectMembership } from "../db/project-members";
import { HttpError } from "../errors";
import { ensureUser, identityDepsFrom } from "../identity/session";

function notFound(message: string): never {
  throw new HttpError(404, "NOT_FOUND", message);
}

function forbidden(): never {
  throw new HttpError(403, "FORBIDDEN", "Only the project owner can manage this project");
}

async function parseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Request body must be valid JSON");
  }
}

function identity(deps: Required<AppDeps>, c: Context): string {
  return ensureUser(c, identityDepsFrom(deps));
}

export function projectManageRoutes(deps: Required<AppDeps>): Hono {
  const routes = new HonoApp();

  routes.patch("/:projectId", async (c) => {
    const projectId = c.req.param("projectId");
    const ownerId = findProjectOwnerId(deps.db, projectId);
    if (ownerId === undefined) notFound("Project not found");
    if (!canManageProject(ownerId, identity(deps, c))) forbidden();

    const input = RenameProjectInput.parse(await parseJson(c));
    if (!renameProject(deps.db, projectId, input.name)) notFound("Project not found");
    const project = findProject(deps.db, projectId);
    if (!project) notFound("Project not found");
    return c.json(project);
  });

  routes.delete("/:projectId", async (c) => {
    const projectId = c.req.param("projectId");
    const ownerId = findProjectOwnerId(deps.db, projectId);
    if (ownerId === undefined) notFound("Project not found");
    if (!canManageProject(ownerId, identity(deps, c))) forbidden();

    const versionIds = deleteProject(deps.db, projectId);
    if (versionIds === null) notFound("Project not found");
    await Promise.all(versionIds.map((versionId) => deps.storage.deleteModelFile(versionId)));
    return c.body(null, 204);
  });

  routes.delete("/:projectId/membership", (c) => {
    const projectId = c.req.param("projectId");
    if (findProjectOwnerId(deps.db, projectId) === undefined) notFound("Project not found");
    removeProjectMembership(deps.db, projectId, identity(deps, c));
    return c.body(null, 204);
  });

  return routes;
}
