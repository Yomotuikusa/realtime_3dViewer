import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import { frameText, TIMELINE_LABEL } from "./timeline-labels";
import { frameAtX, frameToX, tickFrames, timelineKeyFrame, timelineTicks } from "./timeline";

export const RULER_HEIGHT_PX = 32;

export interface TimelineRulerProps {
  frame: number;
  lastFrame: number;
  onSeek(frame: number): void;
}

export function TimelineRuler({ frame, lastFrame, onSeek }: TimelineRulerProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track === null) return;
    const setMeasuredWidth = (nextWidth: number) => setWidth(Number.isFinite(nextWidth) ? Math.max(0, nextWidth) : 0);
    if (typeof ResizeObserver === "undefined") {
      setMeasuredWidth(track.getBoundingClientRect().width);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setMeasuredWidth(entry.contentRect.width);
    });
    observer.observe(track);
    setMeasuredWidth(track.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const { labelStep, tickStep } = timelineTicks(lastFrame, width);
  const seekFromClientX = (clientX: number, rect: DOMRect): void => {
    onSeek(frameAtX(clientX - rect.left, lastFrame, width));
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      seekFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
    }
  };
  const releasePointer = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const nextFrame = timelineKeyFrame(event.key, frame, lastFrame);
    if (nextFrame !== null) {
      event.preventDefault();
      onSeek(nextFrame);
    }
  };

  return (
    <div
      ref={trackRef}
      className="timeline__track"
      role="slider"
      tabIndex={0}
      aria-label={TIMELINE_LABEL}
      aria-valuemin={0}
      aria-valuemax={lastFrame}
      aria-valuenow={frame}
      aria-valuetext={frameText(frame, lastFrame)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onKeyDown={handleKeyDown}
    >
      {width > 0 && (
        <svg className="timeline__ruler" viewBox={"0 0 " + width + " " + RULER_HEIGHT_PX} aria-hidden="true">
          {tickFrames(lastFrame, tickStep).map((tick) => (
            <line key={"tick-" + tick} className="timeline__tick" x1={frameToX(tick, lastFrame, width)} x2={frameToX(tick, lastFrame, width)} y1={RULER_HEIGHT_PX - 6} y2={RULER_HEIGHT_PX} />
          ))}
          {tickFrames(lastFrame, labelStep).map((label) => (
            <g key={"label-" + label}>
              <line className="timeline__tick" x1={frameToX(label, lastFrame, width)} x2={frameToX(label, lastFrame, width)} y1={RULER_HEIGHT_PX - 12} y2={RULER_HEIGHT_PX} />
              <text className="timeline__label" x={frameToX(label, lastFrame, width)} y={12}>{label}</text>
            </g>
          ))}
          <g className="timeline__playhead" transform={"translate(" + frameToX(frame, lastFrame, width) + " 0)"}>
            <path d="M-5 0h10l-5 6z" />
            <rect x={-1} y={0} width={2} height={RULER_HEIGHT_PX} />
          </g>
        </svg>
      )}
    </div>
  );
}
