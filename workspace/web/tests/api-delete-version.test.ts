import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, deleteModelVersion } from "../src/api/client";

function response(status: number, body: unknown): Response {
  return { status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("delete model version API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("resolves on 204 without reading the response body and encodes ids", async () => {
    const result = response(204, null);
    fetchMock.mockResolvedValue(result);

    await expect(deleteModelVersion("p/1", "v 1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/p%2F1/versions/v%201",
      { method: "DELETE" },
    );
    expect(result.json).not.toHaveBeenCalled();
  });

  it("maps a structured not-found response", async () => {
    fetchMock.mockResolvedValue(response(404, { error: { code: "NOT_FOUND", message: "missing" } }));

    await expect(deleteModelVersion("p1", "v1")).rejects.toEqual(
      new ApiClientError(404, "NOT_FOUND", "missing"),
    );
  });

  it("uses an internal status error for an unparseable response", async () => {
    const result = response(500, "<html>error</html>");
    result.json = vi.fn().mockRejectedValue(new Error("not json"));
    fetchMock.mockResolvedValue(result);

    await expect(deleteModelVersion("p1", "v1")).rejects.toEqual(
      new ApiClientError(500, "INTERNAL", "API request failed with status 500"),
    );
  });

  it("maps a rejected fetch to a network error", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(deleteModelVersion("p1", "v1")).rejects.toEqual(
      new ApiClientError(0, "INTERNAL", "offline"),
    );
  });
});
