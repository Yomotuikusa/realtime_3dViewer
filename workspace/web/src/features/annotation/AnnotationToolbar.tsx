import type { ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import {
  STROKE_COLORS,
  type AnnotationMode,
  useAnnotationStore,
} from "../../store/annotation";
import { useSessionStore } from "../../store/session";
import { latestOwnStrokeId } from "./stroke-build";

const MODES: Array<{ mode: AnnotationMode; label: string }> = [
  { mode: "orbit", label: "Orbit" },
  { mode: "pen", label: "Pen" },
  { mode: "comment", label: "Comment" },
];

export function AnnotationToolbar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const mode = useAnnotationStore((state) => state.mode);
  const color = useAnnotationStore((state) => state.color);
  const strokes = useAnnotationStore((state) => state.strokes);
  const selfId = useSessionStore((state) => state.selfId);
  const connection = useSessionStore((state) => state.connection);
  const latestStrokeId = selfId === null ? null : latestOwnStrokeId(strokes, selfId);
  const ownStrokeCount = selfId === null
    ? 0
    : Object.values(strokes).filter((stroke) => stroke.userId === selfId).length;
  const canEdit = connection === "open";

  const selectMode = (nextMode: AnnotationMode): void => {
    useAnnotationStore.getState().setMode(nextMode);
  };

  return (
    <div role="toolbar" aria-label="Annotation tools" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      {MODES.map(({ mode: modeValue, label }) => (
        <button
          key={modeValue}
          type="button"
          aria-pressed={mode === modeValue}
          onClick={() => selectMode(modeValue)}
        >
          {label}
        </button>
      ))}
      <span aria-label="Stroke colors" style={{ display: "flex", gap: "0.2rem", marginLeft: "0.25rem" }}>
        {STROKE_COLORS.map((strokeColor) => (
          <button
            key={strokeColor}
            type="button"
            aria-label={`色 ${strokeColor}`}
            aria-pressed={color === strokeColor}
            onClick={() => useAnnotationStore.getState().setColor(strokeColor)}
            style={{
              width: "1.25rem",
              height: "1.25rem",
              padding: 0,
              border: color === strokeColor ? "2px solid #101828" : "1px solid #98a2b3",
              borderRadius: "50%",
              background: strokeColor,
            }}
          />
        ))}
      </span>
      <button
        type="button"
        onClick={() => {
          if (canEdit && latestStrokeId !== null) {
            send({ type: "stroke:remove", strokeId: latestStrokeId });
          }
        }}
        disabled={!canEdit || latestStrokeId === null}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={() => {
          if (canEdit && ownStrokeCount > 0) {
            send({ type: "stroke:clear" });
          }
        }}
        disabled={!canEdit || ownStrokeCount === 0}
      >
        Clear
      </button>
    </div>
  );
}
