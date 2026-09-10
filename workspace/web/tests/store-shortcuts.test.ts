import { beforeEach, describe, expect, it } from "vitest";
import { resetReviewStores } from "../src/app/review-stores";
import { DEFAULT_KEYMAP } from "../src/features/shortcuts/keymap";
import { loadKeymap } from "../src/features/shortcuts/keymap-storage";
import { useShortcutsStore } from "../src/store/shortcuts";

beforeEach(() => {
  localStorage.clear();
  useShortcutsStore.getState().resetKeymap();
});

describe("shortcuts store", () => {
  it("starts and resets with the default keymap", () => {
    expect(useShortcutsStore.getState().keymap).toEqual(DEFAULT_KEYMAP);
    useShortcutsStore.getState().setBinding("pen", "KeyQ");
    useShortcutsStore.getState().resetKeymap();
    expect(useShortcutsStore.getState().keymap).toEqual(DEFAULT_KEYMAP);
    expect(loadKeymap()).toEqual(DEFAULT_KEYMAP);
  });

  it("applies bindings, clears duplicates, and persists them", () => {
    useShortcutsStore.getState().setBinding("pen", "KeyQ");
    expect(useShortcutsStore.getState().keymap).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyQ" });
    expect(loadKeymap()).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyQ" });
    const before = useShortcutsStore.getState().keymap;
    useShortcutsStore.getState().setBinding("pen", "KeyC");
    expect(useShortcutsStore.getState().keymap).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyC", comment: null });
    expect(useShortcutsStore.getState().keymap).not.toBe(before);
    useShortcutsStore.getState().setBinding("pen", null);
    expect(useShortcutsStore.getState().keymap.pen).toBeNull();
  });

  it("does not reset with the review stores", () => {
    useShortcutsStore.getState().setBinding("pen", "KeyQ");
    resetReviewStores();
    expect(useShortcutsStore.getState().keymap.pen).toBe("KeyQ");
  });
});
