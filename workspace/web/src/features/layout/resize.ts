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
/** 左ドック(アウトライナ)幅の最小値と既定値(px)。 */
export const OUTLINER_WIDTH_MIN_PX = 200;
export const OUTLINER_WIDTH_DEFAULT_PX = 256;

export type LayoutSizeName = "panelWidth" | "timelineHeight" | "outlinerWidth";

/**
 * ハンドルから見て伸縮するパネルがどちら側にあるか。
 * "end" = ハンドルの右/下、"start" = ハンドルの左/上。
 */
export type ResizeSide = "start" | "end";

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
  outlinerWidth: {
    min: OUTLINER_WIDTH_MIN_PX,
    max: Number.POSITIVE_INFINITY,
    defaultValue: OUTLINER_WIDTH_DEFAULT_PX,
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

function reservedWidth(reservedPx: number | undefined): number {
  return reservedPx !== undefined && Number.isFinite(reservedPx) && reservedPx >= 0 ? reservedPx : 0;
}

function widthMax(bodyWidthPx: number, minWidth: number, reservedPx: number | undefined): number {
  if (!Number.isFinite(bodyWidthPx)) {
    return minWidth;
  }
  return Math.max(minWidth, Math.floor(bodyWidthPx) - VIEWER_MIN_WIDTH_PX - reservedWidth(reservedPx));
}

/** .review-body の幅から求めるパネル幅の上限。 */
export function panelWidthMax(bodyWidthPx: number, reservedPx?: number): number {
  return widthMax(bodyWidthPx, PANEL_WIDTH_MIN_PX, reservedPx);
}

/** .review-body の幅から求める左ドック幅の上限。 */
export function outlinerWidthMax(bodyWidthPx: number, reservedPx?: number): number {
  return widthMax(bodyWidthPx, OUTLINER_WIDTH_MIN_PX, reservedPx);
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
  side: ResizeSide = "end",
): number | null {
  if (drag === null || drag.pointerId !== pointerId) {
    return null;
  }
  const delta = side === "start" ? client - drag.startClient : drag.startClient - client;
  return clampSize(drag.startValue + delta, min, max);
}

/** 境界ハンドルのキー操作後の値を返す。 */
export function resizeKeyValue(
  key: string,
  axis: ResizeAxis,
  value: number,
  min: number,
  max: number,
  side: ResizeSide = "end",
): number | null {
  if (key === "Home") {
    return clampSize(min, min, max);
  }
  if (key === "End") {
    return clampSize(max, min, max);
  }
  const increaseKey = side === "start"
    ? axis === "x" ? "ArrowRight" : "ArrowDown"
    : axis === "x" ? "ArrowLeft" : "ArrowUp";
  const decreaseKey = side === "start"
    ? axis === "x" ? "ArrowLeft" : "ArrowUp"
    : axis === "x" ? "ArrowRight" : "ArrowDown";
  if (key === increaseKey) {
    return clampSize(value + RESIZE_KEY_STEP_PX, min, max);
  }
  if (key === decreaseKey) {
    return clampSize(value - RESIZE_KEY_STEP_PX, min, max);
  }
  return null;
}
