import type { ReactElement } from "react";

export const DOCK_ICON_VIEW_BOX = "0 0 16 16";
/** アイコン外周の枠。 */
export const DOCK_FRAME_PATH = "M2.5 3.5h11v9h-11Z";
/** 左ドックを表す塗り。 */
export const DOCK_LEFT_FILL_PATH = "M2.5 3.5h3.5v9H2.5Z";
/** 右ドックを表す塗り。 */
export const DOCK_RIGHT_FILL_PATH = "M10 3.5h3.5v9H10Z";

export function OutlinerDockIcon(): ReactElement {
  return (
    <svg
      className="review-header__dock-icon"
      viewBox={DOCK_ICON_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <path d={DOCK_FRAME_PATH} />
      <path d={DOCK_LEFT_FILL_PATH} fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PanelDockIcon(): ReactElement {
  return (
    <svg
      className="review-header__dock-icon"
      viewBox={DOCK_ICON_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <path d={DOCK_FRAME_PATH} />
      <path d={DOCK_RIGHT_FILL_PATH} fill="currentColor" stroke="none" />
    </svg>
  );
}
