import type { Comment, CommentStatus, ModelVersion, Project } from "@shared/types";
import { CommentSchema, ModelVersionSchema, ProjectSchema } from "@shared/types";
import { ApiErrorSchema } from "@shared/api";
import type { CreateCommentInput } from "@shared/api";
import { z } from "zod";

const API_BASE = "";
export const RESPONSE_INVALID_MESSAGE = "サーバーの応答を解釈できませんでした。";

export class ApiClientError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

function statusErrorMessage(status: number): string {
  return `API request failed with status ${status}`;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Network request failed";
    throw new ApiClientError(0, "INTERNAL", message);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.status < 200 || response.status >= 300) {
      throw new ApiClientError(response.status, "INTERNAL", statusErrorMessage(response.status));
    }
    throw new ApiClientError(response.status, "VALIDATION", "API response was not valid JSON");
  }

  if (response.status < 200 || response.status >= 300) {
    const parsedError = ApiErrorSchema.safeParse(body);
    if (parsedError.success) {
      throw new ApiClientError(
        response.status,
        parsedError.data.error.code,
        parsedError.data.error.message,
      );
    }
    throw new ApiClientError(response.status, "INTERNAL", statusErrorMessage(response.status));
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError(response.status, "VALIDATION", RESPONSE_INVALID_MESSAGE);
  }
  return parsed.data;
}

/** モデル本体の URL。fetch はしない(useGLTF に渡す) */
export function modelUrl(projectId: string, versionId: string): string {
  return `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/model`;
}

/** FormData に name と、files の順で file を複数 append して POST /api/projects */
export function createProject(name: string, files: readonly File[]): Promise<Project> {
  const body = new FormData();
  body.append("name", name);
  for (const file of files) {
    body.append("file", file);
  }
  return requestJson("/api/projects", { method: "POST", body }, ProjectSchema);
}

/** POST /api/projects/:projectId/versions に file 1件を送り、ModelVersionSchema で検証して返す */
export function addModelVersion(projectId: string, file: File): Promise<ModelVersion> {
  const body = new FormData();
  body.append("file", file);
  return requestJson(
    `/api/projects/${encodeURIComponent(projectId)}/versions`,
    { method: "POST", body },
    ModelVersionSchema,
  );
}

/** DELETE /api/projects/:projectId/versions/:versionId。成功時の本文は読まない。 */
export async function deleteModelVersion(projectId: string, versionId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
      { method: "DELETE" },
    );
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Network request failed";
    throw new ApiClientError(0, "INTERNAL", message);
  }

  if (response.status >= 200 && response.status < 300) return;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(response.status, "INTERNAL", statusErrorMessage(response.status));
  }
  const parsedError = ApiErrorSchema.safeParse(body);
  if (parsedError.success) {
    throw new ApiClientError(
      response.status,
      parsedError.data.error.code,
      parsedError.data.error.message,
    );
  }
  throw new ApiClientError(response.status, "INTERNAL", statusErrorMessage(response.status));
}

export function getProject(projectId: string): Promise<Project> {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}`, { method: "GET" }, ProjectSchema);
}

export function listComments(projectId: string, status?: CommentStatus): Promise<Comment[]> {
  const query = status === undefined ? "" : `?status=${status}`;
  return requestJson(
    `/api/projects/${encodeURIComponent(projectId)}/comments${query}`,
    { method: "GET" },
    z.array(CommentSchema),
  );
}

export function createComment(
  projectId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  return requestJson(
    `/api/projects/${encodeURIComponent(projectId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    CommentSchema,
  );
}

export function updateCommentStatus(
  projectId: string,
  commentId: string,
  status: CommentStatus,
): Promise<Comment> {
  return requestJson(
    `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    CommentSchema,
  );
}
