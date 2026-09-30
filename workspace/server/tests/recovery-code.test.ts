import { describe, expect, it } from "vitest";
import { RECOVERY_CODE_PATTERN } from "@shared/account";
import {
  generateRecoveryCode,
  hashRecoveryCode,
  recoveryCodeMatches,
} from "../src/identity/recovery-code";

describe("recovery codes", () => {
  it("generates formatted random codes and hashes them", () => {
    const first = generateRecoveryCode();
    const second = generateRecoveryCode();
    expect(RECOVERY_CODE_PATTERN.test(first)).toBe(true);
    expect(first).not.toBe(second);
    const hash = hashRecoveryCode("abcd-ef01-2345-6789-abcd-ef01-2345-6789");
    expect(recoveryCodeMatches("ABCD EF01-2345-6789-ABCD-EF01-2345-6789", hash)).toBe(true);
    expect(recoveryCodeMatches("ABCD EF01-2345-6789-ABCD-EF01-2345-6780", hash)).toBe(false);
    expect(recoveryCodeMatches("a", hash.slice(0, 63))).toBe(false);
  });
});
