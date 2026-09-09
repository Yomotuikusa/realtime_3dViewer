import type { Comment } from "@shared/types";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";

/** 再現中の線をライブ線と区別して表示する透明度。 */
export const REPLAY_OPACITY = 0.6;

/** コメント選択の変化をカメラ・Presence・annotation ストアへ反映する。 */
export function applyCommentReplay(comment: Comment | null): void {
  if (comment === null) {
    useAnnotationStore.getState().setReplayStrokes([]);
    return;
  }

  useCameraStore.getState().requestCamera(comment.camera);
  usePresenceStore.getState().unfollow();
  useAnnotationStore.getState().setReplayStrokes(comment.strokes);
}
