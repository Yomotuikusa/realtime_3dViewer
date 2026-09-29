import { describe, expect, it } from "vitest";
import { ErrorCode, RenameProjectInput } from "../src/api";

describe("RenameProjectInput", () => {
  it("trims a valid project name", () => {
    expect(RenameProjectInput.parse({ name: " a " })).toEqual({ name: "a" });
  });

  it.each([
    { name: "" },
    { name: "  " },
    { name: "a".repeat(101) },
  ])("rejects an invalid project name: $name", (input) => {
    expect(RenameProjectInput.safeParse(input).success).toBe(false);
  });

  it("includes the forbidden API error code", () => {
    expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
    expect(Object.values(ErrorCode)).toHaveLength(7);
  });
});
