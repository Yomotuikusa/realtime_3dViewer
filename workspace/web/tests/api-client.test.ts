import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateCommentInput } from "@shared/api";
import {
  ApiClientError,
  createComment,
  createProject,
  getProject,
  listComments,
  modelUrl,
  updateCommentStatus,
} from "../src/api/client";

const project = {
  id: "project-1",
  name: "Robot",
  createdAt: 1_700_000_000_000,
  latestVersion: {
    id: "version-1",
    projectId: "project-1",
    number: 1,
    fileName: "robot.glb",
    byteSize: 12,
    createdAt: 1_700_000_000_000,
  },
};

const comment = {
  id: "comment-1",
  projectId: "project-1",
  versionId: "version-1",
  authorName: "Alice",
  body: "Please review this.",
  anchor: [1, 2, 3],
  camera: { position: [1, 2, 3], target: [0, 0, 0] },
  strokes: [],
  status: "open" as const,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const input: CreateCommentInput = {
  versionId: "version-1",
  authorName: "Alice",
  body: "Please review this.",
  anchor: [1, 2, 3],
  camera: { position: [1, 2, 3], target: [0, 0, 0] },
  strokes: [],
};

function response(status: number, body: unknown): Response {
  return { status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("builds the model URL without fetching", () => {
    expect(modelUrl("p1", "v1")).toBe("/api/projects/p1/versions/v1/model");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gets and validates a project", async () => {
    fetchMock.mockResolvedValue(response(200, project));

    await expect(getProject("p1")).resolves.toEqual(project);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", { method: "GET" });
  });

  it("maps a structured API error to ApiClientError", async () => {
    fetchMock.mockResolvedValue(response(404, { error: { code: "NOT_FOUND", message: "no" } }));

    await expect(getProject("p1")).rejects.toEqual(
      new ApiClientError(404, "NOT_FOUND", "no"),
    );
  });

  it("uses an internal error for an unparseable error response", async () => {
    fetchMock.mockResolvedValue(response(500, "<html>error</html>"));

    const result = getProject("p1");
    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    await expect(result).rejects.toMatchObject({ status: 500, code: "INTERNAL" });
    await expect(result).rejects.toHaveProperty("message", expect.stringContaining("500"));
  });

  it("reports validation errors for an invalid success body", async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await expect(getProject("p1")).rejects.toMatchObject({ code: "VALIDATION", status: 200 });
  });

  it("maps a rejected fetch to a network ApiClientError", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(getProject("p1")).rejects.toEqual(new ApiClientError(0, "INTERNAL", "offline"));
  });

  it("uploads a project as FormData without a Content-Type header", async () => {
    const file = new File(["model"], "robot.glb");
    fetchMock.mockResolvedValue(response(201, project));

    await expect(createProject("Robot", file)).resolves.toEqual(project);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get("name")).toBe("Robot");
    expect(body.get("file")).toBe(file);
  });

  it("lists comments with and without a status query", async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(response(200, []));

    await expect(listComments("p1")).resolves.toEqual([]);
    await expect(listComments("p1", "open")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects/p1/comments", { method: "GET" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/p1/comments?status=open", { method: "GET" });
  });

  it("creates a comment with a JSON request", async () => {
    fetchMock.mockResolvedValue(response(201, comment));

    await expect(createComment("p1", input)).resolves.toEqual(comment);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/p1/comments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  });

  it("updates comment status with PATCH and validates the comment", async () => {
    fetchMock.mockResolvedValue(response(200, { ...comment, status: "resolved" }));

    await expect(updateCommentStatus("p1", "c1", "resolved")).resolves.toEqual({
      ...comment,
      status: "resolved",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/p1/comments/c1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      },
    );
  });
});
