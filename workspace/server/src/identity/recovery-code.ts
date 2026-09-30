import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRecoveryCode(): string {
  const hex = randomBytes(16).toString("hex");
  return hex.match(/.{4}/g)!.join("-");
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/[\s-]/g, "").toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function recoveryCodeMatches(code: string, storedHash: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const actual = Buffer.from(hashRecoveryCode(code), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  return timingSafeEqual(actual, expected);
}
