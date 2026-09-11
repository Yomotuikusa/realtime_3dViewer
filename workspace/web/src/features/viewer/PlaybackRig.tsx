import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { AnimationClip, Object3D } from "three";
import { usePlaybackStore } from "../../store/playback";
import { advanceTime, currentDuration } from "./playback";
import { createPlaybackDriver, type PlaybackDriver } from "./playback-driver";

/** ストアの時刻を AnimationMixer のポーズへ反映する描画なしの Rig。 */
export function PlaybackRig({ root, clips }: { root: Object3D; clips: readonly AnimationClip[] }): null {
  const driverRef = useRef<PlaybackDriver | null>(null);

  useEffect(() => {
    const driver = createPlaybackDriver(root, clips);
    driverRef.current = driver;
    return () => {
      driver.dispose();
      if (driverRef.current === driver) driverRef.current = null;
    };
  }, [root, clips]);

  useFrame((_, delta) => {
    const state = usePlaybackStore.getState();
    if (state.playing) {
      state.seek(advanceTime(state.time, delta, currentDuration(state.clips, state.clipIndex)));
    }
    const updated = usePlaybackStore.getState();
    driverRef.current?.apply(updated.clipIndex, updated.time);
  });

  return null;
}
