import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VIEW_SETTINGS,
  VIEW_SETTING_ORDER,
} from "../src/features/view-settings/view-settings";
import {
  loadViewSettings,
  saveViewSettings,
  VIEW_SETTINGS_STORAGE_KEY,
} from "../src/features/view-settings/view-settings-storage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("view settings storage", () => {
  it("returns a fresh default object when storage is empty or malformed", () => {
    const first = loadViewSettings();
    expect(first).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(first).not.toBe(DEFAULT_VIEW_SETTINGS);
    for (const value of ["{", "[]", "null", "3"]) {
      localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, value);
      expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
    }
  });

  it("fills missing or invalid keys, clamps numbers, and ignores unknown keys", () => {
    localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify({
      strokeWidth: 100,
      overlayOpacityRatio: "0.2",
      dollySensitivity: 2,
      unknown: 42,
    }));
    const loaded = loadViewSettings();
    expect(loaded.strokeWidth).toBe(8);
    expect(loaded.overlayOpacityRatio).toBe(DEFAULT_VIEW_SETTINGS.overlayOpacityRatio);
    expect(loaded.dollySensitivity).toBe(2);
    expect(Object.keys(loaded)).toEqual(VIEW_SETTING_ORDER);
  });

  it("survives localStorage errors and round-trips settings", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
    vi.restoreAllMocks();

    const settings = { ...DEFAULT_VIEW_SETTINGS, strokeWidth: 5 };
    saveViewSettings(settings);
    expect(loadViewSettings()).toEqual(settings);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveViewSettings(settings)).not.toThrow();
  });
});
