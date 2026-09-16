import { useId, type ReactElement } from "react";
import { useViewSettingsStore } from "../../store/view-settings";
import {
  DEFAULT_VIEW_SETTINGS,
  HUD_VIEW_SETTING_GROUP_ORDER,
  VIEW_SETTING_SPECS,
  viewSettingKeysInGroup,
  viewSettingKeysOnSurface,
} from "./view-settings";
import {
  RESET_VIEW_SETTINGS_LABEL,
  VIEW_SETTING_GROUP_LABELS,
  VIEW_SETTING_LABELS,
  VIEW_SETTINGS_HELP,
  formatViewSetting,
} from "./view-settings-labels";
import "./view-settings-menu.css";

/** HUD の「表示」メニューの中身。 */
export function ViewSettingsMenu(): ReactElement {
  const baseId = useId();
  const settings = useViewSettingsStore((state) => state.settings);
  const hudKeys = viewSettingKeysOnSurface("hud");
  const changedCount = hudKeys.filter((key) => settings[key] !== DEFAULT_VIEW_SETTINGS[key]).length;

  return (
    <div className="view-settings-menu">
      <p className="view-settings-menu__help">{VIEW_SETTINGS_HELP}</p>
      {HUD_VIEW_SETTING_GROUP_ORDER.map((group) => (
        <div
          className="hud-menu__section view-settings-menu__group"
          role="group"
          aria-label={VIEW_SETTING_GROUP_LABELS[group]}
          key={group}
        >
          <p className="view-settings-menu__group-name">{VIEW_SETTING_GROUP_LABELS[group]}</p>
          {viewSettingKeysInGroup(group).map((key) => {
            const spec = VIEW_SETTING_SPECS[key];
            const value = settings[key];
            const changed = value !== DEFAULT_VIEW_SETTINGS[key];
            const id = `${baseId}-${key}`;
            return (
              <div className="view-setting-hud-row" data-changed={changed} key={key}>
                <div className="view-setting-hud-row__head">
                  <label className="view-setting-hud-row__name" htmlFor={id}>{VIEW_SETTING_LABELS[key]}</label>
                  <output className="view-setting-hud-row__value" htmlFor={id}>{formatViewSetting(key, value)}</output>
                </div>
                <input
                  id={id}
                  className="view-setting-hud-row__range"
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={value}
                  onChange={(event) => useViewSettingsStore.getState().setSetting(key, Number(event.currentTarget.value))}
                  onInput={(event) => useViewSettingsStore.getState().setSetting(key, Number(event.currentTarget.value))}
                />
              </div>
            );
          })}
        </div>
      ))}
      <div className="hud-menu__section">
        <button
          className="btn hud-menu__item view-settings-menu__reset"
          type="button"
          disabled={changedCount === 0}
          onClick={() => hudKeys.forEach((key) => useViewSettingsStore.getState().resetSetting(key))}
        >
          {RESET_VIEW_SETTINGS_LABEL}
        </button>
      </div>
    </div>
  );
}
