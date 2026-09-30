import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccount, login, logout, registerAccount } from "../src/api/account";
import { AccountMenu } from "../src/features/account/AccountMenu";
import { LOGIN_LABEL, LOGOUT_LABEL, REGISTER_LABEL } from "../src/features/account/account-labels";

vi.mock("../src/api/account", () => ({
  getAccount: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  registerAccount: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const anonymous = { userId: "u1", loginId: null, displayName: null };
const loggedIn = { userId: "u1", loginId: "tanaka", displayName: "田中" };

async function render(onAccountChange = vi.fn()): Promise<{
  root: ReturnType<typeof createRoot>;
  host: HTMLDivElement;
  onAccountChange: ReturnType<typeof vi.fn>;
}> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(AccountMenu, { onAccountChange })));
  return { root, host, onAccountChange };
}

describe("AccountMenu", () => {
  const getAccountMock = vi.mocked(getAccount);
  const loginMock = vi.mocked(login);
  const logoutMock = vi.mocked(logout);
  const registerMock = vi.mocked(registerAccount);

  beforeEach(() => {
    getAccountMock.mockReset();
    loginMock.mockReset();
    logoutMock.mockReset();
    registerMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the anonymous menu", async () => {
    getAccountMock.mockResolvedValue(anonymous);
    const { root, host } = await render();
    expect([...host.querySelectorAll(".account-menu button")].map((button) => button.textContent)).toEqual([
      LOGIN_LABEL, REGISTER_LABEL,
    ]);
    await act(async () => root.unmount());
  });

  it("renders the logged-in label and logs out by refreshing the account", async () => {
    getAccountMock.mockResolvedValueOnce(loggedIn).mockResolvedValueOnce(anonymous);
    logoutMock.mockResolvedValue(undefined);
    const onAccountChange = vi.fn();
    const { root, host } = await render(onAccountChange);
    expect(host.textContent).toContain("田中");
    expect(host.textContent).toContain("@tanaka");
    await act(async () => (host.querySelector(".account-menu button") as HTMLButtonElement).click());
    expect(getAccountMock).toHaveBeenCalledTimes(2);
    expect(host.querySelector(".account-menu")?.textContent).toContain(LOGIN_LABEL);
    expect(onAccountChange).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("keeps the account menu when logout fails", async () => {
    getAccountMock.mockResolvedValue(loggedIn);
    logoutMock.mockRejectedValue(new Error("offline"));
    const { root, host } = await render();
    await act(async () => (host.querySelector(".account-menu button") as HTMLButtonElement).click());
    expect(host.textContent).toContain("@tanaka");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("ログアウトできませんでした。");
    await act(async () => root.unmount());
  });

  it("logs and renders nothing after an account request fails", async () => {
    const error = new Error("offline");
    getAccountMock.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { root, host } = await render();
    expect(host.innerHTML).toBe("");
    expect(consoleError).toHaveBeenCalledWith(error);
    await act(async () => root.unmount());
  });
});
