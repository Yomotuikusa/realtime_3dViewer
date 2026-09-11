import type { AnimationClip } from "three";

/** HUD とストアが扱うクリップの要約。AnimationClip 本体は持たない。 */
export interface PlaybackClip {
  name: string;
  duration: number;
}

/** AnimationClip の名前と長さだけを取り出す。 */
export function clipSummaries(clips: readonly AnimationClip[]): PlaybackClip[] {
  return clips.map((clip, index) => ({
    name: clip.name === "" ? `Clip ${index + 1}` : clip.name,
    duration: Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : 0,
  }));
}

/** 選択中クリップの長さ。添字が範囲外なら 0。 */
export function currentDuration(clips: readonly PlaybackClip[], clipIndex: number): number {
  const clip = clips[clipIndex];
  return clip?.duration ?? 0;
}

/** 時刻を [0, duration] に丸める。 */
export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time) || time < 0) {
    return 0;
  }
  return Math.min(time, duration);
}

/** 再生中の時刻を 1 フレーム分進め、クリップ長で折り返す。 */
export function advanceTime(time: number, deltaSeconds: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return time;
  return (clampTime(time, duration) + deltaSeconds) % duration;
}
