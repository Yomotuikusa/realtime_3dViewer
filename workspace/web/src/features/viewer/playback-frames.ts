import type { AnimationClip } from "three";

/** 判定できないときのフレームレート。Maya / Blender の既定と同じ。 */
export const DEFAULT_FPS = 24;
export const MIN_FPS = 1;
export const MAX_FPS = 240;
export const FPS_CANDIDATES: readonly number[] = [24, 30, 25, 60, 50, 48, 120, 15, 12];
export const FPS_TOLERANCE = 0.02;

/** 非有限なら既定値、それ以外は許容範囲へ丸める。 */
export function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) return DEFAULT_FPS;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, fps));
}

/** 全クリップのキー時刻に最初に適合する候補 fps を返す。 */
export function detectFps(clips: readonly AnimationClip[]): number {
  const times: number[] = [];
  for (const clip of clips) {
    for (const track of clip.tracks) {
      for (const time of track.times) {
        if (Number.isFinite(time)) times.push(time);
      }
    }
  }

  for (const fps of FPS_CANDIDATES) {
    if (times.every((time) => Math.abs(time * fps - Math.round(time * fps)) <= FPS_TOLERANCE)) {
      return fps;
    }
  }
  return DEFAULT_FPS;
}

/** 秒から表示フレームへ変換する。 */
export function frameOfTime(time: number, fps: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(fps)) return 0;
  return Math.round(time * fps);
}

/** 表示フレームから秒へ変換する。 */
export function timeOfFrame(frame: number, fps: number): number {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) return 0;
  return frame / fps;
}

/** クリップの最終表示フレームを返す。 */
export function lastFrameOf(duration: number, fps: number): number {
  if (!Number.isFinite(duration) || !Number.isFinite(fps)) return 0;
  return Math.max(0, Math.round(duration * fps));
}
