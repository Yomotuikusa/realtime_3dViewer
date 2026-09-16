import type { Stroke, Vec3 } from "@shared/types";

/** 通常線の太さ。既存の StrokeLines と同じ値。 */
export const BASE_LINE_WIDTH = 3;
/** 透過線は通常線のこの比率で描く。 */
export const OVERLAY_LINE_WIDTH_RATIO = 0.5;
/** 透過線の太さ。通常線より細くして、見えている部分での重なりを目立たせない。 */
export const OVERLAY_LINE_WIDTH = BASE_LINE_WIDTH * OVERLAY_LINE_WIDTH_RATIO;
/** 透過線の不透明度は、通常線の不透明度にこの比を掛けた値にする。 */
export const OVERLAY_OPACITY_RATIO = 0.35;

/** drei の Line に渡す値。key は React の key に使い、残りはそのまま props に展開する。 */
export interface StrokeLineSpec {
  key: string;
  points: Vec3[];
  color: string;
  lineWidth: number;
  depthTest: boolean;
  depthWrite: boolean;
  transparent: boolean;
  opacity: number;
}

/** 1本の Stroke を描く通常線と、必要なら透過線の spec を返す。 */
export interface StrokeLineOptions {
  opacity: number;
  overlay: boolean;
  lineWidth?: number;
  overlayOpacityRatio?: number;
}

export function strokeLineSpecs(stroke: Stroke, options: StrokeLineOptions): StrokeLineSpec[] {
  const lineWidth = options.lineWidth ?? BASE_LINE_WIDTH;
  const overlayOpacityRatio = options.overlayOpacityRatio ?? OVERLAY_OPACITY_RATIO;
  const base: StrokeLineSpec = {
    key: stroke.id,
    points: stroke.points,
    color: stroke.color,
    lineWidth,
    depthTest: true,
    depthWrite: true,
    transparent: options.opacity < 1,
    opacity: options.opacity,
  };

  if (!options.overlay) {
    return [base];
  }

  return [
    base,
    {
      key: `${stroke.id}:overlay`,
      points: stroke.points,
      color: stroke.color,
      lineWidth: lineWidth * OVERLAY_LINE_WIDTH_RATIO,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: options.opacity * overlayOpacityRatio,
    },
  ];
}
