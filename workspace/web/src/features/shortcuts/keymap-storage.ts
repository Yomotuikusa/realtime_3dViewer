import {
  ACTION_ORDER,
  DEFAULT_KEYMAP,
  isValidBinding,
  type Keymap,
} from "./keymap";

export const KEYMAP_STORAGE_KEY = "3dreviewer:keymap";

function defaultKeymap(): Keymap {
  return { ...DEFAULT_KEYMAP };
}

export function loadKeymap(): Keymap {
  try {
    const raw = localStorage.getItem(KEYMAP_STORAGE_KEY);
    if (raw === null) {
      return defaultKeymap();
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return defaultKeymap();
    }
    const stored = parsed as Record<string, unknown>;
    const keymap: Record<string, string | null> = {};
    for (const action of ACTION_ORDER) {
      const value = stored[action];
      keymap[action] = value === null || isValidBinding(value)
        ? value
        : DEFAULT_KEYMAP[action];
    }
    return keymap as Keymap;
  } catch {
    return defaultKeymap();
  }
}

export function saveKeymap(keymap: Keymap): void {
  try {
    localStorage.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(keymap));
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}
