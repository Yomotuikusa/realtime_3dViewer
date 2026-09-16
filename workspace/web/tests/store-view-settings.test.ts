import { beforeEach, describe, expect, it } from "vitest";
import { resetReviewStores } from "../src/app/review-stores";
import { DEFAULT_VIEW_SETTINGS } from "../src/features/view-settings/view-settings";
import { loadViewSettings } from "../src/features/view-settings/view-settings-storage";
import { selectViewSetting, useViewSettingsStore } from "../src/store/view-settings";

beforeEach(() => {
  localStorage.clear();
  useViewSettingsStore.setState({ settings: { ...DEFAULT_VIEW_SETTINGS } });
});

describe("view settings store", () => {
  it("updates, clamps, persists, and suppresses no-op updates", () => {
    const initial = useViewSettingsStore.getState();
    initial.setSetting("strokeWidth", 5);
    const changed = useViewSettingsStore.getState();
    expect(changed.settings.strokeWidth).toBe(5);
    expect(changed.settings).not.toBe(initial.settings);
    expect(loadViewSettings().strokeWidth).toBe(5);
    const beforeNoop = changed.settings;
    changed.setSetting("strokeWidth", 5);
    expect(useViewSettingsStore.getState().settings).toBe(beforeNoop);
    changed.setSetting("strokeWidth", 100);
    expect(useViewSettingsStore.getState().settings.strokeWidth).toBe(8);
  });

  it("resets one key or all keys and exposes a pure selector", () => {
    const state = useViewSettingsStore.getState();
    state.setSetting("strokeWidth", 5);
    state.setSetting("dollySensitivity", 2);
    state.resetSetting("strokeWidth");
    expect(useViewSettingsStore.getState().settings.strokeWidth).toBe(DEFAULT_VIEW_SETTINGS.strokeWidth);
    expect(useViewSettingsStore.getState().settings.dollySensitivity).toBe(2);
    expect(selectViewSetting("strokeWidth")(useViewSettingsStore.getState())).toBe(3);
    useViewSettingsStore.getState().resetAll();
    expect(useViewSettingsStore.getState().settings).toEqual(DEFAULT_VIEW_SETTINGS);
  });

  it("is local and remains outside the review reset", () => {
    useViewSettingsStore.getState().setSetting("strokeWidth", 5);
    resetReviewStores();
    expect(useViewSettingsStore.getState().settings.strokeWidth).toBe(5);
  });
});
