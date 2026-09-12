import type { ReactElement } from "react";

export const TRAIL_VIEW_BOX = "0 0 16 16";
/** 軌跡を表す弧。左下から右上へ弧を描く */
export const TRAIL_ARC_PATH = "M2.5 12.5C5.5 12.5 8.5 9.5 13.5 3.5";
/** 弧の上に並べるフレーム点の中心 [cx, cy] */
export const TRAIL_DOTS: readonly (readonly [number, number])[] = [
  [3.8, 11.9],
  [6.5, 10.2],
  [9.5, 7.8],
  [13.5, 3.5],
];
/** フレーム点の半径 */
export const TRAIL_DOT_RADIUS = 1.1;

/** 弧と、その上に並ぶフレーム点 */
export function TrailIcon(): ReactElement {
  return (
    <svg
      className="hud-display__icon"
      viewBox={TRAIL_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d={TRAIL_ARC_PATH} />
      {TRAIL_DOTS.map(([cx, cy], index) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={index === TRAIL_DOTS.length - 1 ? TRAIL_DOT_RADIUS * 1.6 : TRAIL_DOT_RADIUS}
          fill="currentColor"
          stroke="none"
        />
      ))}
    </svg>
  );
}
