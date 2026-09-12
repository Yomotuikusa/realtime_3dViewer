import type { ReactElement } from "react";
import type { MeshDisplayMode } from "@shared/types";

export const CUBE_VIEW_BOX = "0 0 16 16";
/** 立方体の外形(閉じた六角形) */
export const CUBE_OUTLINE = "M8 1.5 13.6 4.75v6.5L8 14.5 2.4 11.25v-6.5Z";
/** 上面・左面・右面の菱形 */
export const CUBE_TOP = "M8 1.5 13.6 4.75 8 8 2.4 4.75Z";
export const CUBE_LEFT = "M2.4 4.75 8 8v6.5L2.4 11.25Z";
export const CUBE_RIGHT = "M13.6 4.75v6.5L8 14.5V8Z";
/** 手前の頂点から出る3本の稜線(手前だけ。奥の垂直辺は含まない) */
export const CUBE_FRONT_EDGES = "M8 8 2.4 4.75M8 8 13.6 4.75M8 8v6.5";
/** 手前の2本 + 縦の一直線(手前と奥の垂直辺が重なる)。ワイヤフレーム専用 */
export const CUBE_ALL_EDGES = "M8 8 2.4 4.75M8 8 13.6 4.75M8 1.5V14.5";

/** 3面を currentColor で塗り分ける。光源は上なので top を最も明るくする */
function CubeFaces({ top, left, right }: { top: number; left: number; right: number }): ReactElement {
  return (
    <g fill="currentColor">
      <path d={CUBE_TOP} fillOpacity={top} />
      <path d={CUBE_LEFT} fillOpacity={left} />
      <path d={CUBE_RIGHT} fillOpacity={right} />
    </g>
  );
}

/** 面だけ。線を描かない */
export function SolidIcon(): ReactElement {
  return (
    <svg className="hud-display__icon" viewBox={CUBE_VIEW_BOX} aria-hidden="true" focusable="false">
      <CubeFaces top={1} left={0.55} right={0.8} />
    </svg>
  );
}

/** 線だけ。奥の稜線も見える */
export function WireframeIcon(): ReactElement {
  return (
    <svg
      className="hud-display__icon"
      viewBox={CUBE_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    >
      <path d={CUBE_OUTLINE} />
      <path d={CUBE_ALL_EDGES} />
    </svg>
  );
}

/** 薄い面に手前の稜線を重ねる */
export function SolidWireframeIcon(): ReactElement {
  return (
    <svg className="hud-display__icon" viewBox={CUBE_VIEW_BOX} aria-hidden="true" focusable="false">
      <CubeFaces top={0.45} left={0.25} right={0.35} />
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
        <path d={CUBE_OUTLINE} />
        <path d={CUBE_FRONT_EDGES} />
      </g>
    </svg>
  );
}

export const MESH_DISPLAY_ICONS: Readonly<Record<MeshDisplayMode, () => ReactElement>> = {
  solid: SolidIcon,
  wireframe: WireframeIcon,
  "solid-wireframe": SolidWireframeIcon,
};
