import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { HUD_MENU_LABELS, type HudMenuId } from "./hud-menu";

export interface HudMenuProps {
  id: HudMenuId;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function HudMenu({ id, open, onToggle, onClose, children }: HudMenuProps): ReactElement {
  const panelId = `hud-menu-${id}`;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Escape" || !open) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  return (
    <div className="hud-menu" onKeyDown={handleKeyDown}>
      <button
        className="btn hud-menu__toggle"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {HUD_MENU_LABELS[id]}
      </button>
      {open && (
        <div id={panelId} className="hud-menu__panel" role="group" aria-label={HUD_MENU_LABELS[id]}>
          {children}
        </div>
      )}
    </div>
  );
}
