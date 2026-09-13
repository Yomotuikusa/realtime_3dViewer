import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useDisplayStore } from "../../store/display";
import { usePlaybackStore } from "../../store/playback";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { useModelScenesStore } from "../compare/model-scenes";
import { jointRadius } from "../joint/joint-display";
import { hexToNumber } from "../theme/viewer-colors";
import { frameOfTime } from "../viewer/playback-frames";
import { useModelClipsStore, selectModelClips } from "./model-clips";
import { resolveTrailTarget } from "./trail-target";
import { sampleTrail } from "./trail-sample";
import {
  addTrailOverlay,
  removeTrailOverlay,
  setTrailCurrentFrame,
  trailOverlayOf,
} from "./trail-overlay";

/** Canvas に 1 つだけ置く描画なしの部品。軌跡のライフサイクルと現在位置の更新を管理する。 */
export function TrailRig(): null {
  const motionTrail = useDisplayStore((state) => state.motionTrail);
  const scenes = useModelScenesStore((state) => state.scenes);
  const clips = useModelClipsStore((state) => state.clips);
  const clipIndex = usePlaybackStore((state) => state.clipIndex);
  const fps = usePlaybackStore((state) => state.fps);
  const lineColor = useThemeStore(selectViewerColor("trailLine"));
  const pointColor = useThemeStore(selectViewerColor("trailPoint"));
  const currentColor = useThemeStore(selectViewerColor("trailCurrent"));

  useEffect(() => {
    for (const scene of Object.values(scenes)) removeTrailOverlay(scene);

    if (!motionTrail.visible) return;
    const target = resolveTrailTarget(scenes, motionTrail.target);
    if (target === null) return;
    const clip = selectModelClips(clips, target.versionId)?.[clipIndex];
    if (clip === undefined) return;

    const sample = sampleTrail(
      target.root,
      target.object,
      clip,
      fps,
      usePlaybackStore.getState().time,
    );
    addTrailOverlay(target.root, sample, jointRadius(target.root), {
      line: hexToNumber(lineColor),
      point: hexToNumber(pointColor),
      current: hexToNumber(currentColor),
    });

    return () => {
      for (const scene of Object.values(scenes)) removeTrailOverlay(scene);
    };
  }, [scenes, clips, motionTrail, clipIndex, fps, lineColor, pointColor, currentColor]);

  useFrame(() => {
    const frame = frameOfTime(usePlaybackStore.getState().time, fps);
    for (const scene of Object.values(scenes)) {
      const overlay = trailOverlayOf(scene);
      if (overlay !== null) setTrailCurrentFrame(overlay, frame);
    }
  });

  return null;
}
