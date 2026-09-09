import { Line } from "@react-three/drei";
import type { Stroke } from "@shared/types";
import type { ReactElement } from "react";

export function StrokeLines({ strokes, opacity = 1 }: { strokes: Stroke[]; opacity?: number }): ReactElement {
  return (
    <>
      {strokes.map((stroke) => (
        <Line
          key={stroke.id}
          points={stroke.points}
          color={stroke.color}
          lineWidth={3}
          depthTest
          opacity={opacity}
          transparent={opacity < 1}
        />
      ))}
    </>
  );
}
