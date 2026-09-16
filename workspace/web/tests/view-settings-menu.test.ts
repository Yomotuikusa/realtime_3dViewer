/// <reference types="node" />

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ViewSettingsMenu } from "../src/features/view-settings/ViewSettingsMenu";
import {
  DEFAULT_VIEW_SETTINGS,
  HUD_VIEW_SETTING_GROUP_ORDER,
  VIEW_SETTING_ORDER,
  VIEW_SETTING_SPECS,
  viewSettingKeysOnSurface,
} from "../src/features/view-settings/view-settings";
import {
  RESET_VIEW_SETTINGS_LABEL,
  VIEW_SETTING_GROUP_LABELS,
  VIEW_SETTING_LABELS,
  VIEW_SETTINGS_HELP,
  formatViewSetting,
} from "../src/features/view-settings/view-settings-labels";
import { useViewSettingsStore } from "../src/store/view-settings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const sourceRoot = existsSync(join(process.cwd(), "src")) ? join(process.cwd(), "src") : join(process.cwd(), "web/src");
const menuCss = readFileSync(join(sourceRoot, "features/view-settings/view-settings-menu.css"), "utf8");
type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

async function render(): Promise<Rendered> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ViewSettingsMenu)));
  return { root, host };
}

beforeEach(() => {
  localStorage.clear();
  useViewSettingsStore.setState({ settings: { ...DEFAULT_VIEW_SETTINGS } });
});

afterEach(() => document.body.replaceChildren());

describe("ViewSettingsMenu", () => {
  it("renders four grouped HUD sections and eight labelled ranges", async () => {
    const { root, host } = await render();
    try {
      const hudKeys = viewSettingKeysOnSurface("hud");
      expect(host.querySelector(".view-settings-menu__help")?.textContent).toBe(VIEW_SETTINGS_HELP);
      expect(host.querySelectorAll(".view-settings-menu__group")).toHaveLength(4);
      expect([...host.querySelectorAll(".view-settings-menu__group")].map((group) => group.getAttribute("aria-label"))).toEqual(
        HUD_VIEW_SETTING_GROUP_ORDER.map((group) => VIEW_SETTING_GROUP_LABELS[group]),
      );
      expect(host.querySelectorAll(".view-setting-hud-row")).toHaveLength(8);
      expect([...host.querySelectorAll(".view-setting-hud-row__name")].map((node) => node.textContent)).toEqual(
        hudKeys.map((key) => VIEW_SETTING_LABELS[key]),
      );
      expect([...host.querySelectorAll(".view-setting-hud-row__value")].map((node) => node.textContent)).toEqual(
        hudKeys.map((key) => formatViewSetting(key, DEFAULT_VIEW_SETTINGS[key])),
      );
      expect([...host.querySelectorAll(".view-setting-hud-row")].every((row) => row.getAttribute("data-changed") === "false")).toBe(true);
      expect((host.querySelector(".view-settings-menu__reset") as HTMLButtonElement).disabled).toBe(true);
      const ranges = [...host.querySelectorAll(".view-setting-hud-row__range")] as HTMLInputElement[];
      ranges.forEach((range, index) => {
        const key = hudKeys[index]!;
        const spec = VIEW_SETTING_SPECS[key];
        expect(range.min).toBe(String(spec.min));
        expect(range.max).toBe(String(spec.max));
        expect(range.step).toBe(String(spec.step));
        expect(range.value).toBe(String(DEFAULT_VIEW_SETTINGS[key]));
        expect(range.id).toContain(key);
        expect(range.getAttribute("aria-label")).toBeNull();
        expect(range.parentElement?.querySelector("label")?.getAttribute("for")).toBe(range.id);
      });
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("updates values immediately and resets HUD settings only", async () => {
    useViewSettingsStore.getState().setSetting("dollySensitivity", 2);
    const { root, host } = await render();
    try {
      const first = host.querySelector(".view-setting-hud-row__range") as HTMLInputElement;
      first.value = "5";
      await act(async () => first.dispatchEvent(new Event("input", { bubbles: true })));
      expect(useViewSettingsStore.getState().settings.strokeWidth).toBe(5);
      expect(host.querySelector(".view-setting-hud-row")?.getAttribute("data-changed")).toBe("true");
      expect(host.querySelector(".view-setting-hud-row__value")?.textContent).toBe("5px");
      expect((host.querySelector(".view-settings-menu__reset") as HTMLButtonElement).disabled).toBe(false);

      await act(async () => (host.querySelector(".view-settings-menu__reset") as HTMLButtonElement).click());
      expect(useViewSettingsStore.getState().settings).toEqual({
        ...DEFAULT_VIEW_SETTINGS,
        dollySensitivity: 2,
      });
      expect((host.querySelector(".view-settings-menu__reset") as HTMLButtonElement).disabled).toBe(true);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("view-settings-menu.css", () => {
  it("styles HUD rows with design tokens", () => {
    expect(menuCss).toContain(".view-setting-hud-row");
    expect(menuCss).toContain(".view-setting-hud-row__head");
    expect(menuCss).toContain(".view-setting-hud-row__range");
    expect(menuCss).toContain("var(--space-");
    expect(menuCss).toContain("var(--color-");
  });
});

describe("HUD surface completeness", () => {
  it("covers the eight non-input keys", () => {
    expect(viewSettingKeysOnSurface("hud")).toHaveLength(8);
    const allSurfaceKeys = [...viewSettingKeysOnSurface("hud"), ...viewSettingKeysOnSurface("dialog")];
    expect(allSurfaceKeys).toHaveLength(VIEW_SETTING_ORDER.length);
    expect(new Set(allSurfaceKeys)).toEqual(new Set(VIEW_SETTING_ORDER));
  });
});
