import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, listProjects, RESPONSE_INVALID_MESSAGE } from "../src/api/client";

const projects = [{
  id: "p1",
  name: "Robot",
  createdAt: 1_700_000_000_000,
  lastOpenedAt: 1_700_000_000_001,
  versionCount: 2,
  role: "owner" as const,
  canManage: true,
}];

function response(status: number, body: unknown): Response {
  return { status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("listProjects", () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("gets and validates the project list", async () => {
    fetchMock.mockResolvedValue(response(200, projects));
    await expect(listProjects()).resolves.toEqual(projects);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects", { method: "GET" });
  });

  it("reports an invalid list response", async () => {
    fetchMock.mockResolvedValue(response(200, [{ ...projects[0], role: "admin" }]));
    await expect(listProjects()).rejects.toEqual(
      new ApiClientError(200, "VALIDATION", RESPONSE_INVALID_MESSAGE),
    );
  });
});
