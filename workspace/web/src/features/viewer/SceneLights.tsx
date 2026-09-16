import type { ReactElement } from "react";
import {
  fillLightPosition,
  lightPosition,
  scaledLightIntensities,
} from "./lighting";
import { useLightingStore } from "../../store/lighting";

/** lighting ストアの向きに従って環境光・主ライト・補助ライトを置く。 */
export function SceneLights(): ReactElement {
  const angles = useLightingStore((state) => state.angles);
  const brightness = useLightingStore((state) => state.brightness);
  const { ambient, key, fill } = scaledLightIntensities(brightness);
  return (
    <>
      <ambientLight intensity={ambient} />
      <directionalLight position={lightPosition(angles)} intensity={key} />
      <directionalLight position={fillLightPosition(angles)} intensity={fill} />
    </>
  );
}
