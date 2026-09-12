import type { ReactElement } from "react";

export const JOINT_VIEW_BOX = "0 0 16 16";
/** ジョイント球の中心 [cx, cy]。親から子へ並べる */
export const JOINT_POINTS: readonly (readonly [number, number])[] = [[5, 12], [8, 8], [11, 4]];
/** ジョイント球の半径 */
export const JOINT_DOT_RADIUS = 1.6;
/** JOINT_POINTS を順に結ぶ親子リンクの折れ線 */
export const JOINT_LINK_PATH = "M5 12 8 8 11 4";
/** x-ray アイコンでジョイントの手前に重なるメッシュ面 */
export const JOINT_XRAY_SURFACE = "M2.5 2.5h11v11h-11Z";

/** 骨だけ。リンクは線、ジョイントは塗りつぶした円 */
export function JointIcon(): ReactElement {
  return (
    <svg
      className="hud-display__icon"
      viewBox={JOINT_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d={JOINT_LINK_PATH} />
      {JOINT_POINTS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={JOINT_DOT_RADIUS} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

/** 骨の手前に半透明の面を重ね、面越しに骨が見えることを表す */
export function JointXrayIcon(): ReactElement {
  return (
    <svg
      className="hud-display__icon"
      viewBox={JOINT_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d={JOINT_LINK_PATH} />
      {JOINT_POINTS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={JOINT_DOT_RADIUS} fill="currentColor" stroke="none" />
      ))}
      <path d={JOINT_XRAY_SURFACE} fill="currentColor" fillOpacity={0.25} stroke="none" />
    </svg>
  );
}
