import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/identity/password";

describe("password hashing", () => {
  it("hashes asynchronously with a random salt and verifies normalized passwords", async () => {
    const first = await hashPassword("password1", { logN: 10, r: 8, p: 1 });
    const second = await hashPassword("password1", { logN: 10, r: 8, p: 1 });
    expect(first.startsWith("scrypt$10$8$1$")).toBe(true);
    expect(first.split("$")).toHaveLength(6);
    expect(first).not.toBe(second);
    await expect(verifyPassword("password１", first)).resolves.toBe(true);
    await expect(verifyPassword("password2", first)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    for (const stored of ["garbage", "scrypt$99$8$1$aa$bb", "bcrypt$10$8$1$aa$bb"]) {
      await expect(verifyPassword("x", stored)).resolves.toBe(false);
    }
  });

  it("uses the strong default parameters", async () => {
    const stored = await hashPassword("password1");
    expect(stored.startsWith("scrypt$15$8$3$")).toBe(true);
    await expect(verifyPassword("password1", stored)).resolves.toBe(true);
  });
});
