import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "@shared/project-list";
import { CANCEL_LABEL } from "../src/features/comments/comment-labels";
import { DeleteProjectDialog } from "../src/features/projects/DeleteProjectDialog";
import { ProjectListItem } from "../src/features/projects/ProjectListItem";
import { RenameProjectDialog } from "../src/features/projects/RenameProjectDialog";
import {
  DELETE_CONFIRM_LABEL,
  DELETE_DIALOG_TITLE,
  DELETE_LABEL,
  DELETING_LABEL,
  LEAVE_LABEL,
  NAME_REQUIRED,
  RENAME_DIALOG_TITLE,
  RENAME_LABEL,
  RENAMING_LABEL,
} from "../src/features/projects/projects-labels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const project: ProjectSummary = {
  id: "p1", name: "Robot", createdAt: 1, lastOpenedAt: 2, versionCount: 2,
  role: "owner", canManage: true,
};
const roots: Root[] = [];
const sourceUrl = new URL("../src/features/projects/DeleteProjectDialog.tsx", import.meta.url);
const deleteDialogSource = readFileSync(
  sourceUrl.protocol === "file:"
    ? fileURLToPath(sourceUrl)
    : join(process.cwd(), "web/src/features/projects/DeleteProjectDialog.tsx"),
  "utf8",
);
const renameDialogSource = readFileSync(
  join(process.cwd(), "web/src/features/projects/RenameProjectDialog.tsx"),
  "utf8",
);

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
});

async function render(element: ReactElement): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(element));
  return host;
}

describe("project management list controls", () => {
  it("shows management buttons according to canManage and role", async () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onLeave = vi.fn();
    const host = await render(createElement(ProjectListItem, {
      project, onRename, onDelete, onLeave,
    }));
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      RENAME_LABEL, DELETE_LABEL,
    ]);
    expect(host.querySelector('[aria-label="「Robot」の名前を変更"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="「Robot」を削除"]')).not.toBeNull();

    const member = { ...project, role: "member" as const, canManage: false };
    await act(async () => roots[0]!.render(createElement(ProjectListItem, {
      project: member, onRename, onDelete, onLeave,
    })));
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([LEAVE_LABEL]);

    const legacy = { ...member, canManage: true };
    await act(async () => roots[0]!.render(createElement(ProjectListItem, {
      project: legacy, onRename, onDelete, onLeave,
    })));
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      RENAME_LABEL, DELETE_LABEL, LEAVE_LABEL,
    ]);
  });

  it("renders the rename dialog form and reports its submission", async () => {
    const onSubmit = vi.fn();
    const host = await render(createElement(RenameProjectDialog, {
      project, busy: false, error: NAME_REQUIRED, onSubmit, onCancel: vi.fn(),
    }));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect(renameDialogSource).toContain("autoFocus");
    expect(host.querySelector("input")).toMatchObject({ value: "Robot", maxLength: 100 });
    expect(host.textContent).toContain(RENAME_DIALOG_TITLE);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(NAME_REQUIRED);
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(onSubmit).toHaveBeenCalledWith("Robot");
  });

  it("renders an alertdialog with a dangerous delete action", async () => {
    const host = await render(createElement(DeleteProjectDialog, {
      project, busy: true, error: "failed", onConfirm: vi.fn(), onCancel: vi.fn(),
    }));
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(host.textContent).toContain(DELETE_DIALOG_TITLE);
    expect(host.textContent).toContain("オブジェクト 2 個とコメントもすべて削除");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("failed");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons[0]?.textContent).toBe(DELETING_LABEL);
    expect(buttons[0]?.className).toContain("btn--danger");
    expect(buttons[0]).toHaveProperty("disabled", true);
    expect(buttons[1]?.textContent).toBe(CANCEL_LABEL);
    expect(buttons[1]).toHaveProperty("disabled", true);
    expect(deleteDialogSource).toContain("autoFocus");
    expect(RENAME_DIALOG_TITLE).toBe("プロジェクト名を変更");
    expect(RENAME_LABEL).toBe("名前を変更");
    expect(DELETE_CONFIRM_LABEL).toBe("削除する");
    expect(RENAMING_LABEL).toBe("変更中…");
  });
});
