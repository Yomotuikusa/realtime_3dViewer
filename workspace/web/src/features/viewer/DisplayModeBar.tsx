import type { ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { useDisplayStore } from "../../store/display";
import { MESH_DISPLAY_LABEL, MESH_DISPLAY_LABELS, MESH_DISPLAY_ORDER } from "./hud-labels";
import { MESH_DISPLAY_ICONS } from "./display-icons";

export function DisplayModeBar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const meshDisplay = useDisplayStore((state) => state.meshDisplay);
  const setMeshDisplay = useDisplayStore((state) => state.setMeshDisplay);

  function selectDisplay(mode: (typeof MESH_DISPLAY_ORDER)[number]): void {
    if (meshDisplay === mode) return;
    setMeshDisplay(mode);
    send({ type: "mesh:display", mode });
  }

  return (
    <div className="hud-display" role="group" aria-label={MESH_DISPLAY_LABEL}>
      {MESH_DISPLAY_ORDER.map((mode) => {
        const Icon = MESH_DISPLAY_ICONS[mode];
        return (
          <button
            key={mode}
            className="btn hud-display__btn"
            type="button"
            aria-pressed={meshDisplay === mode}
            aria-label={MESH_DISPLAY_LABELS[mode]}
            title={MESH_DISPLAY_LABELS[mode]}
            onClick={() => selectDisplay(mode)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
