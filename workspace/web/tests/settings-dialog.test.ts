import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../src/app/SettingsDialog";
import { ShortcutSettings } from "../src/features/shortcuts/ShortcutSettings";
import { ACTION_ORDER, DEFAULT_KEYMAP } from "../src/features/shortcuts/keymap";
import {
  CLOSE_LABEL,
  SETTINGS_DIALOG_TITLE,
  SETTINGS_TAB_ORDER,
  SETTINGS_TABS_LABEL,
} from "../src/app/review-labels";
import { SETTINGS_HELP, SETTINGS_TITLE, RESET_KEYMAP_LABEL } from "../src/features/shortcuts/shortcut-labels";
import { THEME_SETTINGS_TITLE } from "../src/features/theme/theme-labels";
import { useShortcutsStore } from "../src/store/shortcuts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

async function render(element: ReturnType<typeof createElement>): Promise<Rendered> {
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
  useShortcutsStore.getState().resetKeymap();
});

describe("SettingsDialog", () => {
  it("opens on shortcuts with labelled tabs and a single close button", async () => {
    const onClose = vi.fn();
    const { root, host } = await render(createElement(SettingsDialog, { onClose }));
    try {
      const dialog = host.querySelector(".review-backdrop > .review-dialog.settings-dialog");
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      const title = dialog?.querySelector("h2");
      expect(title?.textContent).toBe(SETTINGS_DIALOG_TITLE);
      expect(dialog?.getAttribute("aria-labelledby")).toBe(title?.id);

      const tabs = [...host.querySelectorAll(".settings-tabs button")] as HTMLButtonElement[];
      expect(tabs).toHaveLength(SETTINGS_TAB_ORDER.length);
      expect(tabs.map((tab) => tab.textContent)).toEqual([SETTINGS_TITLE, THEME_SETTINGS_TITLE]);
      expect(tabs.map((tab) => tab.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
      expect(host.querySelector(".settings-tabs")?.getAttribute("role")).toBe("group");
      expect(host.querySelector(".settings-tabs")?.getAttribute("aria-label")).toBe(SETTINGS_TABS_LABEL);
      expect(host.querySelector(".shortcut-settings")).not.toBeNull();
      expect(host.querySelector(".theme-settings")).toBeNull();
      expect(host.querySelectorAll(`.settings-dialog__footer .btn--primary`)).toHaveLength(1);
      const closeButton = host.querySelector(".settings-dialog__footer .btn--primary") as HTMLButtonElement;
      expect(closeButton.textContent).toBe(CLOSE_LABEL);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("switches tab content and changes pressed state", async () => {
    const { root, host } = await render(createElement(SettingsDialog, { onClose: vi.fn() }));
    try {
      const tabs = () => [...host.querySelectorAll(".settings-tabs button")] as HTMLButtonElement[];
      await act(async () => tabs()[1]?.click());
      expect(host.querySelector(".theme-settings")).not.toBeNull();
      expect(host.querySelector(".shortcut-settings")).toBeNull();
      expect(tabs().map((tab) => tab.getAttribute("aria-pressed"))).toEqual(["false", "true"]);

      await act(async () => tabs()[0]?.click());
      expect(host.querySelector(".shortcut-settings")).not.toBeNull();
      expect(host.querySelector(".theme-settings")).toBeNull();
      expect(tabs().map((tab) => tab.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("calls onClose once from the footer button", async () => {
    const onClose = vi.fn();
    const { root, host } = await render(createElement(SettingsDialog, { onClose }));
    try {
      await act(async () => (host.querySelector(".settings-dialog__footer .btn--primary") as HTMLButtonElement).click());
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("does not capture shortcut keys while the theme tab is shown", async () => {
    const { root, host } = await render(createElement(SettingsDialog, { onClose: vi.fn() }));
    try {
      const tabs = host.querySelectorAll(".settings-tabs button");
      await act(async () => (tabs[1] as HTMLButtonElement).click());
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
      expect(useShortcutsStore.getState().keymap).toEqual(DEFAULT_KEYMAP);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("settings dialog source and style contracts", () => {
  const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

  it("wires ReviewPage and ReviewHeader to the shared settings entry point", () => {
    const reviewPage = read("web/src/app/ReviewPage.tsx");
    const reviewHeader = read("web/src/app/ReviewHeader.tsx");
    const settingsDialog = read("web/src/app/SettingsDialog.tsx");

    expect(reviewPage).toContain('import { SettingsDialog } from "./SettingsDialog";');
    expect(reviewPage).not.toContain("ShortcutSettings");
    expect(reviewPage.match(/<SettingsDialog onClose=/g)).toHaveLength(1);
    expect(reviewPage).toContain("useShortcuts(joinName !== null && !settingsOpen)");
    expect(reviewHeader).toMatch(/SETTINGS_OPEN_LABEL,\s*type CopyState,\s*\} from "\.\/review-labels"/s);
    expect(settingsDialog).toContain("onClick={onClose} autoFocus");
  });

  it("keeps moved labels out of shortcut-labels and exposes them from review-labels", () => {
    const shortcutLabels = read("web/src/features/shortcuts/shortcut-labels.ts");
    const reviewLabels = read("web/src/app/review-labels.ts");

    expect(shortcutLabels).not.toMatch(/export (?:const|function) SETTINGS_OPEN_LABEL/);
    expect(shortcutLabels).not.toMatch(/export (?:const|function) CLOSE_LABEL/);
    expect(reviewLabels).toContain('export const SETTINGS_OPEN_LABEL = "設定"');
    expect(reviewLabels).toContain('export const CLOSE_LABEL = "閉じる"');
    expect(reviewLabels).toContain('export const SETTINGS_DIALOG_TITLE = "設定"');
    expect(reviewLabels).toContain('export const SETTINGS_TABS_LABEL = "設定の分類"');
    expect(reviewLabels).toContain('export const SETTINGS_TAB_ORDER: readonly SettingsTab[] = ["shortcuts", "theme"]');
  });

  it("defines the settings selectors in review.css and removes the old shortcut shell", () => {
    const reviewCss = read("web/src/app/review.css");
    const shortcutsCss = read("web/src/features/shortcuts/shortcuts.css");

    expect(reviewCss).toContain(".review-dialog.settings-dialog");
    expect(reviewCss).toContain(".settings-tabs");
    expect(reviewCss).toContain('.settings-tab[aria-pressed="true"]');
    expect(reviewCss).toContain(".settings-dialog__footer");
    expect(reviewCss).toContain("@media (max-width: 24rem)");
    expect(shortcutsCss).toContain(".shortcut-settings");
    expect(shortcutsCss).toContain(".shortcut-settings__footer");
    expect(shortcutsCss).not.toContain(".shortcut-dialog");
    for (const css of [reviewCss, shortcutsCss]) {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl)\(/i);
      expect(css).not.toContain("!important");
    }
  });
});

describe("ShortcutSettings", () => {
  it("renders tab content without a dialog shell and preserves key capture", async () => {
    const { root, host } = await render(createElement(ShortcutSettings));
    try {
      expect(host.querySelector(".shortcut-settings")).not.toBeNull();
      expect(host.querySelector(".review-backdrop")).toBeNull();
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(host.querySelector("h2")).toBeNull();
      expect(host.querySelector(".review-dialog__help")?.textContent).toBe(SETTINGS_HELP);
      expect(host.querySelectorAll(".shortcut-row")).toHaveLength(ACTION_ORDER.length);
      expect(host.querySelector(".shortcut-settings__footer")?.textContent).toContain(RESET_KEYMAP_LABEL);

      const change = host.querySelector(".shortcut-row .btn") as HTMLButtonElement;
      await act(async () => change.click());
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
      });
      expect(useShortcutsStore.getState().keymap.pen).toBe("KeyQ");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("shows capture rejection and resets the keymap", async () => {
    useShortcutsStore.getState().setBinding("pen", "KeyQ");
    const { root, host } = await render(createElement(ShortcutSettings));
    try {
      const change = host.querySelector(".shortcut-row .btn") as HTMLButtonElement;
      await act(async () => change.click());
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", ctrlKey: true }));
      });
      expect(host.querySelector('[role="alert"]')).not.toBeNull();

      const reset = [...host.querySelectorAll("button")]
        .find((button) => button.textContent === RESET_KEYMAP_LABEL) as HTMLButtonElement;
      await act(async () => reset.click());
      expect(useShortcutsStore.getState().keymap).toEqual(DEFAULT_KEYMAP);
    } finally {
      await act(async () => root.unmount());
    }
  });
});
