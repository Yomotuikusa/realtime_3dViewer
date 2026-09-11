import { useAnnotationStore } from "../store/annotation";
import { useCameraStore } from "../store/camera";
import { useCommentsStore } from "../store/comments";
import { useDisplayStore } from "../store/display";
import { useLightingStore } from "../store/lighting";
import { useObjectsStore } from "../store/objects";
import { usePlaybackStore } from "../store/playback";
import { usePresenceStore } from "../store/presence";
import { useSessionStore } from "../store/session";

/** レビュー画面が持つ9つのストアをすべて初期状態へ戻す。 */
export function resetReviewStores(): void {
  useSessionStore.getState().reset();
  usePresenceStore.getState().reset();
  useAnnotationStore.getState().reset();
  useCommentsStore.getState().reset();
  useCameraStore.getState().reset();
  useLightingStore.getState().reset();
  useObjectsStore.getState().reset();
  useDisplayStore.getState().reset();
  usePlaybackStore.getState().reset();
}
