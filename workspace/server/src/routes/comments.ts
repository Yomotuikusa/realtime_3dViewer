import type { Context, Hono } from "hono";
import { Hono as HonoApp } from "hono";
import {
  CreateCommentInput,
  ListCommentsQuery,
  UpdateCommentStatusInput,
} from "@shared/api";
import type { CommentStatus } from "@shared/types";
import type { AppDeps } from "../app";
import { insertComment, listComments, updateCommentStatus } from "../db/comments";
import { findModelVersion, findProject } from "../db/projects";
import { HttpError } from "../errors";

function notFound(message: string): never {
  throw new HttpError(404, "NOT_FOUND", message);
}

async function parseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Request body must be valid JSON");
  }
}

export function commentRoutes(deps: Required<AppDeps>): Hono {
  const routes = new HonoApp();

  routes.get("/", (c) => {
    const projectId = c.req.param("projectId")!;
    if (!findProject(deps.db, projectId)) {
      notFound("Project not found");
    }
    const query = ListCommentsQuery.parse({ status: c.req.query("status") });
    return c.json(listComments(deps.db, projectId, query.status));
  });

  routes.post("/", async (c) => {
    const projectId = c.req.param("projectId")!;
    if (!findProject(deps.db, projectId)) {
      notFound("Project not found");
    }
    const input = CreateCommentInput.parse(await parseJson(c));
    if (!findModelVersion(deps.db, projectId, input.versionId)) {
      notFound("Model version not found");
    }

    const comment = insertComment(deps.db, {
      id: deps.newId(),
      projectId,
      ...input,
      createdAt: deps.now(),
    });
    deps.publish(projectId, { type: "comment:created", comment });
    return c.json(comment, 201);
  });

  routes.patch("/:commentId", async (c) => {
    const projectId = c.req.param("projectId")!;
    if (!findProject(deps.db, projectId)) {
      notFound("Project not found");
    }
    const input = UpdateCommentStatusInput.parse(await parseJson(c));
    const comment = updateCommentStatus(
      deps.db,
      projectId,
      c.req.param("commentId")!,
      input.status as CommentStatus,
      deps.now(),
    );
    if (!comment) {
      notFound("Comment not found");
    }
    deps.publish(projectId, { type: "comment:updated", comment });
    return c.json(comment);
  });

  return routes;
}
