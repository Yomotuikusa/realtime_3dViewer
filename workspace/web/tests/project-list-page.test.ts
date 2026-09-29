import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "../src/api/client";
import { CANCEL_LABEL } from "../src/features/comments/comment-labels";
import { DeleteProjectDialog } from "../src/features/projects/DeleteProjectDialog";
import { ProjectListItem } from "../src/features/projects/ProjectListItem";
import { RenameProjectDialog } from "../src/features/projects/RenameProjectDialog";
import {
  DELETE_CONFIRM_LABEL,
  DELETE_DIALOG_TITLE,
  DELETE_LABEL,
  DELETING_LABEL,
  NEW_PROJECT_LABEL,
  PROJECTS_EMPTY,
  PROJECTS_EMPTY_HINT,
  PROJECTS_LOAD_FAILED,
  PROJECTS_LOADING,
  PROJECTS_RETRY_LABEL,
  LEAVE_LABEL,
  NAME_REQUIRED,
  RENAME_DIALOG_TITLE,
  RENAME_LABEL,
  RENAMING_LABEL,
  SHARED_BADGE_LABEL,
} from "../src/features/projects/projects-labels";
import { ProjectListPage } from "../src/features/projects/ProjectListPage";

vi.mock("../src/api/client", () => ({ listProjects: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const projects = [
  { id: "p1", name: "First", createdAt: 1, lastOpenedAt: 2, versionCount: 1, role: "owner" as const, canManage: true },
  { id: "p2", name: "Shared", createdAt: 3, lastOpenedAt: 4, versionCount: 2, role: "member" as const, canManage: false },
];

async function render(): Promise<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(ProjectListPage)));
  return { root, host };
}

describe("ProjectListPage", () => {
  const listProjectsMock = vi.mocked(listProjects);

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    listProjectsMock.mockReset();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("shows loading before the request resolves", async () => {
    listProjectsMock.mockReturnValue(new Promise(() => undefined));
    const { root, host } = await render();
    expect(host.querySelector('[role="status"]')?.textContent).toBe(PROJECTS_LOADING);
    await act(async () => root.unmount());
  });

  it("shows an empty state and keeps the new-project link in the heading", async () => {
    listProjectsMock.mockResolvedValue([]);
    const { root, host } = await render();
    expect(host.textContent).toContain(PROJECTS_EMPTY);
    expect(host.textContent).toContain(PROJECTS_EMPTY_HINT);
    expect(host.querySelectorAll("li")).toHaveLength(0);
    expect(host.querySelector(`a[href="/new"]`)?.textContent).toBe(NEW_PROJECT_LABEL);
    await act(async () => root.unmount());
  });

  it("shows API order, metadata, and only the shared badge for members", async () => {
    listProjectsMock.mockResolvedValue(projects);
    const { root, host } = await render();
    const items = [...host.querySelectorAll("li")];
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector("a")?.getAttribute("href")).toBe("/p/p1");
    expect(items[1]?.querySelector("a")?.getAttribute("href")).toBe("/p/p2");
    expect(items[0]?.querySelector(".badge")).toBeNull();
    expect(items[1]?.querySelector(".badge")?.textContent).toBe(SHARED_BADGE_LABEL);
    expect(host.textContent).toContain("オブジェクト 2 個");
    await act(async () => (items[0]?.querySelector("a") as HTMLAnchorElement).click());
    expect(window.location.pathname).toBe("/p/p1");
    await act(async () => root.unmount());
  });

  it("retries after a failed request", async () => {
    listProjectsMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([projects[0]!]);
    const { root, host } = await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(PROJECTS_LOAD_FAILED);
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).not.toContain(PROJECTS_RETRY_LABEL);
    await act(async () => root.unmount());
  });

  it("navigates with plain clicks and ignores an unresolved request after unmount", async () => {
    let resolve: (value: typeof projects) => void = () => undefined;
    listProjectsMock.mockReturnValue(new Promise((next) => { resolve = next; }));
    const { root, host } = await render();
    const newLink = host.querySelector('a[href="/new"]') as HTMLAnchorElement;
    await act(async () => newLink.click());
    expect(window.location.pathname).toBe("/new");
    await act(async () => root.unmount());
    resolve(projects);
    await act(async () => undefined);
  });

  it("shows management buttons according to canManage and role", async () => {
    const project = { ...projects[0]!, name: "Robot" };
    const props = { project, onRename: vi.fn(), onDelete: vi.fn(), onLeave: vi.fn() };
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(ProjectListItem, props)));
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      RENAME_LABEL, DELETE_LABEL,
    ]);
    expect(host.querySelector('[aria-label="「Robot」の名前を変更"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="「Robot」を削除"]')).not.toBeNull();

    await act(async () => root.render(createElement(ProjectListItem, {
      ...props,
      project: { ...project, role: "member" as const, canManage: false },
    })));
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([LEAVE_LABEL]);

    await act(async () => root.render(createElement(ProjectListItem, {
      ...props,
      project: { ...project, role: "member" as const, canManage: true },
    })));
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      RENAME_LABEL, DELETE_LABEL, LEAVE_LABEL,
    ]);

    await act(async () => root.unmount());
  });

  it("renders the rename dialog form and reports its submission", async () => {
    const onSubmit = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(RenameProjectDialog, {
      project: { ...projects[0]!, name: "Robot" },
      busy: false,
      error: NAME_REQUIRED,
      onSubmit,
      onCancel: vi.fn(),
    })));
    expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    const input = host.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("Robot");
    expect(input.maxLength).toBe(100);
    expect(host.textContent).toContain(RENAME_DIALOG_TITLE);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(NAME_REQUIRED);
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(onSubmit).toHaveBeenCalledWith("Robot");
    await act(async () => root.unmount());
  });

  it("renders a dangerous delete confirmation with busy controls", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(DeleteProjectDialog, {
      project: { ...projects[0]!, name: "Robot" },
      busy: true,
      error: "failed",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    })));
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(host.textContent).toContain(DELETE_DIALOG_TITLE);
    expect(host.textContent).toContain("オブジェクト 1 個とコメントもすべて削除");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("failed");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons[0]?.textContent).toBe(DELETING_LABEL);
    expect(buttons[0]?.className).toContain("btn--danger");
    expect(buttons[0]).toHaveProperty("disabled", true);
    expect(buttons[1]?.textContent).toBe(CANCEL_LABEL);
    expect(buttons[1]).toHaveProperty("disabled", true);
    expect(DELETE_CONFIRM_LABEL).toBe("削除する");
    expect(RENAMING_LABEL).toBe("変更中…");
    await act(async () => root.unmount());
  });
});
