import { useId, type ReactElement } from "react";
import { useViewSettingsStore } from "../../store/view-settings";
import {
  DEFAULT_VIEW_SETTINGS,
  DIALOG_VIEW_SETTING_GROUP_ORDER,
  VIEW_SETTING_SPECS,
  viewSettingKeysInGroup,
  viewSettingKeysOnSurface,
} from "./view-settings";
import {
  RESET_VIEW_SETTING_LABEL,
  RESET_VIEW_SETTINGS_LABEL,
  VIEW_SETTING_GROUP_LABELS,
  VIEW_SETTING_LABELS,
  VIEW_SETTINGS_HELP,
} from "./view-settings-labels";
import { formatViewSetting } from "./view-settings-labels";
import "./view-settings.css";

export function ViewSettings(): ReactElement {
  const baseId = useId();
  const settings = useViewSettingsStore((state) => state.settings);
  const dialogKeys = viewSettingKeysOnSurface("dialog");
  const changedCount = dialogKeys.filter((key) => settings[key] !== DEFAULT_VIEW_SETTINGS[key]).length;

  return (
    <div className="view-settings">
      <p className="review-dialog__help">{VIEW_SETTINGS_HELP}</p>
      {DIALOG_VIEW_SETTING_GROUP_ORDER.map((group) => (
        <fieldset className="view-settings__group" key={group}>
          <legend>{VIEW_SETTING_GROUP_LABELS[group]}</legend>
          {viewSettingKeysInGroup(group).map((key) => {
            const spec = VIEW_SETTING_SPECS[key];
            const value = settings[key];
            const changed = value !== DEFAULT_VIEW_SETTINGS[key];
            const id = `${baseId}-${key}`;
            return (
              <div className="view-setting-row" data-changed={changed} key={key}>
                <label className="view-setting-row__name" htmlFor={id}>{VIEW_SETTING_LABELS[key]}</label>
                <input
                  id={id}
                  className="view-setting-row__range"
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={value}
                  onChange={(event) => useViewSettingsStore.getState().setSetting(key, Number(event.currentTarget.value))}
                  onInput={(event) => useViewSettingsStore.getState().setSetting(key, Number(event.currentTarget.value))}
                />
                <output className="view-setting-row__value" htmlFor={id}>{formatViewSetting(key, value)}</output>
                <button
                  className="btn btn--quiet"
                  type="button"
                  disabled={!changed}
                  onClick={() => useViewSettingsStore.getState().resetSetting(key)}
                >
                  {RESET_VIEW_SETTING_LABEL}
                </button>
              </div>
            );
          })}
        </fieldset>
      ))}
      <div className="view-settings__footer">
        <button
          className="btn btn--quiet"
          type="button"
          disabled={changedCount === 0}
          onClick={() => dialogKeys.forEach((key) => useViewSettingsStore.getState().resetSetting(key))}
        >
          {RESET_VIEW_SETTINGS_LABEL}
        </button>
      </div>
    </div>
  );
}
