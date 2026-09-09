import type { Comment, CommentStatus, Project } from "@shared/types";
import { CommentSchema, ProjectSchema } from "@shared/types";
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

export function createProject(name: string, file: File): Promise<Project> {
  const body = new FormData();
  body.append("name", name);
  body.append("file", file);
  return requestJson("/api/projects", { method: "POST", body }, ProjectSchema);
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
