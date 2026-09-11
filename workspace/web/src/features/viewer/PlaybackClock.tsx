import { useFrame } from "@react-three/fiber";
import { usePlaybackStore } from "../../store/playback";
import { advanceTime, currentDuration } from "./playback";

/** Canvas 全体で一つだけ時刻を進める描画なしのクロック。 */
export function PlaybackClock(): null {
  useFrame((_, delta) => {
    const state = usePlaybackStore.getState();
    if (!state.playing) return;
    state.seek(advanceTime(state.time, delta, currentDuration(state.clips, state.clipIndex)));
  });

  return null;
}
