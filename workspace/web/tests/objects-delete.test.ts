/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DELETE_CONFIRM_LABEL,
  DELETE_DIALOG_TITLE,
  DELETE_FAILED,
  DELETE_LABEL,
  DELETING_LABEL,
  countCommentsForVersion,
  deleteAriaLabel,
  deleteConfirmMessage,
} from "../src/features/objects/objects-labels";
import { COMPOSER_NO_OBJECTS_MESSAGE } from "../src/features/comments/comment-labels";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const objectList = readFileSync(join(srcDir, "features/objects/ObjectList.tsx"), "utf8");
const deleteDialog = readFileSync(join(srcDir, "features/objects/DeleteObjectDialog.tsx"), "utf8");
const objectsCss = readFileSync(join(srcDir, "features/objects/objects.css"), "utf8");
const reviewPage = readFileSync(join(srcDir, "app/ReviewPage.tsx"), "utf8");

describe("object deletion labels", () => {
  it("formats deletion labels and confirmation messages", () => {
    expect(DELETE_LABEL).toBe("削除");
    expect(DELETING_LABEL).toBe("削除中…");
    expect(DELETE_DIALOG_TITLE).toBe("オブジェクトを削除");
    expect(DELETE_CONFIRM_LABEL).toBe("削除する");
    expect(DELETE_FAILED).toBe("オブジェクトの削除に失敗しました。");
    expect(deleteAriaLabel({ fileName: "a.glb" })).toBe("a.glb を削除");
    expect(deleteConfirmMessage("a.glb", 0)).toBe("a.glb を削除します。元に戻せません。");
    expect(deleteConfirmMessage("a.glb", 3)).toBe(
      "a.glb を削除します。付いているコメント 3 件も削除されます。元に戻せません。",
    );
  });

  it("counts comments for a version", () => {
    const comments = [{ versionId: "v1" }, { versionId: "v2" }, { versionId: "v1" }];
    expect(countCommentsForVersion(comments, "v1")).toBe(2);
    expect(countCommentsForVersion([], "v1")).toBe(0);
  });
});

describe("object deletion source contracts", () => {
  it("wires the row action through the API and local removal", () => {
    expect(objectList).toContain("objects__delete");
    expect(objectList).toContain("deleteModelVersion(");
    expect(objectList).toContain("applyObjectRemoved(");
    expect(objectList).toContain("<DeleteObjectDialog");
    expect(objectList).not.toContain("window.confirm");
    expect(objectList).toContain("disabled={busy}");
  });

  it("defines an accessible fixed confirmation dialog", () => {
    expect(deleteDialog).toContain('role="alertdialog"');
    expect(deleteDialog).toContain('aria-modal="true"');
    expect(deleteDialog).toContain("btn--danger");
    expect(deleteDialog).toContain("objects-delete__backdrop");
    expect(deleteDialog).toContain("autoFocus");
    expect(objectsCss).toMatch(/\.objects-delete__backdrop\s*\{[^}]*position:\s*fixed/);
    expect(objectsCss).toContain(".objects__delete");
    expect(objectsCss).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("selects the current latest object for the composer", () => {
    expect(reviewPage).toContain("latestObjectId(");
    expect(reviewPage).toContain("COMPOSER_NO_OBJECTS_MESSAGE");
    expect(reviewPage).not.toContain("latestVersion");
    expect(COMPOSER_NO_OBJECTS_MESSAGE).toBe("オブジェクトを追加するとコメントできます。");
  });
});
