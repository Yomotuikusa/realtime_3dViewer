import {
  clampViewSetting,
  DEFAULT_VIEW_SETTINGS,
  VIEW_SETTING_ORDER,
  type ViewSettings,
} from "./view-settings";

export const VIEW_SETTINGS_STORAGE_KEY = "3dreviewer:view-settings";

function defaultViewSettings(): ViewSettings {
  return { ...DEFAULT_VIEW_SETTINGS };
}

export function loadViewSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY);
    if (raw === null) return defaultViewSettings();

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return defaultViewSettings();

    const stored = parsed as Record<string, unknown>;
    const settings = { ...DEFAULT_VIEW_SETTINGS };
    for (const key of VIEW_SETTING_ORDER) {
      const value = stored[key];
      if (typeof value === "number") settings[key] = clampViewSetting(key, value);
    }
    return settings;
  } catch {
    return defaultViewSettings();
  }
}

export function saveViewSettings(settings: ViewSettings): void {
  try {
    const saved = {} as Record<string, number>;
    for (const key of VIEW_SETTING_ORDER) {
      saved[key] = clampViewSetting(key, settings[key]);
    }
    localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
