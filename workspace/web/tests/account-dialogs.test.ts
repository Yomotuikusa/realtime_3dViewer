import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, registerAccount } from "../src/api/account";
import { ApiClientError } from "../src/api/client";
import { LoginDialog } from "../src/features/account/LoginDialog";
import { RecoveryCodeDialog } from "../src/features/account/RecoveryCodeDialog";
import { RegisterDialog } from "../src/features/account/RegisterDialog";
import {
  COPIED_LABEL,
  COPY_FAILED,
  LOGIN_FAILED,
  LOGIN_ID_TAKEN,
  LOGIN_REQUIRED,
  LOGGING_IN_LABEL,
  TOO_MANY_ATTEMPTS,
} from "../src/features/account/account-labels";

vi.mock("../src/api/account", () => ({ login: vi.fn(), registerAccount: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function render(element: React.ReactElement): Promise<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { root, host };
}

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("account dialogs", () => {
  const loginMock = vi.mocked(login);
  const registerMock = vi.mocked(registerAccount);

  beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects an empty login without calling the API", async () => {
    const { root, host } = await render(createElement(LoginDialog, { onSuccess: vi.fn(), onCancel: vi.fn() }));
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(loginMock).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LOGIN_REQUIRED);
    await act(async () => root.unmount());
  });

  it("clears only the password after a failed login and keeps busy controls disabled", async () => {
    let reject: (error: Error) => void = () => undefined;
    loginMock.mockReturnValue(new Promise((_, next) => { reject = next; }));
    const { root, host } = await render(createElement(LoginDialog, { onSuccess: vi.fn(), onCancel: vi.fn() }));
    const inputs = [...host.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password");
      (host.querySelector("form") as HTMLFormElement).requestSubmit();
    });
    expect(host.querySelector("button[type=submit]")).toHaveProperty("disabled", true);
    expect(host.querySelector("button[type=submit]")?.textContent).toBe(LOGGING_IN_LABEL);
    expect(host.querySelectorAll("button")[1]).toHaveProperty("disabled", true);
    await act(async () => reject(new ApiClientError(401, "UNAUTHORIZED", "wrong")));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LOGIN_FAILED);
    expect(inputs[0]?.value).toBe("tanaka");
    expect(inputs[1]?.value).toBe("");
    await act(async () => root.unmount());
  });

  it("shows the rate-limit message after a login is rejected", async () => {
    loginMock.mockRejectedValue(new ApiClientError(429, "TOO_MANY_REQUESTS", "slow down"));
    const { root, host } = await render(createElement(LoginDialog, { onSuccess: vi.fn(), onCancel: vi.fn() }));
    const inputs = [...host.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password");
      (host.querySelector("form") as HTMLFormElement).requestSubmit();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(TOO_MANY_ATTEMPTS);
    await act(async () => root.unmount());
  });

  it("validates registration and omits a whitespace-only display name", async () => {
    const onSuccess = vi.fn();
    registerMock.mockResolvedValue({
      account: { userId: "u1", loginId: "tanaka", displayName: null },
      recoveryCode: "0123-4567-89ab-cdef-0123-4567-89ab-cdef",
    });
    const { root, host } = await render(createElement(RegisterDialog, { onSuccess, onCancel: vi.fn() }));
    const inputs = [...host.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password1");
      setInput(inputs[2]!, "password2");
      (host.querySelector("form") as HTMLFormElement).requestSubmit();
    });
    expect(registerMock).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => setInput(inputs[2]!, "password1"));
    await act(async () => setInput(inputs[3]!, "   "));
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(registerMock).toHaveBeenCalledWith({ loginId: "tanaka", password: "password1" });
    expect(onSuccess).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("keeps registration open and shows the duplicate login ID message", async () => {
    registerMock.mockRejectedValue(new ApiClientError(409, "CONFLICT", "taken"));
    const { root, host } = await render(createElement(RegisterDialog, { onSuccess: vi.fn(), onCancel: vi.fn() }));
    const inputs = [...host.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "tanaka");
      setInput(inputs[1]!, "password1");
      setInput(inputs[2]!, "password1");
      (host.querySelector("form") as HTMLFormElement).requestSubmit();
    });
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(LOGIN_ID_TAKEN);
    await act(async () => root.unmount());
  });

  it("requires saving before closing recovery code and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const onClose = vi.fn();
    const { root, host } = await render(createElement(RecoveryCodeDialog, { code: "abcd", onClose }));
    const close = host.querySelector("button.btn--primary") as HTMLButtonElement;
    expect(close.disabled).toBe(true);
    await act(async () => (host.querySelector("button.account-dialog__copy") as HTMLButtonElement).click());
    expect(writeText).toHaveBeenCalledWith("abcd");
    expect(host.textContent).toContain(COPIED_LABEL);
    const checkbox = host.querySelector("input[type=checkbox]") as HTMLInputElement;
    await act(async () => checkbox.click());
    expect(close.disabled).toBe(false);
    await act(async () => close.click());
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("shows copy failure without throwing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    const { root, host } = await render(createElement(RecoveryCodeDialog, { code: "abcd", onClose: vi.fn() }));
    await act(async () => (host.querySelector("button.account-dialog__copy") as HTMLButtonElement).click());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(COPY_FAILED);
    await act(async () => root.unmount());
  });

  it("shows copy failure when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const { root, host } = await render(createElement(RecoveryCodeDialog, { code: "abcd", onClose: vi.fn() }));
    await act(async () => (host.querySelector("button.account-dialog__copy") as HTMLButtonElement).click());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(COPY_FAILED);
    await act(async () => root.unmount());
  });
});
