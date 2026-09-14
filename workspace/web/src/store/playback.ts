import { create } from "zustand";
import {
  clampTime,
  currentDuration,
  type PlaybackClip,
} from "../features/viewer/playback";
import {
  clampFps,
  DEFAULT_FPS,
  timeOfFrame,
} from "../features/viewer/playback-frames";

export interface PlaybackStoreState {
  clips: PlaybackClip[];
  clipIndex: number;
  playing: boolean;
  time: number;
  fps: number;
  /** 現在タイムラインに登録しているクリップの持ち主 versionId。未登録は null */
  sourceId: string | null;
  /** クリップと持ち主を登録し、選択状態を初期化する */
  setClips(clips: readonly PlaybackClip[], fps?: number, sourceId?: string | null): void;
  selectClip(index: number): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  seekFrame(frame: number): void;
  setFps(fps: number): void;
  reset(): void;
}

const INITIAL_STATE = {
  clips: [] as PlaybackClip[],
  clipIndex: 0,
  playing: false,
  time: 0,
  fps: DEFAULT_FPS,
  sourceId: null,
};

export const usePlaybackStore = create<PlaybackStoreState>((set, get) => ({
  ...INITIAL_STATE,

  setClips(clips, fps = DEFAULT_FPS, sourceId = null) {
    set({
      clips: clips.map((clip) => ({ ...clip })),
      clipIndex: 0,
      playing: false,
      time: 0,
      fps: clampFps(fps),
      sourceId,
    });
  },

  selectClip(index) {
    const { clips } = get();
    if (!Number.isInteger(index) || index < 0 || index >= clips.length) return;
    set({ clipIndex: index, time: 0 });
  },

  play() {
    if (get().clips.length > 0) set({ playing: true });
  },

  pause() {
    set({ playing: false });
  },

  toggle() {
    const { clips, playing } = get();
    set({ playing: clips.length > 0 && !playing });
  },

  seek(time) {
    const { clips, clipIndex } = get();
    set({ time: clampTime(time, currentDuration(clips, clipIndex)) });
  },

  seekFrame(frame) {
    if (!Number.isFinite(frame)) return;
    get().seek(timeOfFrame(frame, get().fps));
  },

  setFps(fps) {
    if (!Number.isFinite(fps)) return;
    set({ fps: clampFps(fps) });
  },

  reset() {
    set({ ...INITIAL_STATE });
  },
}));
