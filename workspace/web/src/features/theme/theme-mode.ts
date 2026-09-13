/** 利用者が選べるテーマ。system は OS の設定に従う。 */
export type ThemeMode = "light" | "dark" | "system";
/** 実際に適用されるテーマ。system を解決した結果。 */
export type ResolvedThemeMode = "light" | "dark";

/** 設定画面に並べる順。 */
export const THEME_MODE_ORDER: readonly ThemeMode[] = ["light", "dark", "system"];
/** 初期値。OS 追従。 */
export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

/** system のときだけ prefersDark を見る。 */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedThemeMode {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

/** 現在の OS の配色設定を一度だけ読む。 */
export function prefersDarkScheme(): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches === true;
  } catch {
    return false;
  }
}
