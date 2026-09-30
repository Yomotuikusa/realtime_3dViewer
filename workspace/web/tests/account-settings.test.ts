import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, regenerateRecoveryCode } from "../src/api/account";
import { ApiClientError } from "../src/api/client";
import { AccountSettingsDialog } from "../src/features/account/AccountSettingsDialog";
import {
  CHANGE_PASSWORD_SUBMIT_LABEL,
  CHANGING_PASSWORD_LABEL,
  CURRENT_PASSWORD_INCORRECT,
  CURRENT_PASSWORD_REQUIRED,
  PASSWORD_CHANGED,
  REGENERATE_SUBMIT_LABEL,
  SIGN_IN_REQUIRED,
} from "../src/features/account/account-labels";

vi.mock("../src/api/account", () => ({ changePassword: vi.fn(), regenerateRecoveryCode: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function render(): Promise<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(AccountSettingsDialog, {
    account: { loginId: "tanaka", displayName: "田中" }, onRecoveryCode: vi.fn(), onClose: vi.fn(),
  })));
  return { root, host };
}

function setInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AccountSettingsDialog", () => {
  const changeMock = vi.mocked(changePassword);
  const regenerateMock = vi.mocked(regenerateRecoveryCode);

  beforeEach(() => {
    changeMock.mockReset();
    regenerateMock.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it("validates the password form before calling the API and clears it after success", async () => {
    const { root, host } = await render();
    const forms = [...host.querySelectorAll("form") as NodeListOf<HTMLFormElement>];
    await act(async () => forms[0]!.requestSubmit());
    expect(changeMock).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(CURRENT_PASSWORD_REQUIRED);
    const inputs = [...forms[0]!.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "old");
      setInput(inputs[1]!, "newpassword");
      setInput(inputs[2]!, "newpassword");
    });
    changeMock.mockResolvedValue({ userId: "u1", loginId: "tanaka", displayName: "田中" });
    await act(async () => forms[0]!.requestSubmit());
    expect(host.querySelector('[role="status"]')?.textContent).toBe(PASSWORD_CHANGED);
    expect(inputs.map((input) => input.value)).toEqual(["", "", ""]);
    await act(async () => root.unmount());
  });

  it("shows busy state and maps password errors", async () => {
    let reject: (error: Error) => void = () => undefined;
    changeMock.mockReturnValue(new Promise((_, next) => { reject = next; }));
    const { root, host } = await render();
    const form = host.querySelector("form") as HTMLFormElement;
    const inputs = [...form.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "old");
      setInput(inputs[1]!, "newpassword");
      setInput(inputs[2]!, "newpassword");
      form.requestSubmit();
    });
    expect(host.textContent).toContain(CHANGING_PASSWORD_LABEL);
    expect(form.querySelector("button[type=submit]")).toHaveProperty("disabled", true);
    await act(async () => reject(new ApiClientError(403, "FORBIDDEN", "wrong")));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(CURRENT_PASSWORD_INCORRECT);
    await act(async () => root.unmount());
  });

  it("maps an expired session and opens the new recovery code", async () => {
    changeMock.mockRejectedValue(new ApiClientError(401, "UNAUTHORIZED", "expired"));
    const onRecoveryCode = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(AccountSettingsDialog, {
      account: { loginId: "tanaka", displayName: null }, onRecoveryCode, onClose: vi.fn(),
    })));
    const changeForm = host.querySelector("form") as HTMLFormElement;
    const inputs = [...changeForm.querySelectorAll("input") as NodeListOf<HTMLInputElement>];
    await act(async () => {
      setInput(inputs[0]!, "old");
      setInput(inputs[1]!, "newpassword");
      setInput(inputs[2]!, "newpassword");
      changeForm.requestSubmit();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(SIGN_IN_REQUIRED);
    regenerateMock.mockResolvedValue({
      account: { userId: "u1", loginId: "tanaka", displayName: null },
      recoveryCode: "0123-4567-89ab-cdef-0123-4567-89ab-cdef",
    });
    const regenerateForm = host.querySelectorAll("form")[1] as HTMLFormElement;
    setInput(regenerateForm.querySelector("input") as HTMLInputElement, "old");
    await act(async () => regenerateForm.requestSubmit());
    expect(onRecoveryCode).toHaveBeenCalledWith("0123-4567-89ab-cdef-0123-4567-89ab-cdef");
    expect(host.textContent).toContain(REGENERATE_SUBMIT_LABEL);
    await act(async () => root.unmount());
  });
});
