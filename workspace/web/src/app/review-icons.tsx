import type { ReactElement } from "react";

export const CHEVRON_ICON_VIEW_BOX = "0 0 16 16";
/** 左向きのシェブロン。 */
export const CHEVRON_LEFT_PATH = "M10 3.5 5.5 8l4.5 4.5";
/** 右向きのシェブロン。 */
export const CHEVRON_RIGHT_PATH = "M6 3.5 10.5 8 6 12.5";

export type ChevronDirection = "left" | "right";

/** class="review-chevron-icon"、aria-hidden="true"、focusable="false"、stroke="currentColor" の SVG を返す。 */
export function ChevronIcon({ direction }: { direction: ChevronDirection }): ReactElement {
  return (
    <svg
      className="review-chevron-icon"
      viewBox={CHEVRON_ICON_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d={direction === "left" ? CHEVRON_LEFT_PATH : CHEVRON_RIGHT_PATH} />
    </svg>
  );
}
