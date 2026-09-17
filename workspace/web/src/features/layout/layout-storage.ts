import type { LayoutSizeName } from "./resize";

export const LAYOUT_STORAGE_KEY = "3dreviewer:layout";

/** 開閉状態として保存するフラグ名。 */
export type LayoutFlagName = "outlinerOpen" | "panelOpen";

/** 保存値が無い / 不正なときに使う既定値。どちらも開。 */
export const LAYOUT_FLAG_DEFAULTS: Readonly<Record<LayoutFlagName, boolean>> = {
  outlinerOpen: true,
  panelOpen: true,
};

function readStoredLayout(): Record<string, unknown> {
  const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (raw === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) };
    }
  } catch {
    // Malformed storage is replaced by the next save.
  }
  return {};
}

export function loadLayoutSize(name: LayoutSizeName): number | null {
  try {
    const value = readStoredLayout()[name];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLayoutSize(name: LayoutSizeName, value: number): void {
  try {
    const stored = readStoredLayout();
    stored[name] = value;
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}

/** 保存値が無い / boolean 以外・JSON 破損・localStorage 例外はすべて null。 */
export function loadLayoutFlag(name: LayoutFlagName): boolean | null {
  try {
    const value = readStoredLayout()[name];
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
}

/** 他のレイアウト値を保持したまま開閉フラグだけ保存する。 */
export function saveLayoutFlag(name: LayoutFlagName, value: boolean): void {
  try {
    const stored = readStoredLayout();
    stored[name] = value;
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
