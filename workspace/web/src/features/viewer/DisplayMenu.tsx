import type { ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { useDisplayStore } from "../../store/display";
import { MESH_DISPLAY_LABEL, MESH_DISPLAY_LABELS, MESH_DISPLAY_ORDER } from "./hud-labels";

export function DisplayMenu({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const meshDisplay = useDisplayStore((state) => state.meshDisplay);
  const setMeshDisplay = useDisplayStore((state) => state.setMeshDisplay);

  function selectDisplay(mode: (typeof MESH_DISPLAY_ORDER)[number]): void {
    if (meshDisplay === mode) return;
    setMeshDisplay(mode);
    send({ type: "mesh:display", mode });
  }

  return (
    <div className="hud-menu__section hud-display" role="group" aria-label={MESH_DISPLAY_LABEL}>
      {MESH_DISPLAY_ORDER.map((mode) => (
        <button
          key={mode}
          className="btn hud-menu__item"
          type="button"
          aria-pressed={meshDisplay === mode}
          onClick={() => selectDisplay(mode)}
        >
          {MESH_DISPLAY_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
