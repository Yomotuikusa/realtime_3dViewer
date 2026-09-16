import type { ReactElement } from "react";

export const SUN_VIEW_BOX = "0 0 16 16";
/** 光源のコア。強弱どちらのアイコンも同じ半径で描き、光線の有無だけで強弱を表す */
export const SUN_CORE_CX = 8;
export const SUN_CORE_CY = 8;
export const SUN_CORE_RADIUS = 3.2;
/** コアから 45 度おきに 8 本。中心から 5.2 で始まり 7.2 で終わる線分 */
export const SUN_RAY_INNER_RADIUS = 5.2;
export const SUN_RAY_OUTER_RADIUS = 7.2;
export const SUN_RAYS =
  "M13.2 8 15.2 8M2.8 8 0.8 8M8 13.2 8 15.2M8 2.8 8 0.8" +
  "M11.68 11.68 13.09 13.09M4.32 11.68 2.91 13.09M4.32 4.32 2.91 2.91M11.68 4.32 13.09 2.91";
export const SUN_RAY_STROKE_WIDTH = 1.4;

/** 弱い側。光線を持たないコアだけの光源 */
export function LowBrightnessIcon(): ReactElement {
  return (
    <svg className="light-gizmo__brightness-icon" viewBox={SUN_VIEW_BOX} aria-hidden="true" focusable="false">
      <circle cx={SUN_CORE_CX} cy={SUN_CORE_CY} r={SUN_CORE_RADIUS} fill="currentColor" />
    </svg>
  );
}

/** 強い側。同じコアに 8 本の光線が付いた光源 */
export function HighBrightnessIcon(): ReactElement {
  return (
    <svg className="light-gizmo__brightness-icon" viewBox={SUN_VIEW_BOX} aria-hidden="true" focusable="false">
      <circle cx={SUN_CORE_CX} cy={SUN_CORE_CY} r={SUN_CORE_RADIUS} fill="currentColor" />
      <path
        d={SUN_RAYS}
        fill="none"
        stroke="currentColor"
        strokeWidth={SUN_RAY_STROKE_WIDTH}
        strokeLinecap="round"
      />
    </svg>
  );
}
