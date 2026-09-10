import type { ReactElement } from "react";
import { MAX_FOCAL_LENGTH_MM, MIN_FOCAL_LENGTH_MM } from "@shared/types";
import { useCameraStore } from "../../store/camera";
import { FOCAL_LENGTH_LABEL, focalLengthText } from "./hud-labels";
import { FOCAL_LENGTH_STEP_MM } from "./focal-length";

/** HUD に置く焦点距離スライダー。 */
export function FocalLengthSlider(): ReactElement {
  const focalLength = useCameraStore((state) => state.focalLength);
  const setFocalLength = useCameraStore((state) => state.setFocalLength);

  return (
    <div className="hud-focal" role="group" aria-label={FOCAL_LENGTH_LABEL}>
      <label className="hud-focal__label" htmlFor="hud-focal-length">{FOCAL_LENGTH_LABEL}</label>
      <input
        id="hud-focal-length"
        className="hud-focal__range"
        type="range"
        min={MIN_FOCAL_LENGTH_MM}
        max={MAX_FOCAL_LENGTH_MM}
        step={FOCAL_LENGTH_STEP_MM}
        value={focalLength}
        onChange={(event) => setFocalLength(Number(event.target.value))}
      />
      <output className="hud-focal__value" htmlFor="hud-focal-length">{focalLengthText(focalLength)}</output>
    </div>
  );
}
