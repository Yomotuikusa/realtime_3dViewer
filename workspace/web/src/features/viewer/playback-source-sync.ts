import type { AnimationClip } from "three";
import type { ClientMessage } from "@shared/protocol";
import { useModelClipsStore } from "../trail/model-clips";
import { useDisplayStore } from "../../store/display";
import { useObjectsStore } from "../../store/objects";
import { usePlaybackStore } from "../../store/playback";
import { clipSummaries } from "./playback";
import { detectFps } from "./playback-frames";
import { animatedObjects } from "./playback-source";

function sameSummaries(
  left: ReturnType<typeof clipSummaries>,
  right: ReturnType<typeof clipSummaries>,
): boolean {
  return left.length === right.length && left.every((clip, index) => {
    const other = right[index];
    return other !== undefined && clip.name === other.name && clip.duration === other.duration;
  });
}

/** sourceId と実クリップの要約を playback ストアへ同期する。 */
export function syncPlaybackClips(sourceId: string | null, clips: readonly AnimationClip[]): void {
  const summaries = clipSummaries(clips);
  const state = usePlaybackStore.getState();
  if (state.sourceId === sourceId && sameSummaries(state.clips, summaries)) return;
  state.setClips(summaries, detectFps(clips), sourceId);
}

/** アニメーション付き版だけを利用者操作で再生対象にする。 */
export function switchPlaybackSource(
  versionId: string,
  send: (msg: ClientMessage) => boolean,
): boolean {
  const objects = useObjectsStore.getState().objects;
  const clips = useModelClipsStore.getState().clips;
  if (!animatedObjects(objects, clips).some((object) => object.id === versionId)) return false;

  if (usePlaybackStore.getState().sourceId === versionId) return true;
  const sourceClips = clips[versionId];
  if (sourceClips === undefined) return false;

  useDisplayStore.getState().setPlaybackSource(versionId);
  syncPlaybackClips(versionId, sourceClips);
  send({ type: "playback:source", versionId });
  return true;
}
