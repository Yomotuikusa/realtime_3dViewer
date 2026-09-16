import { Line } from "@react-three/drei";
import type { Stroke } from "@shared/types";
import type { ReactElement } from "react";
import { useAnnotationStore } from "../../store/annotation";
import { selectViewSetting, useViewSettingsStore } from "../../store/view-settings";
import { strokeLineSpecs } from "./stroke-overlay";

export function StrokeLines({ strokes, opacity = 1 }: { strokes: Stroke[]; opacity?: number }): ReactElement {
  const overlay = useAnnotationStore((state) => state.overlay);
  const lineWidth = useViewSettingsStore(selectViewSetting("strokeWidth"));
  const overlayOpacityRatio = useViewSettingsStore(selectViewSetting("overlayOpacityRatio"));

  return (
    <>
      {strokes.flatMap((stroke) => strokeLineSpecs(stroke, {
        opacity,
        overlay,
        lineWidth,
        overlayOpacityRatio,
      }).map(({ key, ...props }) => (
        <Line key={key} {...props} />
      )))}
    </>
  );
}
