import { useId, useState, type ReactElement } from "react";
import { ShortcutSettings } from "../features/shortcuts/ShortcutSettings";
import { SETTINGS_TITLE } from "../features/shortcuts/shortcut-labels";
import { ThemeSettings } from "../features/theme/ThemeSettings";
import { THEME_SETTINGS_TITLE } from "../features/theme/theme-labels";
import { ViewSettings } from "../features/view-settings/ViewSettings";
import { VIEW_SETTINGS_TITLE } from "../features/view-settings/view-settings-labels";
import {
  CLOSE_LABEL,
  SETTINGS_DIALOG_TITLE,
  SETTINGS_TAB_ORDER,
  SETTINGS_TABS_LABEL,
  type SettingsTab,
} from "./review-labels";

export function SettingsDialog({ onClose }: { onClose: () => void }): ReactElement {
  const titleId = useId();
  const [active, setActive] = useState<SettingsTab>("shortcuts");

  return (
    <div className="review-backdrop">
      <div className="review-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{SETTINGS_DIALOG_TITLE}</h2>
        <div className="settings-tabs" role="group" aria-label={SETTINGS_TABS_LABEL}>
          {SETTINGS_TAB_ORDER.map((tab) => (
            <button
              key={tab}
              className="btn btn--quiet settings-tab"
              type="button"
              aria-pressed={tab === active}
              onClick={() => setActive(tab)}
            >
              {tab === "shortcuts" ? SETTINGS_TITLE : tab === "theme" ? THEME_SETTINGS_TITLE : VIEW_SETTINGS_TITLE}
            </button>
          ))}
        </div>
        {active === "shortcuts" ? <ShortcutSettings /> : active === "theme" ? <ThemeSettings /> : <ViewSettings />}
        <div className="settings-dialog__footer">
          <button className="btn btn--primary" type="button" onClick={onClose} autoFocus>{CLOSE_LABEL}</button>
        </div>
      </div>
    </div>
  );
}
