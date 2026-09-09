import { useAnnotationStore } from "../store/annotation";
import { useCameraStore } from "../store/camera";
import { useCommentsStore } from "../store/comments";
import { usePresenceStore } from "../store/presence";
import { useSessionStore } from "../store/session";

/** レビュー画面が持つ5つのストアをすべて初期状態へ戻す。 */
export function resetReviewStores(): void {
  useSessionStore.getState().reset();
  usePresenceStore.getState().reset();
  useAnnotationStore.getState().reset();
  useCommentsStore.getState().reset();
  useCameraStore.getState().reset();
}
