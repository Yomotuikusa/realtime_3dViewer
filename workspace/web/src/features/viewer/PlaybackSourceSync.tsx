import { useEffect } from "react";
import { syncPlaybackClips } from "./playback-source-sync";
import { usePlaybackSource } from "./usePlaybackSource";

/** Canvas 内で解決済みの再生対象を playback ストアへ反映する描画なしの部品。 */
export function PlaybackSourceSync(): null {
  const { sourceId, sourceClips } = usePlaybackSource();

  useEffect(() => {
    syncPlaybackClips(sourceId, sourceClips);
  }, [sourceId, sourceClips]);

  return null;
}
