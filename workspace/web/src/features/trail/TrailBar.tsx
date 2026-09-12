import { Bone } from "three";
import type { ReactElement } from "react";
import { isSameObjectPart } from "@shared/object-part";
import type { ClientMessage } from "@shared/protocol";
import { motionTrailEquals, type MotionTrail } from "@shared/trail";
import type { ObjectPartRef } from "@shared/types";
import { useDisplayStore } from "../../store/display";
import { selectModelScene, useModelScenesStore } from "../compare/model-scenes";
import { useSelectionStore } from "../outliner/selection";
import { objectPartRefOf } from "./trail-target";
import { TRAIL_DISPLAY_LABEL, TRAIL_NO_BONE_HINT, TRAIL_VISIBLE_LABEL } from "./trail-labels";
import { TrailIcon } from "./trail-icons";

export function TrailBar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const selected = useSelectionStore((state) => state.selected);
  const scenes = useModelScenesStore((state) => state.scenes);
  const motionTrail = useDisplayStore((state) => state.motionTrail);
  const setMotionTrail = useDisplayStore((state) => state.setMotionTrail);
  const scene = selectModelScene(scenes, selected?.versionId ?? null);
  const selectedObject = selected === null || scene === null
    ? null
    : scene.getObjectByProperty("uuid", selected.objectId);
  const selectedTarget: ObjectPartRef | null = selectedObject instanceof Bone
    ? objectPartRefOf(scenes, selectedObject)
    : null;
  const disabled = selectedTarget === null && !motionTrail.visible;

  function applyTrail(next: MotionTrail): void {
    if (motionTrailEquals(motionTrail, next)) return;
    setMotionTrail(next);
    send({ type: "trail:display", trail: next });
  }

  function toggleTrail(): void {
    const sameSelectedTarget = selectedTarget === null
      || (motionTrail.target !== null && isSameObjectPart(selectedTarget, motionTrail.target));
    const next: MotionTrail = motionTrail.visible && sameSelectedTarget
      ? { visible: false, target: motionTrail.target }
      : { visible: true, target: selectedTarget };
    applyTrail(next);
  }

  const buttonLabel = disabled ? TRAIL_NO_BONE_HINT : TRAIL_VISIBLE_LABEL;
  return (
    <div className="hud-display" role="group" aria-label={TRAIL_DISPLAY_LABEL}>
      <button
        className="btn hud-display__btn"
        type="button"
        aria-pressed={motionTrail.visible}
        aria-label={buttonLabel}
        title={buttonLabel}
        disabled={disabled}
        onClick={toggleTrail}
      >
        <TrailIcon />
      </button>
    </div>
  );
}
