import { Line } from "@react-three/drei";
import type { Stroke } from "@shared/types";
import type { ReactElement } from "react";
import { useAnnotationStore } from "../../store/annotation";
import { strokeLineSpecs } from "./stroke-overlay";

export function StrokeLines({ strokes, opacity = 1 }: { strokes: Stroke[]; opacity?: number }): ReactElement {
  const overlay = useAnnotationStore((state) => state.overlay);

  return (
    <>
      {strokes.flatMap((stroke) => strokeLineSpecs(stroke, { opacity, overlay }).map(({ key, ...props }) => (
        <Line key={key} {...props} />
      )))}
    </>
  );
}
