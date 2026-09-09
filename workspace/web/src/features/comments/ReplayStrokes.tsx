import type { ReactElement } from "react";
import { useAnnotationStore } from "../../store/annotation";
import { StrokeLines } from "../annotation/StrokeLines";
import { REPLAY_OPACITY } from "./replay";

/** コメント再現用の線をライブ線とは別レイヤーで表示する。 */
export function ReplayStrokes(): ReactElement {
  const strokes = useAnnotationStore((state) => state.replayStrokes);
  return <StrokeLines strokes={strokes} opacity={REPLAY_OPACITY} />;
}
