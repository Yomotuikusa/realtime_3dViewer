import type { CSSProperties, ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { STROKE_COLORS, useAnnotationStore } from "../../store/annotation";
import { useSessionStore } from "../../store/session";
import { latestOwnStrokeId } from "./stroke-build";
import {
  CLEAR_LABEL,
  colorName,
  OVERLAY_LABEL,
  PLACEMENT_LABELS,
  PLACEMENT_ORDER,
  UNDO_LABEL,
} from "../viewer/hud-labels";
import "./annotation.css";

export function AnnotationToolbar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const color = useAnnotationStore((state) => state.color);
  const overlay = useAnnotationStore((state) => state.overlay);
  const placement = useAnnotationStore((state) => state.placement);
  const strokes = useAnnotationStore((state) => state.strokes);
  const selfId = useSessionStore((state) => state.selfId);
  const connection = useSessionStore((state) => state.connection);
  const latestStrokeId = selfId === null ? null : latestOwnStrokeId(strokes, selfId);
  const ownStrokeCount = selfId === null
    ? 0
    : Object.values(strokes).filter((stroke) => stroke.userId === selfId).length;
  const canEdit = connection === "open";

  return (
    <div className="annotation-tools" role="toolbar" aria-label="ペン">
      <div className="annotation-colors" role="group" aria-label="線の色">
        {STROKE_COLORS.map((strokeColor) => (
          <button
            key={strokeColor}
            className="annotation-color"
            type="button"
            aria-label={colorName(strokeColor)}
            aria-pressed={color === strokeColor}
            onClick={() => useAnnotationStore.getState().setColor(strokeColor)}
            style={{ "--stroke-color": strokeColor } as CSSProperties}
          />
        ))}
      </div>
      <div role="group" aria-label="描画の基準">
        {PLACEMENT_ORDER.map((placementValue) => (
          <button
            key={placementValue}
            className="btn btn--quiet"
            type="button"
            aria-pressed={placement === placementValue}
            onClick={() => useAnnotationStore.getState().setPlacement(placementValue)}
          >
            {PLACEMENT_LABELS[placementValue]}
          </button>
        ))}
      </div>
      <button
        className="btn btn--quiet"
        type="button"
        onClick={() => {
          if (canEdit && latestStrokeId !== null) {
            send({ type: "stroke:remove", strokeId: latestStrokeId });
          }
        }}
        disabled={!canEdit || latestStrokeId === null}
      >
        {UNDO_LABEL}
      </button>
      <button
        className="btn btn--quiet"
        type="button"
        onClick={() => {
          if (canEdit && ownStrokeCount > 0) {
            send({ type: "stroke:clear" });
          }
        }}
        disabled={!canEdit || ownStrokeCount === 0}
      >
        {CLEAR_LABEL}
      </button>
      <button
        className="btn btn--quiet"
        type="button"
        aria-pressed={overlay}
        onClick={() => useAnnotationStore.getState().setOverlay(!overlay)}
      >
        {OVERLAY_LABEL}
      </button>
    </div>
  );
}
