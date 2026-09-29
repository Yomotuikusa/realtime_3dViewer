import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "@shared/project-list";
import { deleteProject, leaveProject, renameProject } from "../src/api/client";
import { useProjectActions } from "../src/features/projects/useProjectActions";
import {
  DELETE_FAILED,
  DELETING_LABEL,
  FORBIDDEN_MESSAGE,
  LEAVE_FAILED,
  NAME_REQUIRED,
  RENAME_FAILED,
} from "../src/features/projects/projects-labels";

vi.mock("../src/api/client", () => ({
  deleteProject: vi.fn(),
  leaveProject: vi.fn(),
  renameProject: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const owner: ProjectSummary = {
  id: "p1", name: "Robot", createdAt: 1, lastOpenedAt: 2, versionCount: 2,
  role: "owner", canManage: true,
};
const member: ProjectSummary = {
  id: "p2", name: "Shared", createdAt: 3, lastOpenedAt: 4, versionCount: 0,
  role: "member", canManage: false,
};
const roots: Root[] = [];

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
});

function ActionHarness({ initial = [owner, member] }: { initial?: ProjectSummary[] }): ReactElement {
  const [projects, setProjects] = useState(initial);
  const actions = useProjectActions(setProjects);
  return createElement(
    "div",
    null,
    createElement("div", { "data-projects": true }, projects.map((project) =>
      createElement("span", { key: project.id, "data-project": project.id }, project.name))),
    createElement("button", { "data-open-rename": true, onClick: () => actions.openRename(owner) }),
    createElement("button", { "data-open-delete": true, onClick: () => actions.openDelete(owner) }),
    createElement("button", { "data-submit-new": true, onClick: () => void actions.submitRename("New Robot") }),
    createElement("button", { "data-submit-empty": true, onClick: () => void actions.submitRename("  ") }),
    createElement("button", { "data-submit-same": true, onClick: () => void actions.submitRename("Robot") }),
    createElement("button", { "data-confirm-delete": true, onClick: () => void actions.confirmDelete() }),
    createElement("button", { "data-leave": true, onClick: () => void actions.leave(member) }),
    createElement("span", { "data-dialog": true }, actions.dialog?.kind ?? ""),
    createElement("span", { "data-dialog-error": true }, actions.dialogError ?? ""),
    createElement("span", { "data-page-error": true }, actions.pageError ?? ""),
    createElement("span", { "data-busy": true }, String(actions.busy)),
  );
}

async function render(initial?: ProjectSummary[]): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(ActionHarness, { initial })));
  return host;
}

async function click(host: HTMLDivElement, selector: string): Promise<void> {
  await act(async () => (host.querySelector(selector) as HTMLButtonElement).click());
}

describe("useProjectActions", () => {
  const renameMock = vi.mocked(renameProject);
  const deleteMock = vi.mocked(deleteProject);
  const leaveMock = vi.mocked(leaveProject);

  beforeEach(() => {
    renameMock.mockReset();
    deleteMock.mockReset();
    leaveMock.mockReset();
  });

  it("renames, validates empty names, and closes unchanged names", async () => {
    renameMock.mockResolvedValue({ id: "p1", name: "New Robot", createdAt: 1, latestVersion: null, versions: [] });
    const host = await render();
    await click(host, "[data-open-rename]");
    await click(host, "[data-submit-new]");
    expect(renameMock).toHaveBeenCalledWith("p1", "New Robot");
    expect(host.querySelector('[data-project="p1"]')?.textContent).toBe("New Robot");
    expect(host.querySelector("[data-dialog]")?.textContent).toBe("");

    await click(host, "[data-open-rename]");
    await click(host, "[data-submit-empty]");
    expect(host.querySelector("[data-dialog-error]")?.textContent).toBe(NAME_REQUIRED);
    expect(renameMock).toHaveBeenCalledTimes(1);

    await click(host, "[data-submit-same]");
    expect(host.querySelector("[data-dialog]")?.textContent).toBe("");
  });

  it("keeps dialog errors and exposes busy state during rename", async () => {
    let resolve: (value: { id: string; name: string; createdAt: number; latestVersion: null; versions: never[] }) => void = () => undefined;
    renameMock.mockReturnValue(new Promise((next) => { resolve = next; }));
    const host = await render();
    await click(host, "[data-open-rename]");
    await click(host, "[data-submit-new]");
    expect(host.querySelector("[data-busy]")?.textContent).toBe("true");
    resolve({ id: "p1", name: "New Robot", createdAt: 1, latestVersion: null, versions: [] });
    await act(async () => undefined);

    await click(host, "[data-open-rename]");
    renameMock.mockRejectedValueOnce({ status: 403, code: "FORBIDDEN" });
    await click(host, "[data-submit-new]");
    expect(host.querySelector("[data-dialog-error]")?.textContent).toBe(FORBIDDEN_MESSAGE);
    renameMock.mockRejectedValueOnce({ status: 500, code: "INTERNAL" });
    await click(host, "[data-submit-new]");
    expect(host.querySelector("[data-dialog-error]")?.textContent).toBe(RENAME_FAILED);
  });

  it("deletes rows, removes 404 rows, and handles leave failures", async () => {
    const host = await render();
    deleteMock.mockResolvedValueOnce(undefined);
    await click(host, "[data-open-delete]");
    await click(host, "[data-confirm-delete]");
    expect(host.querySelector('[data-project="p1"]')).toBeNull();

    leaveMock.mockRejectedValueOnce({ status: 500, code: "INTERNAL" });
    await click(host, "[data-leave]");
    expect(host.querySelector("[data-page-error]")?.textContent).toBe(LEAVE_FAILED);
    leaveMock.mockResolvedValueOnce(undefined);
    await click(host, "[data-leave]");
    expect(host.querySelector('[data-project="p2"]')).toBeNull();

    const secondHost = await render();
    deleteMock.mockRejectedValueOnce({ status: 500, code: "INTERNAL" });
    await click(secondHost, "[data-open-delete]");
    await click(secondHost, "[data-confirm-delete]");
    expect(secondHost.querySelector("[data-dialog-error]")?.textContent).toBe(DELETE_FAILED);

    const thirdHost = await render();
    renameMock.mockRejectedValueOnce({ status: 404, code: "NOT_FOUND" });
    await click(thirdHost, "[data-open-rename]");
    await click(thirdHost, "[data-submit-new]");
    expect(thirdHost.querySelector('[data-project="p1"]')).toBeNull();
    leaveMock.mockRejectedValueOnce({ status: 404, code: "NOT_FOUND" });
    await click(thirdHost, "[data-leave]");
    expect(thirdHost.querySelector('[data-project="p2"]')).toBeNull();

    const fourthHost = await render();
    deleteMock.mockRejectedValueOnce({ status: 404, code: "NOT_FOUND" });
    await click(fourthHost, "[data-open-delete]");
    await click(fourthHost, "[data-confirm-delete]");
    expect(fourthHost.querySelector('[data-project="p1"]')).toBeNull();
    expect(DELETE_FAILED).toBe("プロジェクトを削除できませんでした。");
    expect(DELETING_LABEL).toBe("削除中…");
  });
});
