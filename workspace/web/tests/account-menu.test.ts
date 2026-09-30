import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccount, login, logout, registerAccount } from "../src/api/account";
import { NAME_STORAGE_KEY } from "../src/app/display-name";
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

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
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

  it("updates the menu and saves the display name after login", async () => {
    getAccountMock.mockResolvedValue(anonymous);
    loginMock.mockResolvedValue(loggedIn);
    const onAccountChange = vi.fn();
    const { root, host } = await render(onAccountChange);
    await act(async () => (host.querySelector(".account-menu button") as HTMLButtonElement).click());
    const inputs = [...host.querySelectorAll('[role="dialog"] input') as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password");
      (host.querySelector('[role="dialog"]') as HTMLFormElement).requestSubmit();
    });
    expect(host.textContent).toContain("田中");
    expect(host.textContent).toContain("@tanaka");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(onAccountChange).toHaveBeenCalledOnce();
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBe("田中");
    await act(async () => root.unmount());
  });

  it("does not overwrite the stored name when login has no display name", async () => {
    const accountWithoutName = { userId: "u2", loginId: "tanaka", displayName: null };
    localStorage.setItem(NAME_STORAGE_KEY, "保存済み");
    getAccountMock.mockResolvedValue(anonymous);
    loginMock.mockResolvedValue(accountWithoutName);
    const { root, host } = await render();
    await act(async () => (host.querySelector(".account-menu button") as HTMLButtonElement).click());
    const inputs = [...host.querySelectorAll('[role="dialog"] input') as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password");
      (host.querySelector('[role="dialog"]') as HTMLFormElement).requestSubmit();
    });
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBe("保存済み");
    await act(async () => root.unmount());
  });

  it("shows the recovery code after successful registration", async () => {
    const result = {
      account: { userId: "u2", loginId: "tanaka", displayName: "田中" },
      recoveryCode: "0123-4567-89ab-cdef-0123-4567-89ab-cdef",
    };
    getAccountMock.mockResolvedValue(anonymous);
    registerMock.mockResolvedValue(result);
    const onAccountChange = vi.fn();
    const { root, host } = await render(onAccountChange);
    await act(async () => (host.querySelectorAll(".account-menu button")[1] as HTMLButtonElement).click());
    const inputs = [...host.querySelectorAll('[role="dialog"] input') as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password1");
      setInput(inputs[2]!, "password1");
      setInput(inputs[3]!, "田中");
      (host.querySelector('[role="dialog"]') as HTMLFormElement).requestSubmit();
    });
    expect(host.textContent).toContain("田中");
    expect(host.textContent).toContain("@tanaka");
    expect(host.querySelector("code")?.textContent).toBe(result.recoveryCode);
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

  it("does not update after logout resolves after unmount", async () => {
    let resolveLogout: () => void = () => undefined;
    let resolveAccount: (account: typeof anonymous) => void = () => undefined;
    logoutMock.mockReturnValue(new Promise((resolve) => { resolveLogout = resolve; }));
    getAccountMock
      .mockResolvedValueOnce(loggedIn)
      .mockReturnValueOnce(new Promise((resolve) => { resolveAccount = resolve; }));
    const onAccountChange = vi.fn();
    const { root, host } = await render(onAccountChange);
    await act(async () => (host.querySelector(".account-menu button") as HTMLButtonElement).click());
    await act(async () => root.unmount());
    await act(async () => {
      resolveLogout();
      resolveAccount(anonymous);
    });
    expect(onAccountChange).not.toHaveBeenCalled();
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
