import { create } from "zustand";
import {
  applyBinding,
  DEFAULT_KEYMAP,
  type Binding,
  type Keymap,
  type ShortcutAction,
} from "../features/shortcuts/keymap";
import { loadKeymap, saveKeymap } from "../features/shortcuts/keymap-storage";

export interface ShortcutsStoreState {
  keymap: Keymap;
  setBinding(action: ShortcutAction, binding: Binding | null): void;
  resetKeymap(): void;
}

function defaultKeymap(): Keymap {
  return { ...DEFAULT_KEYMAP };
}

export const useShortcutsStore = create<ShortcutsStoreState>((set, get) => ({
  keymap: loadKeymap(),

  setBinding(action, binding) {
    const next = applyBinding(get().keymap, action, binding);
    set({ keymap: next });
    saveKeymap(next);
  },

  resetKeymap() {
    const next = defaultKeymap();
    set({ keymap: next });
    saveKeymap(next);
  },
}));
