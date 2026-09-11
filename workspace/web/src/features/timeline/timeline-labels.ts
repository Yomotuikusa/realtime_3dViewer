export const TIMELINE_LABEL = "タイムライン";
export const TRANSPORT_LABEL = "再生操作";
export const PLAY_LABEL = "再生";
export const PAUSE_LABEL = "一時停止";
export const GO_TO_START_LABEL = "先頭へ";
export const GO_TO_END_LABEL = "最終へ";
export const CLIP_LABEL = "クリップ";
export const FRAME_LABEL = "フレーム";
export const FPS_LABEL = "fps";
export const TIMELINE_RESIZE_LABEL = "タイムラインの高さ";

/** スライダーの aria-valuetext。 */
export function frameText(frame: number, lastFrame: number): string {
  return frame + " / " + lastFrame;
}

/** 現在フレーム入力の右に出す最終フレーム。 */
export function lastFrameText(lastFrame: number): string {
  return "/ " + lastFrame;
}
