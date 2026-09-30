import { describe, expect, it } from "vitest";
import {
  AccountSchema,
  AccountWithRecoveryCodeSchema,
  ChangePasswordInput,
  LoginIdSchema,
  LoginInput,
  NewPasswordSchema,
  PasswordInputSchema,
  RECOVERY_CODE_PATTERN,
  RegenerateRecoveryCodeInput,
  RecoveryCodeInputSchema,
  RegisterAccountInput,
  ResetPasswordInput,
  UpdateAccountInput,
  passwordEqualsLoginId,
} from "../src/account";

describe("account schemas", () => {
  it("normalizes and validates login IDs", () => {
    expect(LoginIdSchema.parse("  Tanaka_1 ")).toBe("tanaka_1");
    for (const value of ["ab", "a".repeat(33), "たなか", "a b c"]) {
      expect(LoginIdSchema.safeParse(value).success).toBe(false);
    }
  });

  it("checks password lengths and login ID equality", () => {
    expect(NewPasswordSchema.safeParse("a".repeat(7)).success).toBe(false);
    expect(NewPasswordSchema.safeParse("a".repeat(8)).success).toBe(true);
    expect(NewPasswordSchema.safeParse("a".repeat(128)).success).toBe(true);
    expect(NewPasswordSchema.safeParse("a".repeat(129)).success).toBe(false);
    const result = RegisterAccountInput.safeParse({ loginId: "tanaka12", password: "Tanaka12" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["password"]);
    expect(passwordEqualsLoginId("ＴＡＮＡＫＡ１２", "tanaka12")).toBe(true);
  });

  it("normalizes recovery code input and validates future account schemas", () => {
    expect(RecoveryCodeInputSchema.parse("ABCD-ef01-2345-6789-abcd-ef01-2345-6789"))
      .toBe("abcdef0123456789abcdef0123456789");
    expect(RecoveryCodeInputSchema.safeParse("a".repeat(31)).success).toBe(false);
    expect(RecoveryCodeInputSchema.safeParse("a".repeat(31) + "g").success).toBe(false);
    const result = ResetPasswordInput.safeParse({
      loginId: "tanaka12", recoveryCode: "a".repeat(32), newPassword: "tanaka12",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["newPassword"]);
    expect(AccountSchema.safeParse({ userId: "u1", loginId: null, displayName: null }).success).toBe(true);
    expect(RECOVERY_CODE_PATTERN.test("abcd-ef01-2345-6789-abcd-ef01-2345-6789")).toBe(true);
  });

  it("keeps login and future password schemas aligned", () => {
    expect(LoginInput.parse({ loginId: " Tanaka ", password: "x" })).toEqual({
      loginId: "tanaka", password: "x",
    });
    expect(PasswordInputSchema.safeParse("").success).toBe(false);
    expect(UpdateAccountInput.parse({ displayName: " Taro " })).toEqual({ displayName: "Taro" });
    expect(ChangePasswordInput.safeParse({ currentPassword: "", newPassword: "password1" }).success).toBe(false);
    expect(RegenerateRecoveryCodeInput.safeParse({ password: "password1" }).success).toBe(true);
    expect(AccountWithRecoveryCodeSchema.safeParse({
      account: { userId: "u1", loginId: "tanaka", displayName: null },
      recoveryCode: "abcd-ef01-2345-6789-abcd-ef01-2345-6789",
    }).success).toBe(true);
  });
});
