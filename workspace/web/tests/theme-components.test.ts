import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorPicker } from "../src/features/theme/ColorPicker";
import { THEME_PALETTE } from "../src/features/theme/theme-palette";
import { ThemeSettings } from "../src/features/theme/ThemeSettings";
import { VIEWER_COLOR_ORDER } from "../src/features/theme/viewer-colors";
import { useThemeStore } from "../src/store/theme";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

async function render(element: ReactElement): Promise<Rendered> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { root, host };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ mode: "light", prefersDark: false, colors: {} });
});

describe("ColorPicker", () => {
  it("renders one wheel, the full palette, and a draft hex input", async () => {
    const onChange = vi.fn();
    const { root, host } = await render(createElement(ColorPicker, { value: "#f97316", onChange, label: "選択" }));
    try {
      const picker = host.querySelector(".theme-picker");
      expect(picker?.getAttribute("role")).toBe("group");
      expect(picker?.getAttribute("aria-label")).toBe("選択");
      expect(picker?.querySelectorAll(".theme-wheel")).toHaveLength(1);
      expect(picker?.querySelectorAll(".theme-palette__swatch")).toHaveLength(THEME_PALETTE.length);
      expect((picker?.querySelector(".theme-picker__hex") as HTMLInputElement).value).toBe("#f97316");
      const selected = [...(picker?.querySelectorAll(".theme-palette__swatch") ?? [])]
        .find((button) => button.getAttribute("aria-pressed") === "true");
      expect(selected?.getAttribute("aria-label")).toBe("橙");
      expect((selected as HTMLElement).style.getPropertyValue("--swatch-color")).toBe("#f97316");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("selects a preset and keeps draft input behavior separate from normalization", async () => {
    const onChange = vi.fn();
    const { root, host } = await render(createElement(ColorPicker, { value: "#123456", onChange, label: "選択" }));
    try {
      const paletteButton = host.querySelector(".theme-palette__swatch") as HTMLButtonElement;
      await act(async () => paletteButton.click());
      expect(onChange).toHaveBeenLastCalledWith(THEME_PALETTE[0]?.hex);

      const input = host.querySelector(".theme-picker__hex") as HTMLInputElement;
      const inputValue = async (value: string): Promise<void> => {
        await act(async () => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter?.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      };
      await inputValue("#FF0000");
      expect(onChange).toHaveBeenLastCalledWith("#ff0000");
      expect(input.value).toBe("#FF0000");
      await inputValue("#f9");
      expect(onChange).toHaveBeenLastCalledWith("#ff0000");
      expect(input.value).toBe("#f9");
      await act(async () => {
        input.focus();
        input.blur();
      });
      expect(input.value).toBe("#123456");
      await inputValue("#ABC");
      await act(async () => {
        input.focus();
        input.blur();
      });
      expect(input.value).toBe("#aabbcc");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("follows a value changed by the parent", async () => {
    const onChange = vi.fn();
    const { root, host } = await render(createElement(ColorPicker, { value: "#123456", onChange, label: "選択" }));
    try {
      await act(async () => root.render(createElement(ColorPicker, { value: "#abcdef", onChange, label: "選択" })));
      expect((host.querySelector(".theme-picker__hex") as HTMLInputElement).value).toBe("#abcdef");
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("ThemeSettings", () => {
  it("renders modes and ordered rows with one expandable picker", async () => {
    const { root, host } = await render(createElement(ThemeSettings));
    try {
      expect(host.querySelectorAll(".theme-modes button")).toHaveLength(3);
      expect(host.querySelectorAll(".theme-color-row")).toHaveLength(VIEWER_COLOR_ORDER.length);
      expect(host.querySelectorAll(".theme-picker")).toHaveLength(0);
      expect([...host.querySelectorAll(".theme-color-row__name")].map((node) => node.textContent)).toEqual([
        "背景", "選択したオブジェクト", "ワイヤフレームの線", "ボーンの関節", "ボーンのつながり",
        "選択したボーン", "軌跡の線", "軌跡のフレーム点", "軌跡の現在位置", "比較で外へずれた面", "比較で内へずれた面",
      ]);
      const modes = [...host.querySelectorAll(".theme-modes button")];
      expect(modes.map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);

      const swatches = [...host.querySelectorAll(".theme-swatch")] as HTMLButtonElement[];
      await act(async () => swatches[0]?.click());
      expect(host.querySelectorAll(".theme-picker")).toHaveLength(1);
      expect(swatches[0]?.getAttribute("aria-expanded")).toBe("true");
      await act(async () => swatches[1]?.click());
      expect(host.querySelectorAll(".theme-picker")).toHaveLength(1);
      expect(swatches[0]?.getAttribute("aria-expanded")).toBe("false");
      expect(swatches[1]?.getAttribute("aria-expanded")).toBe("true");
      await act(async () => swatches[1]?.click());
      expect(host.querySelectorAll(".theme-picker")).toHaveLength(0);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("updates, resets, and resolves viewer colors through the store", async () => {
    const { root, host } = await render(createElement(ThemeSettings));
    try {
      const rows = () => [...host.querySelectorAll(".theme-color-row")];
      const rowButtons = (row: Element): HTMLButtonElement[] => [...row.querySelectorAll("button")];
      expect((host.querySelector(".theme-settings__footer button") as HTMLButtonElement).disabled).toBe(true);
      await act(async () => (host.querySelectorAll(".theme-swatch")[0] as HTMLButtonElement).click());
      await act(async () => (host.querySelector(".theme-palette__swatch") as HTMLButtonElement).click());
      expect(useThemeStore.getState().colors).toEqual({ background: "#ffffff" });
      expect(rows()[0]?.getAttribute("data-changed")).toBe("true");
      expect(rowButtons(rows()[0] as Element)[1]?.disabled).toBe(false);
      expect((rows()[0]?.querySelector(".theme-color-row__hex") as HTMLElement).textContent).toBe("#ffffff");
      expect((host.querySelector(".theme-settings__footer button") as HTMLButtonElement).disabled).toBe(false);

      await act(async () => rowButtons(rows()[0] as Element)[1]?.click());
      expect(useThemeStore.getState().colors).toEqual({});
      expect(rows()[0]?.hasAttribute("data-changed")).toBe(false);
      expect(rowButtons(rows()[0] as Element)[1]?.disabled).toBe(true);

      await act(async () => (host.querySelectorAll(".theme-modes button")[1] as HTMLButtonElement).click());
      expect(useThemeStore.getState().mode).toBe("dark");
      expect((rows()[0]?.querySelector(".theme-color-row__hex") as HTMLElement).textContent).toBe("#14171f");
      useThemeStore.getState().setColor("joint", "#ff0000");
      await act(async () => undefined);
      expect(rows()[3]?.getAttribute("data-changed")).toBe("true");
      await act(async () => (host.querySelector(".theme-settings__footer button") as HTMLButtonElement).click());
      expect(useThemeStore.getState().colors).toEqual({});
    } finally {
      await act(async () => root.unmount());
    }
  });
});
