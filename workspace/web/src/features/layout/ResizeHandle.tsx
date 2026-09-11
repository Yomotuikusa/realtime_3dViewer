import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import { resizeDragValue, resizeKeyValue, type ResizeAxis, type ResizeDrag } from "./resize";
import "./layout.css";

export interface ResizeHandleProps {
  axis: ResizeAxis;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  label: string;
  className?: string;
  onChange(value: number): void;
}

export function ResizeHandle({
  axis,
  value,
  min,
  max,
  defaultValue,
  label,
  className,
  onChange,
}: ResizeHandleProps): ReactElement {
  const dragRef = useRef<ResizeDrag | null>(null);
  const [dragging, setDragging] = useState(false);
  const classes = "resize-handle" + (className ? " " + className : "");

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClient: axis === "x" ? event.clientX : event.clientY,
      startValue: value,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const nextValue = resizeDragValue(
      dragRef.current,
      event.pointerId,
      axis === "x" ? event.clientX : event.clientY,
      min,
      max,
    );
    if (nextValue !== null) {
      onChange(nextValue);
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const nextValue = resizeKeyValue(event.key, axis, value, min, max);
    if (nextValue !== null) {
      event.preventDefault();
      onChange(nextValue);
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      className={classes}
      data-axis={axis}
      data-dragging={dragging}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={handleKeyDown}
    />
  );
}
