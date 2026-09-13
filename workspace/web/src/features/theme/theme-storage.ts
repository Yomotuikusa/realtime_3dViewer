import {
  DEFAULT_THEME_MODE,
  isThemeMode,
  type ThemeMode,
} from "./theme-mode";
import {
  normalizeHex,
  VIEWER_COLOR_ORDER,
  type ViewerColorOverrides,
} from "./viewer-colors";

export const THEME_STORAGE_KEY = "3dreviewer:theme";

export interface StoredTheme {
  mode: ThemeMode;
  colors: ViewerColorOverrides;
}

function defaultTheme(): StoredTheme {
  return { mode: DEFAULT_THEME_MODE, colors: {} };
}

export function loadTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return defaultTheme();

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return defaultTheme();

    const stored = parsed as Record<string, unknown>;
    const mode = isThemeMode(stored.mode) ? stored.mode : DEFAULT_THEME_MODE;
    const colors: Partial<Record<keyof ViewerColorOverrides, string>> = {};
    if (typeof stored.colors === "object" && stored.colors !== null && !Array.isArray(stored.colors)) {
      const storedColors = stored.colors as Record<string, unknown>;
      for (const key of VIEWER_COLOR_ORDER) {
        const value = storedColors[key];
        if (typeof value !== "string") continue;
        const normalized = normalizeHex(value);
        if (normalized !== null) colors[key] = normalized;
      }
    }
    return { mode, colors };
  } catch {
    return defaultTheme();
  }
}

export function saveTheme(theme: StoredTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
