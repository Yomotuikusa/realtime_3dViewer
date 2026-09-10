import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_KEYMAP } from "../src/features/shortcuts/keymap";
import { KEYMAP_STORAGE_KEY, loadKeymap, saveKeymap } from "../src/features/shortcuts/keymap-storage";

beforeEach(() => localStorage.clear());

describe("keymap storage", () => {
  it("loads defaults from an empty or invalid storage value", () => {
    expect(loadKeymap()).toEqual(DEFAULT_KEYMAP);
    for (const value of ["{", "null", "[]", "5", '"x"']) {
      localStorage.setItem(KEYMAP_STORAGE_KEY, value);
      expect(loadKeymap()).toEqual(DEFAULT_KEYMAP);
    }
  });

  it("fills missing and invalid actions while preserving null", () => {
    localStorage.setItem(KEYMAP_STORAGE_KEY, '{"pen":"KeyQ"}');
    expect(loadKeymap()).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyQ" });
    localStorage.setItem(KEYMAP_STORAGE_KEY, '{"pen":null}');
    expect(loadKeymap()).toEqual({ ...DEFAULT_KEYMAP, pen: null });
    localStorage.setItem(KEYMAP_STORAGE_KEY, '{"pen":"Tab"}');
    expect(loadKeymap()).toEqual(DEFAULT_KEYMAP);
    localStorage.setItem(KEYMAP_STORAGE_KEY, '{"pen":123}');
    expect(loadKeymap()).toEqual(DEFAULT_KEYMAP);
    localStorage.setItem(KEYMAP_STORAGE_KEY, '{"pen":"KeyQ","zzz":"KeyZ"}');
    const keymap = loadKeymap();
    expect(keymap).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyQ" });
    expect(keymap).not.toHaveProperty("zzz");
  });

  it("saves and restores a keymap under the documented key", () => {
    const keymap = { ...DEFAULT_KEYMAP, pen: "Shift+KeyQ", comment: null };
    expect(KEYMAP_STORAGE_KEY).toBe("3dreviewer:keymap");
    saveKeymap(keymap);
    expect(loadKeymap()).toEqual(keymap);
  });

  it("returns a fresh default object", () => {
    const loaded = loadKeymap();
    expect(loaded).toEqual(DEFAULT_KEYMAP);
    expect(loaded).not.toBe(DEFAULT_KEYMAP);
    (loaded as Record<string, string | null>).pen = "KeyQ";
    expect(DEFAULT_KEYMAP.pen).toBe("KeyP");
  });
});
