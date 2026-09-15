import type { ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import {
  MAX_COMPARE_THRESHOLD_PERMILLE,
  MIN_COMPARE_THRESHOLD_PERMILLE,
  type MeshCompare,
} from "@shared/types";
import { meshCompareEquals } from "@shared/compare";
import { useDisplayStore } from "../../store/display";
import { useObjectsStore } from "../../store/objects";
import {
  COMPARE_BASE_LABEL,
  COMPARE_BASE_VISIBLE_LABEL,
  COMPARE_HEADING,
  COMPARE_LEGEND,
  COMPARE_NONE_LABEL,
  COMPARE_TARGET_LABEL,
  COMPARE_THRESHOLD_LABEL,
  compareOptionLabel,
  thresholdPermilleText,
} from "./objects-labels";

export function CompareControls({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement | null {
  const objects = useObjectsStore((state) => state.objects);
  const meshCompare = useDisplayStore((state) => state.meshCompare);
  const setMeshCompare = useDisplayStore((state) => state.setMeshCompare);

  if (objects.length < 2) return null;

  const objectIds = new Set(objects.map((version) => version.id));
  const selectedValue = (id: string | null): string => (id !== null && objectIds.has(id) ? id : "");

  function update(patch: Partial<MeshCompare>): void {
    const next = { ...meshCompare, ...patch };
    if (meshCompareEquals(next, meshCompare)) return;
    setMeshCompare(next);
    send({ type: "mesh:compare", compare: next });
  }

  return (
    <div className="compare" role="group" aria-label={COMPARE_HEADING}>
      <h3 className="compare__heading">{COMPARE_HEADING}</h3>
      <label className="compare__field">
        <span className="compare__label">{COMPARE_BASE_LABEL}</span>
        <select
          className="input compare__select"
          value={selectedValue(meshCompare.baseId)}
          onChange={(event) => update({ baseId: event.target.value || null })}
        >
          <option value="">{COMPARE_NONE_LABEL}</option>
          {objects.map((version) => (
            <option key={version.id} value={version.id}>{compareOptionLabel(version)}</option>
          ))}
        </select>
      </label>
      <label className="compare__field">
        <span className="compare__label">{COMPARE_TARGET_LABEL}</span>
        <select
          className="input compare__select"
          value={selectedValue(meshCompare.targetId)}
          onChange={(event) => update({ targetId: event.target.value || null })}
        >
          <option value="">{COMPARE_NONE_LABEL}</option>
          {objects.map((version) => (
            <option key={version.id} value={version.id}>{compareOptionLabel(version)}</option>
          ))}
        </select>
      </label>
      <div className="compare__threshold">
        <div className="compare__threshold-head">
          <label className="compare__label" htmlFor="compare-threshold">{COMPARE_THRESHOLD_LABEL}</label>
          <output className="compare__value" htmlFor="compare-threshold">
            {thresholdPermilleText(meshCompare.thresholdPermille)}
          </output>
        </div>
        <input
          id="compare-threshold"
          className="compare__range"
          type="range"
          min={MIN_COMPARE_THRESHOLD_PERMILLE}
          max={MAX_COMPARE_THRESHOLD_PERMILLE}
          step="1"
          value={meshCompare.thresholdPermille}
          onChange={(event) => update({ thresholdPermille: Number(event.target.value) })}
        />
      </div>
      <label className="compare__check">
        <input
          type="checkbox"
          className="compare__checkbox"
          checked={meshCompare.baseVisible === true}
          onChange={(event) => update({ baseVisible: event.target.checked })}
        />
        <span className="compare__label">{COMPARE_BASE_VISIBLE_LABEL}</span>
      </label>
      <p className="compare__legend">{COMPARE_LEGEND}</p>
    </div>
  );
}
