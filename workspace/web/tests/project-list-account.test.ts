import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "../src/api/client";
import { getAccount, login } from "../src/api/account";
import { ProjectListPage } from "../src/features/projects/ProjectListPage";

vi.mock("../src/api/client", () => ({ listProjects: vi.fn() }));
vi.mock("../src/api/account", () => ({
  getAccount: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  registerAccount: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const projects = [{
  id: "p1",
  name: "First",
  createdAt: 1,
  lastOpenedAt: 2,
  versionCount: 1,
  role: "owner" as const,
  canManage: true,
}];

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ProjectListPage account refresh", () => {
  beforeEach(() => {
    vi.mocked(listProjects).mockReset();
    vi.mocked(getAccount).mockReset();
    vi.mocked(login).mockReset();
    vi.mocked(getAccount).mockResolvedValue({ userId: "u1", loginId: null, displayName: null });
    vi.mocked(listProjects).mockResolvedValue(projects);
  });

  it("reloads projects after login changes the account", async () => {
    vi.mocked(login).mockResolvedValue({ userId: "u1", loginId: "tanaka", displayName: "田中" });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(ProjectListPage)));
    await act(async () => {
      const loginButton = [...host.querySelectorAll(".account-menu button")]
        .find((button) => button.textContent === "ログイン") as HTMLButtonElement;
      loginButton.click();
    });
    const inputs = [...host.querySelectorAll('[role="dialog"] input') as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password");
      (host.querySelector('[role="dialog"]') as HTMLFormElement).requestSubmit();
    });
    expect(login).toHaveBeenCalledWith({ loginId: "tanaka", password: "password" });
    expect(listProjects).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("田中");
    await act(async () => root.unmount());
  });
});
