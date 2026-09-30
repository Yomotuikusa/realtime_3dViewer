import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, regenerateRecoveryCode, resetPassword } from "../src/api/account";

const account = { userId: "u1", loginId: "tanaka", displayName: "田中" };
const result = { account, recoveryCode: "0123-4567-89ab-cdef-0123-4567-89ab-cdef" };

function response(body: unknown): Response {
  return { status: 200, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("password account API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("posts a password change as JSON and validates its account", async () => {
    fetchMock.mockResolvedValue(response(account));
    await expect(changePassword({ currentPassword: "old", newPassword: "newpassword" })).resolves.toEqual(account);
    expect(fetchMock).toHaveBeenCalledWith("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "old", newPassword: "newpassword" }),
    });
  });

  it("posts password reset and recovery-code regeneration as JSON", async () => {
    fetchMock.mockResolvedValueOnce(response(result)).mockResolvedValueOnce(response(result));
    await resetPassword({ loginId: "tanaka", recoveryCode: "code", newPassword: "newpassword" });
    await regenerateRecoveryCode({ password: "password" });
    expect(fetchMock.mock.calls).toEqual([
      ["/api/account/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: "tanaka", recoveryCode: "code", newPassword: "newpassword" }),
      }],
      ["/api/account/recovery-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "password" }),
      }],
    ]);
  });
});
