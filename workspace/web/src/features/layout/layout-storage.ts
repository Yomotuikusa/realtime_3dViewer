import type { LayoutSizeName } from "./resize";

export const LAYOUT_STORAGE_KEY = "3dreviewer:layout";

export function loadLayoutSize(name: LayoutSizeName): number | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const value = (parsed as Record<string, unknown>)[name];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLayoutSize(name: LayoutSizeName, value: number): void {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    let stored: Record<string, unknown> = {};
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          stored = { ...(parsed as Record<string, unknown>) };
        }
      } catch {
        stored = {};
      }
    }
    stored[name] = value;
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
