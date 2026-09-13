import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME_MODE,
  isThemeMode,
  prefersDarkScheme,
  resolveThemeMode,
  THEME_MODE_ORDER,
} from "../src/features/theme/theme-mode";

describe("theme mode", () => {
  it("defines the ordered modes and validates them", () => {
    expect(THEME_MODE_ORDER).toEqual(["light", "dark", "system"]);
    expect(DEFAULT_THEME_MODE).toBe("system");
    for (const value of ["light", "dark", "system"]) expect(isThemeMode(value)).toBe(true);
    for (const value of ["Light", null, undefined, 0, {}]) expect(isThemeMode(value)).toBe(false);
  });

  it("resolves system from the OS preference only", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
  });

  it("handles missing and failing matchMedia", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    expect(prefersDarkScheme()).toBe(false);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    expect(prefersDarkScheme()).toBe(true);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => { throw new Error("blocked"); }),
    });
    expect(prefersDarkScheme()).toBe(false);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: original });
  });
});
