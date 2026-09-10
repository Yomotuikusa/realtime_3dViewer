import { create } from "zustand";
import type { Stroke, Vec3 } from "@shared/types";

/** "none" はツール未選択。左ドラッグで何も起きない状態を指す。 */
export type AnnotationMode = "none" | "pen" | "comment";

export const STROKE_COLORS: readonly string[] = [
  "#ff0000",
  "#ff8800",
  "#00aa00",
  "#0088ff",
  "#aa00ff",
  "#ff00aa",
];
export const DEFAULT_STROKE_COLOR = STROKE_COLORS[0]!;

export interface AnnotationStoreState {
  strokes: Record<string, Stroke>;
  mode: AnnotationMode;
  color: string;
  drafting: Vec3[] | null;
  replayStrokes: Stroke[];
  /** メッシュに埋もれた線を透過表示するか。初期値 true */
  overlay: boolean;
  applyWelcome(strokes: Stroke[]): void;
  addStroke(stroke: Stroke): void;
  removeStroke(strokeId: string): void;
  clearByUser(userId: string): void;
  setMode(mode: AnnotationMode): void;
  setColor(color: string): void;
  /** 同値なら state を更新しない */
  setOverlay(overlay: boolean): void;
  beginDraft(point: Vec3): void;
  appendDraftPoint(point: Vec3): void;
  endDraft(): Vec3[];
  setReplayStrokes(strokes: Stroke[]): void;
  reset(): void;
}

const initialState = {
  strokes: {} as Record<string, Stroke>,
  mode: "none" as AnnotationMode,
  color: DEFAULT_STROKE_COLOR,
  drafting: null as Vec3[] | null,
  replayStrokes: [] as Stroke[],
  overlay: true,
};

export const useAnnotationStore = create<AnnotationStoreState>((set, get) => ({
  ...initialState,

  applyWelcome(strokes) {
    const nextStrokes: Record<string, Stroke> = {};
    for (const stroke of strokes) {
      nextStrokes[stroke.id] = stroke;
    }
    set({ strokes: nextStrokes });
  },

  addStroke(stroke) {
    set((state) => ({ strokes: { ...state.strokes, [stroke.id]: stroke } }));
  },

  removeStroke(strokeId) {
    if (!Object.hasOwn(get().strokes, strokeId)) {
      return;
    }
    set((state) => {
      const strokes = { ...state.strokes };
      delete strokes[strokeId];
      return { strokes };
    });
  },

  clearByUser(userId) {
    const currentStrokes = get().strokes;
    const hasMatchingStroke = Object.values(currentStrokes).some((stroke) => stroke.userId === userId);
    if (!hasMatchingStroke) {
      return;
    }
    set((state) => {
      const strokes: Record<string, Stroke> = {};
      for (const stroke of Object.values(state.strokes)) {
        if (stroke.userId !== userId) {
          strokes[stroke.id] = stroke;
        }
      }
      return { strokes };
    });
  },

  setMode(mode) {
    set((state) => state.mode === mode ? state : { mode, drafting: null });
  },

  setColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      return;
    }
    set({ color: color.toLowerCase() });
  },

  setOverlay(overlay) {
    set((state) => state.overlay === overlay ? state : { overlay });
  },

  beginDraft(point) {
    set({ drafting: [point] });
  },

  appendDraftPoint(point) {
    if (get().drafting === null) {
      return;
    }
    set((state) => ({ drafting: [...state.drafting!, point] }));
  },

  endDraft() {
    const drafting = get().drafting ?? [];
    set({ drafting: null });
    return drafting;
  },

  setReplayStrokes(strokes) {
    set({ replayStrokes: strokes });
  },

  reset() {
    set({ ...initialState, strokes: {}, replayStrokes: [] });
  },
}));

export function orderedStrokes(strokes: Record<string, Stroke>): Stroke[] {
  return Object.values(strokes).sort((left, right) =>
    left.createdAt - right.createdAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}
