import { describe, expect, it } from "vitest";
import { ApiClientError } from "../src/api/client";
import {
  ACCOUNT_REQUEST_FAILED,
  DISPLAY_NAME_TOO_LONG,
  INPUT_INVALID,
  LOGIN_FAILED,
  LOGIN_ID_INVALID,
  LOGIN_ID_TAKEN,
  PASSWORD_MISMATCH,
  PASSWORD_SAME_AS_LOGIN_ID,
  PASSWORD_TOO_SHORT,
  TOO_MANY_ATTEMPTS,
  accountDisplayLabel,
  accountErrorMessage,
  validateRegisterForm,
} from "../src/features/account/account-labels";

describe("account labels and validation", () => {
  it.each([
    [401, "UNAUTHORIZED", LOGIN_FAILED],
    [409, "CONFLICT", LOGIN_ID_TAKEN],
    [429, "TOO_MANY_REQUESTS", TOO_MANY_ATTEMPTS],
    [400, "VALIDATION", INPUT_INVALID],
    [500, "INTERNAL", ACCOUNT_REQUEST_FAILED],
  ])("maps API error %s", (status, code, message) => {
    expect(accountErrorMessage(new ApiClientError(status, code, "x"))).toBe(message);
  });

  it("maps unknown errors and display labels", () => {
    expect(accountErrorMessage(new Error("offline"))).toBe(ACCOUNT_REQUEST_FAILED);
    expect(accountDisplayLabel({ loginId: "tanaka", displayName: null })).toBe("tanaka");
    expect(accountDisplayLabel({ loginId: "tanaka", displayName: "田中" })).toBe("田中");
  });

  it.each([
    [{ loginId: "ab", password: "password", passwordConfirm: "password", displayName: "" }, LOGIN_ID_INVALID],
    [{ loginId: " Tanaka ", password: "tanaka", passwordConfirm: "tanaka", displayName: "" }, PASSWORD_TOO_SHORT],
    [{ loginId: "Tanaka12", password: "tanaka12", passwordConfirm: "tanaka12", displayName: "" }, PASSWORD_SAME_AS_LOGIN_ID],
    [{ loginId: "tanaka", password: "password1", passwordConfirm: "password2", displayName: "" }, PASSWORD_MISMATCH],
    [{ loginId: "tanaka", password: "password1", passwordConfirm: "password1", displayName: "あ".repeat(51) }, DISPLAY_NAME_TOO_LONG],
  ])("validates %o", (input, expected) => {
    expect(validateRegisterForm(input)).toBe(expected);
  });

  it("accepts a valid registration with an empty display name", () => {
    expect(validateRegisterForm({
      loginId: "tanaka",
      password: "password1",
      passwordConfirm: "password1",
      displayName: "   ",
    })).toBeNull();
  });
});
