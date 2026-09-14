import type { Comment, CommentPlayback } from "@shared/types";
import type { ClientMessage } from "@shared/protocol";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";
import { usePlaybackStore } from "../../store/playback";
import { switchPlaybackSource } from "../viewer/playback-source-sync";

/** 再現中の線をライブ線と区別して表示する透明度。 */
export const REPLAY_OPACITY = 0.6;

/** コメントの再生位置をタイムラインへ反映する。 */
export function applyCommentPlayback(
  playback: CommentPlayback | null | undefined,
  send: (msg: ClientMessage) => boolean,
): boolean {
  if (playback === null || playback === undefined) {
    return false;
  }
  if (playback.versionId !== undefined && !switchPlaybackSource(playback.versionId, send)) {
    return false;
  }
  const store = usePlaybackStore.getState();
  if (!Number.isInteger(playback.clipIndex) || playback.clipIndex < 0 || playback.clipIndex >= store.clips.length) {
    return false;
  }
  store.pause();
  store.selectClip(playback.clipIndex);
  store.seekFrame(playback.frame);
  return true;
}

/** コメント選択の変化をカメラ・Presence・annotation ストアへ反映する。 */
export function applyCommentReplay(comment: Comment | null, send: (msg: ClientMessage) => boolean): void {
  if (comment === null) {
    useAnnotationStore.getState().setReplayStrokes([]);
    return;
  }

  useCameraStore.getState().requestCamera(comment.camera);
  usePresenceStore.getState().unfollow();
  useAnnotationStore.getState().setReplayStrokes(comment.strokes);
  applyCommentPlayback(comment.playback, send);
}
