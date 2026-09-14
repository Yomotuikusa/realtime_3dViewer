import { useSelectionStore } from "../features/outliner/selection";
import { useCommentsStore } from "../store/comments";
import { useDisplayStore } from "../store/display";
import { useObjectsStore } from "../store/objects";

/** オブジェクト削除を各ストアへ反映する。何度呼んでも安全。 */
export function applyObjectRemoved(versionId: string): void {
  useObjectsStore.getState().remove(versionId);
  useCommentsStore.getState().removeByVersion(versionId);

  const selection = useSelectionStore.getState().selected;
  if (selection?.versionId === versionId) useSelectionStore.getState().clear();

  const display = useDisplayStore.getState();
  const compare = display.meshCompare;
  if (compare.baseId === versionId || compare.targetId === versionId) {
    display.setMeshCompare({
      baseId: compare.baseId === versionId ? null : compare.baseId,
      targetId: compare.targetId === versionId ? null : compare.targetId,
      thresholdPermille: compare.thresholdPermille,
    });
  }
  if (display.playbackSource === versionId) display.setPlaybackSource(null);

  const comments = useCommentsStore.getState();
  if (useObjectsStore.getState().objects.length === 0 && comments.composerAnchor !== null) {
    comments.setComposerAnchor(null);
  }
}
