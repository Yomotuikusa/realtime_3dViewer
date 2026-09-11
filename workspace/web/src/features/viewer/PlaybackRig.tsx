import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { AnimationClip, Object3D } from "three";
import { usePlaybackStore } from "../../store/playback";
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

  useFrame(() => {
    const { clipIndex, time } = usePlaybackStore.getState();
    driverRef.current?.apply(clipIndex, time);
  });

  return null;
}
