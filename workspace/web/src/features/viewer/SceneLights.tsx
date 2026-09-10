import type { ReactElement } from "react";
import {
  AMBIENT_LIGHT_INTENSITY,
  FILL_LIGHT_INTENSITY,
  fillLightPosition,
  KEY_LIGHT_INTENSITY,
  lightPosition,
} from "./lighting";
import { useLightingStore } from "../../store/lighting";

/** lighting ストアの向きに従って環境光・主ライト・補助ライトを置く。 */
export function SceneLights(): ReactElement {
  const angles = useLightingStore((state) => state.angles);
  return (
    <>
      <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
      <directionalLight position={lightPosition(angles)} intensity={KEY_LIGHT_INTENSITY} />
      <directionalLight position={fillLightPosition(angles)} intensity={FILL_LIGHT_INTENSITY} />
    </>
  );
}
