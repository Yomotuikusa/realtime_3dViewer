import { Fragment, useState, type CSSProperties, type ReactElement } from "react";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { THEME_MODE_ORDER } from "./theme-mode";
import { swatchMarkColor } from "./theme-palette";
import { ColorPicker } from "./ColorPicker";
import {
  CHANGED_LABEL,
  colorPickerLabel,
  RESET_COLOR_LABEL,
  RESET_COLORS_LABEL,
  THEME_MODE_LABEL,
  THEME_MODE_LABELS,
  THEME_SETTINGS_HELP,
  VIEWER_COLOR_LABELS,
  VIEWER_COLORS_LABEL,
} from "./theme-labels";
import { VIEWER_COLOR_ORDER, type ViewerColorKey } from "./viewer-colors";
import "./theme.css";

/** Content for the display-color tab; the dialog shell belongs to the caller. */
export function ThemeSettings(): ReactElement {
  const state = useThemeStore();
  const [openKey, setOpenKey] = useState<ViewerColorKey | null>(null);
  const changedCount = Object.keys(state.colors).length;

  return (
    <div className="theme-settings">
      <p className="review-dialog__help">{THEME_SETTINGS_HELP}</p>

      <div className="theme-modes" role="group" aria-label={THEME_MODE_LABEL}>
        {THEME_MODE_ORDER.map((mode) => (
          <button
            className="btn btn--quiet"
            type="button"
            aria-pressed={mode === state.mode}
            onClick={() => useThemeStore.getState().setMode(mode)}
            key={mode}
          >
            {THEME_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div className="theme-colors" role="group" aria-label={VIEWER_COLORS_LABEL}>
        {VIEWER_COLOR_ORDER.map((key) => {
          const hex = selectViewerColor(key)(state);
          const changed = Object.hasOwn(state.colors, key);
          const colorName = VIEWER_COLOR_LABELS[key];
          const pickerLabel = colorPickerLabel(colorName);
          return (
            <Fragment key={key}>
              <div className="theme-color-row" data-changed={changed ? "true" : undefined}>
                <span className="theme-color-row__name">
                  {colorName}
                  {changed && (
                    <span className="theme-color-row__changed" role="img" aria-label={CHANGED_LABEL} />
                  )}
                </span>
                <button
                  className="theme-swatch"
                  type="button"
                  aria-label={pickerLabel}
                  aria-expanded={openKey === key}
                  style={{ "--swatch-color": hex, "--swatch-mark": swatchMarkColor(hex) } as CSSProperties}
                  onClick={() => setOpenKey(openKey === key ? null : key)}
                />
                <span className="theme-color-row__hex">{hex}</span>
                <button
                  className="btn btn--quiet"
                  type="button"
                  disabled={!changed}
                  onClick={() => useThemeStore.getState().resetColor(key)}
                >
                  {RESET_COLOR_LABEL}
                </button>
              </div>
              {openKey === key && (
                <ColorPicker
                  value={hex}
                  onChange={(nextHex) => useThemeStore.getState().setColor(key, nextHex)}
                  label={pickerLabel}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="theme-settings__footer">
        <button
          className="btn btn--quiet"
          type="button"
          disabled={changedCount === 0}
          onClick={() => useThemeStore.getState().resetColors()}
        >
          {RESET_COLORS_LABEL}
        </button>
      </div>
    </div>
  );
}
