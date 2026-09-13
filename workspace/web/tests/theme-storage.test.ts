import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_MODE } from "../src/features/theme/theme-mode";
import { loadTheme, saveTheme, THEME_STORAGE_KEY } from "../src/features/theme/theme-storage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("theme storage", () => {
  it("loads the default for absent, malformed, or non-object values", () => {
    expect(loadTheme()).toEqual({ mode: DEFAULT_THEME_MODE, colors: {} });
    for (const value of ["{", "[]", "null", "3"]) {
      localStorage.setItem(THEME_STORAGE_KEY, value);
      expect(loadTheme()).toEqual({ mode: DEFAULT_THEME_MODE, colors: {} });
    }
  });

  it("validates the mode and filters and normalizes colors", () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{"mode":"neon","colors":{}}');
    expect(loadTheme().mode).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, '{"mode":"dark","colors":"x"}');
    expect(loadTheme()).toEqual({ mode: "dark", colors: {} });
    localStorage.setItem(
      THEME_STORAGE_KEY,
      '{"mode":"dark","colors":{"selection":"#F97316","nope":"#fff","joint":"zz","trailLine":5}}',
    );
    expect(loadTheme()).toEqual({ mode: "dark", colors: { selection: "#f97316" } });
  });

  it("survives localStorage errors and round-trips valid themes", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(loadTheme()).toEqual({ mode: DEFAULT_THEME_MODE, colors: {} });
    vi.restoreAllMocks();

    const theme = { mode: "dark" as const, colors: { joint: "#ff0000" } };
    saveTheme(theme);
    expect(loadTheme()).toEqual(theme);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveTheme(theme)).not.toThrow();
  });
});
