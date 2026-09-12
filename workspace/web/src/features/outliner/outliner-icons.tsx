import type { ReactElement } from "react";
import { CUBE_FRONT_EDGES, CUBE_OUTLINE } from "../viewer/display-icons";
import type { OutlinerNodeKind } from "./outliner-tree";

export const OUTLINER_ICON_VIEW_BOX = "0 0 16 16";

export function MeshIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="mesh" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
      <path d={CUBE_OUTLINE} />
      <path d={CUBE_FRONT_EDGES} />
    </svg>
  );
}

export function CurveIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="curve">
      <path d="M2 12C5 2 11 14 14 4" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="2" cy="12" r="1.25" fill="currentColor" />
      <circle cx="14" cy="4" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function PointsIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="points">
      <circle cx="4" cy="4" r="1.25" fill="currentColor" />
      <circle cx="11" cy="3" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="4" cy="12" r="1.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function BoneIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="bone">
      <path d="M4 12L12 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="3.5" cy="12.5" r="1.75" fill="currentColor" />
      <circle cx="12.5" cy="3.5" r="1.75" fill="currentColor" />
    </svg>
  );
}

export function LightIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="light">
      <circle cx="8" cy="7" r="3" fill="none" stroke="currentColor" />
      <path d="M8 1v2M8 11v2M2 7h2M12 7h2M6 14h4" fill="none" stroke="currentColor" />
    </svg>
  );
}

export function CameraIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="camera">
      <rect x="2" y="5" width="8" height="7" rx="1" fill="none" stroke="currentColor" />
      <path d="M10 8l4-2v5l-4-2z" fill="none" stroke="currentColor" />
    </svg>
  );
}

export function GroupIcon(): ReactElement {
  return (
    <svg className="outliner__icon" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false" data-kind="group">
      <path d="M2 4h4l1.5 1.5H14v7H2z" fill="none" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronIcon(): ReactElement {
  return (
    <svg className="outliner__chevron" viewBox={OUTLINER_ICON_VIEW_BOX} aria-hidden="true" focusable="false">
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const OUTLINER_KIND_ICONS: Readonly<Record<OutlinerNodeKind, () => ReactElement>> = {
  mesh: MeshIcon,
  curve: CurveIcon,
  points: PointsIcon,
  bone: BoneIcon,
  light: LightIcon,
  camera: CameraIcon,
  group: GroupIcon,
};

export function OutlinerKindIcon({ kind }: { kind: OutlinerNodeKind }): ReactElement {
  const Icon = OUTLINER_KIND_ICONS[kind];
  return <Icon />;
}
