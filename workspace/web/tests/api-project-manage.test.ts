import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  deleteProject,
  leaveProject,
  renameProject,
  RESPONSE_INVALID_MESSAGE,
} from "../src/api/client";

const project = {
  id: "p1",
  name: "Renamed",
  createdAt: 1,
  latestVersion: null,
  versions: [],
};

function response(status: number, body: unknown): Response {
  return { status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("project management API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renames with JSON and validates the Project response", async () => {
    fetchMock.mockResolvedValue(response(200, project));

    await expect(renameProject("p/1", "Renamed")).resolves.toEqual(project);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/p%2F1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      },
    );
  });

  it("reports an invalid successful rename response", async () => {
    fetchMock.mockResolvedValue(response(200, { id: "p1" }));

    await expect(renameProject("p1", "Name")).rejects.toEqual(
      new ApiClientError(200, "VALIDATION", RESPONSE_INVALID_MESSAGE),
    );
  });

  it("maps a forbidden response to ApiClientError", async () => {
    fetchMock.mockResolvedValue(response(403, {
      error: { code: "FORBIDDEN", message: "forbidden" },
    }));

    await expect(renameProject("p1", "Name")).rejects.toEqual(
      new ApiClientError(403, "FORBIDDEN", "forbidden"),
    );
  });

  it("deletes a project and leaves membership without reading 204 bodies", async () => {
    const first = response(204, null);
    const second = response(204, null);
    fetchMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    await expect(deleteProject("p/1")).resolves.toBeUndefined();
    await expect(leaveProject("p 1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects/p%2F1", { method: "DELETE" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/p%201/membership", { method: "DELETE" });
    expect(first.json).not.toHaveBeenCalled();
    expect(second.json).not.toHaveBeenCalled();
  });
});
