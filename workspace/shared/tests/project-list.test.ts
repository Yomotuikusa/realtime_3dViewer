import { describe, expect, it } from "vitest";
import { ProjectSummarySchema } from "../src/project-list";

const summary = {
  id: "p1",
  name: "Robot",
  createdAt: 1_700_000_000_000,
  lastOpenedAt: 1_700_000_000_001,
  versionCount: 2,
  role: "owner" as const,
  canManage: true,
};

describe("ProjectSummarySchema", () => {
  it("accepts a project summary", () => {
    expect(ProjectSummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects invalid roles, counts, and names", () => {
    expect(ProjectSummarySchema.safeParse({ ...summary, role: "admin" }).success).toBe(false);
    expect(ProjectSummarySchema.safeParse({ ...summary, versionCount: -1 }).success).toBe(false);
    expect(ProjectSummarySchema.safeParse({ ...summary, name: "" }).success).toBe(false);
  });
});
