import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactElement } from "react";
import { hexToHsv, hsvToHex } from "./color-convert";
import {
  colorAtPoint,
  hueAtPoint,
  isInRing,
  isInSquare,
  pointAtHue,
  pointAtSaturationValue,
  renderWheelImage,
  saturationValueAtPoint,
  WHEEL_SIZE,
  type WheelPoint,
} from "./color-wheel";

export interface ColorWheelProps {
  /** 今の色。"#rrggbb" */
  value: string;
  /** 操作されたときに新しい "#rrggbb" を返す */
  onChange: (hex: string) => void;
  /** 外枠に付ける aria-label */
  label: string;
}

type DragState = {
  kind: "hue" | "sv";
  h: number;
  s: number;
  v: number;
} | null;

function pointFromEvent(event: PointerEvent<HTMLDivElement>): WheelPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function ColorWheel({ value, onChange, label }: ColorWheelProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState>(null);
  const hsv = hexToHsv(value);
  const huePoint = pointAtHue(hsv.h);
  const svPoint = pointAtSaturationValue(hsv.s, hsv.v);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (context === null || context === undefined) return;
    const image = context.createImageData(WHEEL_SIZE, WHEEL_SIZE);
    image.data.set(renderWheelImage(hsv.h));
    context.putImageData(image, 0, 0);
  }, [hsv.h]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    const point = pointFromEvent(event);
    const nextColor = colorAtPoint(point, value);
    if (nextColor === null) return;
    const nextHsv = hexToHsv(nextColor);
    const kind = isInRing(point) ? "hue" : isInSquare(point) ? "sv" : null;
    if (kind === null) return;
    dragRef.current = { kind, h: nextHsv.h, s: nextHsv.s, v: nextHsv.v };
    onChange(nextColor);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (drag === null) return;
    const point = pointFromEvent(event);
    const nextColor = drag.kind === "hue"
      ? hsvToHex({ h: hueAtPoint(point), s: drag.s, v: drag.v })
      : (() => {
          const { s, v } = saturationValueAtPoint(point);
          return hsvToHex({ h: drag.h, s, v });
        })();
    onChange(nextColor);
  }

  function endPointer(event: PointerEvent<HTMLDivElement>): void {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      className="theme-wheel"
      role="group"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <canvas
        ref={canvasRef}
        className="theme-wheel__canvas"
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        aria-hidden="true"
      />
      <i
        className="theme-wheel__marker theme-wheel__marker--hue"
        aria-hidden="true"
        style={{ "--marker-x": `${huePoint.x}px`, "--marker-y": `${huePoint.y}px` } as CSSProperties}
      />
      <i
        className="theme-wheel__marker theme-wheel__marker--sv"
        aria-hidden="true"
        style={{ "--marker-x": `${svPoint.x}px`, "--marker-y": `${svPoint.y}px` } as CSSProperties}
      />
    </div>
  );
}
