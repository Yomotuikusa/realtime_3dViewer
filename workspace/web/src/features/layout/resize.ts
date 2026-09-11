/** 横幅または縦幅を変更する境界の向き。 */
export type ResizeAxis = "x" | "y";

/** 矢印キー 1 回ぶんの増減(px)。 */
export const RESIZE_KEY_STEP_PX = 16;
/** 右パネル幅の最小値と既定値(px)。 */
export const PANEL_WIDTH_MIN_PX = 256;
export const PANEL_WIDTH_DEFAULT_PX = 352;
/** パネルを広げてもビューアに残す最小幅(px)。 */
export const VIEWER_MIN_WIDTH_PX = 320;
/** タイムラインのルーラー帯の高さの範囲と既定値(px)。 */
export const TIMELINE_TRACK_MIN_PX = 32;
export const TIMELINE_TRACK_MAX_PX = 240;
export const TIMELINE_TRACK_DEFAULT_PX = 32;

export type LayoutSizeName = "panelWidth" | "timelineHeight";

export interface SizeSpec {
  min: number;
  max: number;
  defaultValue: number;
}

export const LAYOUT_SIZE_SPECS: Readonly<Record<LayoutSizeName, SizeSpec>> = {
  panelWidth: {
    min: PANEL_WIDTH_MIN_PX,
    max: Number.POSITIVE_INFINITY,
    defaultValue: PANEL_WIDTH_DEFAULT_PX,
  },
  timelineHeight: {
    min: TIMELINE_TRACK_MIN_PX,
    max: TIMELINE_TRACK_MAX_PX,
    defaultValue: TIMELINE_TRACK_DEFAULT_PX,
  },
};

/** 値を整数に丸めて指定範囲へ収める。 */
export function clampSize(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** .review-body の幅から求めるパネル幅の上限。 */
export function panelWidthMax(bodyWidthPx: number): number {
  if (!Number.isFinite(bodyWidthPx)) {
    return PANEL_WIDTH_MIN_PX;
  }
  return Math.max(PANEL_WIDTH_MIN_PX, Math.floor(bodyWidthPx) - VIEWER_MIN_WIDTH_PX);
}

export interface ResizeDrag {
  pointerId: number;
  startClient: number;
  startValue: number;
}

/** pointermove 1 回ぶんのパネル値を返す。 */
export function resizeDragValue(
  drag: ResizeDrag | null,
  pointerId: number,
  client: number,
  min: number,
  max: number,
): number | null {
  if (drag === null || drag.pointerId !== pointerId) {
    return null;
  }
  return clampSize(drag.startValue + (drag.startClient - client), min, max);
}

/** 境界ハンドルのキー操作後の値を返す。 */
export function resizeKeyValue(
  key: string,
  axis: ResizeAxis,
  value: number,
  min: number,
  max: number,
): number | null {
  if (key === "Home") {
    return clampSize(min, min, max);
  }
  if (key === "End") {
    return clampSize(max, min, max);
  }
  const increaseKey = axis === "x" ? "ArrowLeft" : "ArrowUp";
  const decreaseKey = axis === "x" ? "ArrowRight" : "ArrowDown";
  if (key === increaseKey) {
    return clampSize(value + RESIZE_KEY_STEP_PX, min, max);
  }
  if (key === decreaseKey) {
    return clampSize(value - RESIZE_KEY_STEP_PX, min, max);
  }
  return null;
}
