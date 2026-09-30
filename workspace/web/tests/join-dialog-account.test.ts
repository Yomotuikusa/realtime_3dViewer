import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccount, updateDisplayName } from "../src/api/account";
import { JoinDialog } from "../src/app/JoinDialog";
import { NAME_STORAGE_KEY } from "../src/app/display-name";

vi.mock("../src/api/account", () => ({ getAccount: vi.fn(), updateDisplayName: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const anonymous = { userId: "u1", loginId: null, displayName: null };
const named = { userId: "u1", loginId: "tanaka", displayName: "田中" };

async function render(onJoin = vi.fn()): Promise<{
  root: ReturnType<typeof createRoot>;
  host: HTMLDivElement;
  onJoin: ReturnType<typeof vi.fn>;
}> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(JoinDialog, { onJoin })));
  return { root, host, onJoin };
}

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("JoinDialog account display name", () => {
  const getAccountMock = vi.mocked(getAccount);
  const updateDisplayNameMock = vi.mocked(updateDisplayName);

  beforeEach(() => {
    getAccountMock.mockReset();
    updateDisplayNameMock.mockReset();
    getAccountMock.mockResolvedValue(anonymous);
    updateDisplayNameMock.mockResolvedValue(anonymous);
    localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads the account display name once and uses it for an untouched input", async () => {
    localStorage.setItem(NAME_STORAGE_KEY, "Local");
    getAccountMock.mockResolvedValue(named);
    const { root, host } = await render();
    expect(getAccountMock).toHaveBeenCalledOnce();
    expect((host.querySelector("input") as HTMLInputElement).value).toBe("田中");
    await act(async () => root.unmount());
  });

  it("uses the account name when it resolves and keeps localStorage for a null name", async () => {
    localStorage.setItem(NAME_STORAGE_KEY, "Local");
    getAccountMock.mockResolvedValue(named);
    const first = await render();
    expect((first.host.querySelector("input") as HTMLInputElement).value).toBe("田中");
    await act(async () => first.root.unmount());

    getAccountMock.mockResolvedValue(anonymous);
    const second = await render();
    expect((second.host.querySelector("input") as HTMLInputElement).value).toBe("Local");
    await act(async () => second.root.unmount());
  });

  it("does not overwrite a name entered before the account resolves", async () => {
    let resolveAccount: (account: typeof named) => void = () => undefined;
    getAccountMock.mockReturnValue(new Promise((resolve) => { resolveAccount = resolve; }));
    const { root, host } = await render();
    await act(async () => setInput(host.querySelector("input") as HTMLInputElement, "Mine"));
    await act(async () => resolveAccount(named));
    expect((host.querySelector("input") as HTMLInputElement).value).toBe("Mine");
    await act(async () => root.unmount());
  });

  it("logs a failed account request and keeps the stored name", async () => {
    const error = new Error("offline");
    localStorage.setItem(NAME_STORAGE_KEY, "Local");
    getAccountMock.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { root, host } = await render();
    expect((host.querySelector("input") as HTMLInputElement).value).toBe("Local");
    expect(consoleError).toHaveBeenCalledWith(error);
    await act(async () => root.unmount());
  });

  it("ignores an account result after unmount", async () => {
    let resolveAccount: (account: typeof named) => void = () => undefined;
    const accountPromise = new Promise<typeof named>((resolve) => { resolveAccount = resolve; });
    getAccountMock.mockReturnValue(accountPromise);
    const { root, host } = await render();
    await act(async () => root.unmount());
    await act(async () => resolveAccount(named));
    expect(host.innerHTML).toBe("");
  });

  it("joins with the resolved name, stores it, and updates the account without waiting", async () => {
    getAccountMock.mockResolvedValue(named);
    const { root, host, onJoin } = await render();
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(onJoin).toHaveBeenCalledWith("田中");
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBe("田中");
    expect(updateDisplayNameMock).toHaveBeenCalledOnce();
    expect(updateDisplayNameMock).toHaveBeenCalledWith("田中");
    await act(async () => root.unmount());
  });

  it("uses the same generated guest name for joining and account storage", async () => {
    const { root, host, onJoin } = await render();
    await act(async () => setInput(host.querySelector("input") as HTMLInputElement, "   "));
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    const name = onJoin.mock.calls[0]?.[0] as string;
    expect(name).toMatch(/^Guest-\d{4}$/);
    expect(updateDisplayNameMock).toHaveBeenCalledWith(name);
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBe(name);
    await act(async () => root.unmount());
  });

  it("logs an account update failure after allowing the join", async () => {
    const error = new Error("offline");
    updateDisplayNameMock.mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { root, host, onJoin } = await render();
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(onJoin).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(error);
    await act(async () => root.unmount());
  });
});
