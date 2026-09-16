import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  clampViewSetting,
  DEFAULT_VIEW_SETTINGS,
  type ViewSettingKey,
  type ViewSettings,
} from "../features/view-settings/view-settings";
import { loadViewSettings, saveViewSettings } from "../features/view-settings/view-settings-storage";

export interface ViewSettingsStoreState {
  settings: ViewSettings;
  setSetting(key: ViewSettingKey, value: number): void;
  resetSetting(key: ViewSettingKey): void;
  resetAll(): void;
}

const storedSettings = loadViewSettings();

function defaultViewSettings(): ViewSettings {
  return { ...DEFAULT_VIEW_SETTINGS };
}

function settingsEqual(left: ViewSettings, right: ViewSettings): boolean {
  return Object.keys(DEFAULT_VIEW_SETTINGS).every((key) => {
    const typedKey = key as ViewSettingKey;
    return left[typedKey] === right[typedKey];
  });
}

export const useViewSettingsStore: UseBoundStore<StoreApi<ViewSettingsStoreState>> = create<ViewSettingsStoreState>((set, get) => ({
  settings: storedSettings,

  setSetting(key, value) {
    const nextValue = clampViewSetting(key, value);
    const current = get();
    if (current.settings[key] === nextValue) return;
    const settings = { ...current.settings, [key]: nextValue };
    set({ settings });
    saveViewSettings(settings);
  },

  resetSetting(key) {
    const current = get();
    const nextValue = DEFAULT_VIEW_SETTINGS[key];
    if (current.settings[key] === nextValue) return;
    const settings = { ...current.settings, [key]: nextValue };
    set({ settings });
    saveViewSettings(settings);
  },

  resetAll() {
    const current = get();
    if (settingsEqual(current.settings, DEFAULT_VIEW_SETTINGS)) return;
    const settings = defaultViewSettings();
    set({ settings });
    saveViewSettings(settings);
  },
}));

export function selectViewSetting(key: ViewSettingKey): (state: ViewSettingsStoreState) => number {
  return (state) => state.settings[key];
}
