import { describe, expect, it } from "vitest";
import { formatOpenedAt, projectMeta } from "../src/features/projects/projects-labels";

describe("project list labels", () => {
  it("formats local opened time with zero padding", () => {
    expect(formatOpenedAt(new Date(2026, 8, 29, 9, 5).getTime())).toBe("2026/09/29 09:05");
  });

  it("formats project metadata", () => {
    expect(projectMeta({ versionCount: 3, lastOpenedAt: new Date(2026, 0, 2, 13, 4).getTime() }))
      .toBe("オブジェクト 3 個 · 最終オープン 2026/01/02 13:04");
  });
});
