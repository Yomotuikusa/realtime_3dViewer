import {
  AnimationMixer,
  LoopRepeat,
  type AnimationClip,
  type Object3D,
} from "three";

export interface PlaybackDriver {
  apply(clipIndex: number, time: number): void;
  stop(): void;
  dispose(): void;
}

export function createPlaybackDriver(root: Object3D, clips: readonly AnimationClip[]): PlaybackDriver {
  const mixer = new AnimationMixer(root);
  let activeIndex: number | null = null;
  let disposed = false;

  return {
    apply(clipIndex, time) {
      if (disposed || !Number.isInteger(clipIndex) || clipIndex < 0 || clipIndex >= clips.length) return;
      const clip = clips[clipIndex];
      if (clip === undefined) return;
      if (activeIndex !== clipIndex) {
        mixer.stopAllAction();
        mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play();
        activeIndex = clipIndex;
      }
      mixer.setTime(time);
    },

    stop() {
      if (activeIndex === null) return;
      mixer.stopAllAction();
      activeIndex = null;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      activeIndex = null;
      mixer.uncacheRoot(root);
    },
  };
}
