import type { Stroke } from "@shared/types";
import type { ReactElement } from "react";
import { StrokeLines } from "./StrokeLines";
import { orderedStrokes, useAnnotationStore } from "../../store/annotation";

const DRAFT_STROKE_ID = "__draft__";

export function RoomStrokes(): ReactElement {
  const strokes = useAnnotationStore((state) => state.strokes);
  const drafting = useAnnotationStore((state) => state.drafting);
  const color = useAnnotationStore((state) => state.color);
  const displayedStrokes = orderedStrokes(strokes);

  if (drafting !== null && drafting.length >= 2) {
    const draftStroke: Stroke = {
      id: DRAFT_STROKE_ID,
      userId: DRAFT_STROKE_ID,
      color,
      points: drafting,
      createdAt: 0,
    };
    displayedStrokes.push(draftStroke);
  }

  return <StrokeLines strokes={displayedStrokes} />;
}
