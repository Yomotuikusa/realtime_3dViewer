import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccount,
  login,
  logout,
  registerAccount,
  updateDisplayName,
} from "../src/api/account";
import { ApiClientError, RESPONSE_INVALID_MESSAGE } from "../src/api/client";

const account = { userId: "u1", loginId: "tanaka", displayName: "田中" };
const anonymous = { userId: "u1", loginId: null, displayName: null };
const recovery = "0123-4567-89ab-cdef-0123-4567-89ab-cdef";

function response(status: number, body: unknown): Response {
  return { status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("account API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("gets and validates an account", async () => {
    fetchMock.mockResolvedValue(response(200, anonymous));
    await expect(getAccount()).resolves.toEqual(anonymous);
    expect(fetchMock).toHaveBeenCalledWith("/api/account", { method: "GET" });
  });

  it("reports invalid successful account responses", async () => {
    fetchMock.mockResolvedValue(response(200, { loginId: null }));
    await expect(getAccount()).rejects.toEqual(new ApiClientError(200, "VALIDATION", RESPONSE_INVALID_MESSAGE));
  });

  it("sends JSON for registration without an undefined display name", async () => {
    fetchMock.mockResolvedValue(response(201, { account, recoveryCode: recovery }));
    await registerAccount({ loginId: "a", password: "b" });
    expect(fetchMock).toHaveBeenCalledWith("/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: "a", password: "b" }),
    });
  });

  it("sends JSON for login and display-name updates", async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, account))
      .mockResolvedValueOnce(response(200, account));
    await login({ loginId: "tanaka", password: "secret" });
    await updateDisplayName("x");
    expect(fetchMock.mock.calls[0]).toEqual(["/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: "tanaka", password: "secret" }),
    }]);
    expect(fetchMock.mock.calls[1]).toEqual(["/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "x" }),
    }]);
  });

  it("resolves logout without reading the empty response body", async () => {
    const body = vi.fn();
    fetchMock.mockResolvedValue({ status: 204, json: body });
    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/account/logout", { method: "POST" });
    expect(body).not.toHaveBeenCalled();
  });

  it("converts structured API errors", async () => {
    fetchMock.mockResolvedValue(response(401, { error: { code: "UNAUTHORIZED", message: "wrong" } }));
    await expect(login({ loginId: "tanaka", password: "wrong" })).rejects.toEqual(
      new ApiClientError(401, "UNAUTHORIZED", "wrong"),
    );
  });
});
