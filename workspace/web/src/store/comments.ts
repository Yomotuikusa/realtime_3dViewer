import { create } from "zustand";
import type { Comment, Vec3 } from "@shared/types";

export interface CommentsStoreState {
  items: Comment[];
  showOnlyOpen: boolean;
  selectedId: string | null;
  composerAnchor: Vec3 | null;
  lastError: string | null;
  setAll(items: Comment[]): void;
  upsert(comment: Comment): void;
  select(id: string | null): void;
  setFilter(showOnlyOpen: boolean): void;
  setComposerAnchor(anchor: Vec3 | null): void;
  setLastError(message: string | null): void;
  /** versionId のコメントを items から除去する。選択中なら null にする */
  removeByVersion(versionId: string): void;
  reset(): void;
}

const initialState = {
  items: [] as Comment[],
  showOnlyOpen: false,
  selectedId: null as string | null,
  composerAnchor: null as Vec3 | null,
  lastError: null as string | null,
};

function compareComments(left: Comment, right: Comment): number {
  return left.createdAt - right.createdAt
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function sortedComments(items: Comment[]): Comment[] {
  return [...items].sort(compareComments);
}

export function selectVisible(items: Comment[], showOnlyOpen: boolean): Comment[] {
  return showOnlyOpen ? items.filter((comment) => comment.status === "open") : items;
}

function normalizedSelectedId(
  items: Comment[],
  showOnlyOpen: boolean,
  selectedId: string | null,
): string | null {
  return selectedId !== null
    && selectVisible(items, showOnlyOpen).some((comment) => comment.id === selectedId)
    ? selectedId
    : null;
}

export const useCommentsStore = create<CommentsStoreState>((set, get) => ({
  ...initialState,

  setAll(items) {
    const sorted = sortedComments(items);
    set({
      items: sorted,
      selectedId: normalizedSelectedId(sorted, get().showOnlyOpen, get().selectedId),
    });
  },

  upsert(comment) {
    const current = get().items;
    const next = current.some((item) => item.id === comment.id)
      ? current.map((item) => item.id === comment.id ? comment : item)
      : [...current, comment];
    const sorted = sortedComments(next);
    set({
      items: sorted,
      selectedId: normalizedSelectedId(sorted, get().showOnlyOpen, get().selectedId),
    });
  },

  select(id) {
    set({ selectedId: id !== null && get().items.some((comment) => comment.id === id) ? id : null });
  },

  setFilter(showOnlyOpen) {
    const items = get().items;
    set({
      showOnlyOpen,
      selectedId: normalizedSelectedId(items, showOnlyOpen, get().selectedId),
    });
  },

  setComposerAnchor(anchor) {
    set({ composerAnchor: anchor });
  },

  setLastError(message) {
    set({ lastError: message });
  },

  removeByVersion(versionId) {
    const { items, selectedId } = get();
    const nextItems = items.filter((item) => item.versionId !== versionId);
    if (nextItems.length === items.length) return;
    const selectedRemoved = selectedId !== null
      && items.some((item) => item.versionId === versionId && item.id === selectedId);
    set({ items: nextItems, ...(selectedRemoved ? { selectedId: null } : {}) });
  },

  reset() {
    set({ ...initialState, items: [] });
  },
}));
