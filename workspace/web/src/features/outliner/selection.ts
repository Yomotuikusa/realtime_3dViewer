import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface OutlinerSelection {
  versionId: string;
  objectId: string;
}

export interface SelectionStoreState {
  selected: OutlinerSelection | null;
  toggleSelection(selection: OutlinerSelection): void;
  clear(): void;
  reset(): void;
}

export const useSelectionStore: UseBoundStore<StoreApi<SelectionStoreState>> = create<SelectionStoreState>((set, get) => ({
  selected: null,

  toggleSelection(selection) {
    const current = get().selected;
    if (current?.versionId === selection.versionId && current.objectId === selection.objectId) {
      set({ selected: null });
      return;
    }
    set({ selected: selection });
  },

  clear() {
    set({ selected: null });
  },

  reset() {
    set({ selected: null });
  },
}));

export function isSelected(selected: OutlinerSelection | null, versionId: string, objectId: string): boolean {
  return selected?.versionId === versionId && selected.objectId === objectId;
}
