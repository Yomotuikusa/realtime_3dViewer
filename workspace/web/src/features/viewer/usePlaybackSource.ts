import { useMemo } from "react";
import type { AnimationClip } from "three";
import type { ModelVersion } from "@shared/types";
import { useDisplayStore } from "../../store/display";
import { useObjectsStore } from "../../store/objects";
import { useModelClipsStore, selectModelClips } from "../trail/model-clips";
import { animatedObjects, resolvePlaybackSource } from "./playback-source";

const EMPTY_CLIPS: readonly AnimationClip[] = [];

/** オブジェクト、クリップ登録、ルーム指定から再生対象を解決する。 */
export function usePlaybackSource(): {
  sourceId: string | null;
  sourceClips: readonly AnimationClip[];
  animated: readonly ModelVersion[];
} {
  const objects = useObjectsStore((state) => state.objects);
  const clips = useModelClipsStore((state) => state.clips);
  const preferredId = useDisplayStore((state) => state.playbackSource);
  const animated = useMemo(() => animatedObjects(objects, clips), [objects, clips]);
  const sourceId = useMemo(
    () => resolvePlaybackSource(objects, clips, preferredId),
    [objects, clips, preferredId],
  );
  const sourceClips = useMemo(
    () => selectModelClips(clips, sourceId) ?? EMPTY_CLIPS,
    [clips, sourceId],
  );

  return { sourceId, sourceClips, animated };
}
