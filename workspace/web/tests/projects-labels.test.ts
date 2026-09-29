import { describe, expect, it } from "vitest";
import { ApiClientError } from "../src/api/client";
import {
  actionAriaLabel,
  DELETE_LABEL,
  deleteProjectMessage,
  DELETE_DIALOG_TITLE,
  FORBIDDEN_MESSAGE,
  LEAVE_LABEL,
  projectActionErrorMessage,
  RENAME_LABEL,
} from "../src/features/projects/projects-labels";
import { formatOpenedAt, projectMeta } from "../src/features/projects/projects-labels";

describe("project list labels", () => {
  it("formats local opened time with zero padding", () => {
    expect(formatOpenedAt(new Date(2026, 8, 29, 9, 5).getTime())).toBe("2026/09/29 09:05");
  });

  it("formats project metadata", () => {
    expect(projectMeta({ versionCount: 3, lastOpenedAt: new Date(2026, 0, 2, 13, 4).getTime() }))
      .toBe("オブジェクト 3 個 · 最終オープン 2026/01/02 13:04");
  });

  it("formats project actions and deletion confirmation", () => {
    const project = { name: "Robot", versionCount: 2 };
    expect(RENAME_LABEL).toBe("名前を変更");
    expect(DELETE_LABEL).toBe("削除");
    expect(LEAVE_LABEL).toBe("一覧から外す");
    expect(DELETE_DIALOG_TITLE).toBe("プロジェクトを削除");
    expect(actionAriaLabel(RENAME_LABEL, project.name)).toBe("「Robot」の名前を変更");
    expect(actionAriaLabel(LEAVE_LABEL, project.name)).toBe("「Robot」を一覧から外す");
    expect(deleteProjectMessage(project)).toBe(
      "「Robot」を削除します。オブジェクト 2 個とコメントもすべて削除され、元に戻せません。",
    );
  });

  it("maps only forbidden errors to the owner message", () => {
    expect(projectActionErrorMessage(new ApiClientError(403, "FORBIDDEN", "no"), "fallback"))
      .toBe(FORBIDDEN_MESSAGE);
    expect(projectActionErrorMessage(new Error("no"), "fallback")).toBe("fallback");
  });
});
