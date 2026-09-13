import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  prefersDarkScheme,
  resolveThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
} from "../features/theme/theme-mode";
import {
  normalizeHex,
  resolveViewerColor,
  resolveViewerColors,
  VIEWER_COLOR_DEFAULTS,
  type ViewerColorKey,
  type ViewerColorOverrides,
  type ViewerColors,
} from "../features/theme/viewer-colors";
import { loadTheme, saveTheme } from "../features/theme/theme-storage";

export interface ThemeStoreState {
  /** 利用者の選択。 */
  mode: ThemeMode;
  /** OS がダークを好むか。 */
  prefersDark: boolean;
  /** 既定値から変えた色だけ。 */
  colors: ViewerColorOverrides;
  setMode(mode: ThemeMode): void;
  setPrefersDark(prefersDark: boolean): void;
  setColor(key: ViewerColorKey, hex: string): void;
  resetColor(key: ViewerColorKey): void;
  resetColors(): void;
}

const storedTheme = loadTheme();

export const useThemeStore: UseBoundStore<StoreApi<ThemeStoreState>> = create<ThemeStoreState>((set, get) => ({
  mode: storedTheme.mode,
  prefersDark: prefersDarkScheme(),
  colors: storedTheme.colors,

  setMode(mode) {
    if (get().mode === mode) return;
    const colors = get().colors;
    set({ mode });
    saveTheme({ mode, colors });
  },

  setPrefersDark(prefersDark) {
    if (get().prefersDark === prefersDark) return;
    set({ prefersDark });
  },

  setColor(key, hex) {
    const normalized = normalizeHex(hex);
    if (normalized === null) return;

    const state = get();
    const resolvedMode = selectResolvedTheme(state);
    const currentColor = resolveViewerColor(resolvedMode, state.colors, key);
    const nextColors = { ...state.colors };
    if (normalized === VIEWER_COLOR_DEFAULTS[resolvedMode][key]) {
      delete nextColors[key];
    } else {
      nextColors[key] = normalized;
    }
    if (currentColor === resolveViewerColor(resolvedMode, nextColors, key)) return;

    set({ colors: nextColors });
    saveTheme({ mode: state.mode, colors: nextColors });
  },

  resetColor(key) {
    const state = get();
    if (!Object.hasOwn(state.colors, key)) return;
    const nextColors = { ...state.colors };
    delete nextColors[key];
    set({ colors: nextColors });
    saveTheme({ mode: state.mode, colors: nextColors });
  },

  resetColors() {
    const state = get();
    if (Object.keys(state.colors).length === 0) return;
    const colors: ViewerColorOverrides = {};
    set({ colors });
    saveTheme({ mode: state.mode, colors });
  },
}));

/** mode と prefersDark から決まる実効テーマ。 */
export function selectResolvedTheme(state: ThemeStoreState): ResolvedThemeMode {
  return resolveThemeMode(state.mode, state.prefersDark);
}

/** 1 つの実効色を購読するためのセレクタ。 */
export function selectViewerColor(key: ViewerColorKey): (state: ThemeStoreState) => string {
  return (state) => resolveViewerColor(selectResolvedTheme(state), state.colors, key);
}

/** 11 キーすべての実効色。 */
export function selectViewerColors(state: ThemeStoreState): ViewerColors {
  return resolveViewerColors(selectResolvedTheme(state), state.colors);
}
