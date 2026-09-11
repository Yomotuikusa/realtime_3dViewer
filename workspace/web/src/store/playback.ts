import { create } from "zustand";
import {
  clampTime,
  currentDuration,
  type PlaybackClip,
} from "../features/viewer/playback";

export interface PlaybackStoreState {
  clips: PlaybackClip[];
  clipIndex: number;
  playing: boolean;
  time: number;
  setClips(clips: readonly PlaybackClip[]): void;
  selectClip(index: number): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  reset(): void;
}

const INITIAL_STATE = {
  clips: [] as PlaybackClip[],
  clipIndex: 0,
  playing: false,
  time: 0,
};

export const usePlaybackStore = create<PlaybackStoreState>((set, get) => ({
  ...INITIAL_STATE,

  setClips(clips) {
    set({ clips: clips.map((clip) => ({ ...clip })), clipIndex: 0, playing: false, time: 0 });
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

  reset() {
    set({ clips: [], clipIndex: 0, playing: false, time: 0 });
  },
}));
