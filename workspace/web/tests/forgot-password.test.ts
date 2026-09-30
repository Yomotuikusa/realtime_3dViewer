import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPassword } from "../src/api/account";
import { ApiClientError } from "../src/api/client";
import { ForgotPasswordDialog } from "../src/features/account/ForgotPasswordDialog";
import {
  FORGOT_PASSWORD_LABEL,
  RECOVERY_CODE_INVALID,
  RESET_FAILED,
  RESETTING_LABEL,
  TOO_MANY_ATTEMPTS,
} from "../src/features/account/account-labels";
import { LoginDialog } from "../src/features/account/LoginDialog";

vi.mock("../src/api/account", () => ({ resetPassword: vi.fn(), login: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function renderDialog(onSuccess = vi.fn()): Promise<{
  root: ReturnType<typeof createRoot>;
  host: HTMLDivElement;
  onSuccess: ReturnType<typeof vi.fn>;
}> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(ForgotPasswordDialog, { onSuccess, onCancel: vi.fn() })));
  return { root, host, onSuccess };
}

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ForgotPasswordDialog", () => {
  const resetMock = vi.mocked(resetPassword);

  beforeEach(() => resetMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("validates recovery code without calling the API", async () => {
    const { root, host } = await renderDialog();
    const inputs = [...host.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    setInput(inputs[0]!, "tanaka");
    setInput(inputs[1]!, "abcd");
    setInput(inputs[2]!, "newpassword");
    setInput(inputs[3]!, "newpassword");
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(resetMock).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(RECOVERY_CODE_INVALID);
    expect(inputs[1]?.getAttribute("autoComplete")).toBe("off");
    expect(inputs[1]?.getAttribute("autocapitalize")).toBe("none");
    await act(async () => root.unmount());
  });

  it("keeps the dialog open for reset errors and succeeds with a recovery code", async () => {
    resetMock.mockRejectedValueOnce(new ApiClientError(401, "UNAUTHORIZED", "wrong"));
    const { root, host, onSuccess } = await renderDialog();
    const inputs = [...host.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    ["tanaka", "0123-4567-89ab-cdef-0123-4567-89ab-cdef", "newpassword", "newpassword"]
      .forEach((value, index) => setInput(inputs[index]!, value));
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(RESET_FAILED);
    resetMock.mockRejectedValueOnce(new ApiClientError(429, "TOO_MANY_REQUESTS", "slow"));
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(TOO_MANY_ATTEMPTS);
    resetMock.mockResolvedValue({
      account: { userId: "u1", loginId: "tanaka", displayName: "田中" },
      recoveryCode: "0123-4567-89ab-cdef-0123-4567-89ab-cdef",
    });
    await act(async () => (host.querySelector("form") as HTMLFormElement).requestSubmit());
    expect(onSuccess).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("offers the forgot-password action from the login dialog", async () => {
    const onForgotPassword = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(LoginDialog, {
      onSuccess: vi.fn(), onCancel: vi.fn(), onForgotPassword,
    })));
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent === FORGOT_PASSWORD_LABEL);
    expect(button?.className).toBe("btn");
    await act(async () => (button as HTMLButtonElement).click());
    expect(onForgotPassword).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});
