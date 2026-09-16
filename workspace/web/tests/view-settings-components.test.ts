import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ViewSettings } from "../src/features/view-settings/ViewSettings";
import {
  DEFAULT_VIEW_SETTINGS,
  VIEW_SETTING_GROUP_ORDER,
  VIEW_SETTING_ORDER,
  VIEW_SETTING_SPECS,
} from "../src/features/view-settings/view-settings";
import {
  RESET_VIEW_SETTING_LABEL,
  RESET_VIEW_SETTINGS_LABEL,
  VIEW_SETTING_GROUP_LABELS,
  VIEW_SETTING_LABELS,
  formatViewSetting,
} from "../src/features/view-settings/view-settings-labels";
import { useViewSettingsStore } from "../src/store/view-settings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

async function render(): Promise<Rendered> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ViewSettings)));
  return { root, host };
}

beforeEach(() => {
  localStorage.clear();
  useViewSettingsStore.setState({ settings: { ...DEFAULT_VIEW_SETTINGS } });
});

afterEach(() => document.body.replaceChildren());

describe("ViewSettings", () => {
  it("renders grouped, labelled sliders without a dialog shell", async () => {
    const { root, host } = await render();
    try {
      expect(host.querySelectorAll(".view-setting-row")).toHaveLength(VIEW_SETTING_ORDER.length);
      expect(host.querySelectorAll("fieldset.view-settings__group")).toHaveLength(5);
      expect([...host.querySelectorAll("fieldset legend")].map((node) => node.textContent)).toEqual(
        VIEW_SETTING_GROUP_ORDER.map((group) => VIEW_SETTING_GROUP_LABELS[group]),
      );
      expect(host.querySelector(".review-backdrop")).toBeNull();
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(host.querySelector("h2")).toBeNull();

      const ranges = [...host.querySelectorAll('input[type="range"]')] as HTMLInputElement[];
      expect(ranges).toHaveLength(VIEW_SETTING_ORDER.length);
      ranges.forEach((range, index) => {
        const key = VIEW_SETTING_ORDER[index]!;
        const spec = VIEW_SETTING_SPECS[key];
        expect(range.min).toBe(String(spec.min));
        expect(range.max).toBe(String(spec.max));
        expect(range.step).toBe(String(spec.step));
        expect(range.value).toBe(String(DEFAULT_VIEW_SETTINGS[key]));
        expect(range.getAttribute("aria-label")).toBeNull();
        expect(range.id).toContain(key);
        expect(range.parentElement?.querySelector("label")?.getAttribute("for")).toBe(range.id);
      });
      expect([...host.querySelectorAll(".view-setting-row__value")].map((node) => node.textContent)).toEqual(
        VIEW_SETTING_ORDER.map((key) => formatViewSetting(key, DEFAULT_VIEW_SETTINGS[key])),
      );
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("updates and resets an individual setting and all settings", async () => {
    const { root, host } = await render();
    try {
      const first = host.querySelector('input[type="range"]') as HTMLInputElement;
      first.value = "5";
      await act(async () => first.dispatchEvent(new Event("input", { bubbles: true })));
      expect(useViewSettingsStore.getState().settings.strokeWidth).toBe(5);
      const firstRow = host.querySelector(".view-setting-row") as HTMLElement;
      expect(firstRow.dataset.changed).toBe("true");
      const reset = [...firstRow.querySelectorAll("button")][0] as HTMLButtonElement;
      expect(reset.textContent).toBe(RESET_VIEW_SETTING_LABEL);
      expect(reset.disabled).toBe(false);
      const resetAll = host.querySelector(".view-settings__footer button") as HTMLButtonElement;
      expect(resetAll.textContent).toBe(RESET_VIEW_SETTINGS_LABEL);
      expect(resetAll.disabled).toBe(false);

      await act(async () => reset.click());
      expect(useViewSettingsStore.getState().settings.strokeWidth).toBe(3);
      expect(firstRow.dataset.changed).toBe("false");
      expect(reset.disabled).toBe(true);

      await act(async () => useViewSettingsStore.getState().setSetting("strokeWidth", 5));
      await act(async () => resetAll.click());
      expect(useViewSettingsStore.getState().settings).toEqual(DEFAULT_VIEW_SETTINGS);
      expect(resetAll.disabled).toBe(true);
      expect([...host.querySelectorAll(".view-setting-row button")].every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("view setting labels", () => {
  it("contains Japanese labels for every key and group", () => {
    for (const key of VIEW_SETTING_ORDER) expect(VIEW_SETTING_LABELS[key]).not.toBe("");
    for (const group of VIEW_SETTING_GROUP_ORDER) expect(VIEW_SETTING_GROUP_LABELS[group]).not.toBe("");
    expect(formatViewSetting("strokeWidth", 3)).toBe("3px");
    expect(formatViewSetting("outlinerRowHeightRem", 1.75)).toBe("1.75rem");
    expect(formatViewSetting("overlayOpacityRatio", 0.35)).toBe("35%");
    expect(formatViewSetting("dollySensitivity", 1)).toBe("×1.00");
  });
});
