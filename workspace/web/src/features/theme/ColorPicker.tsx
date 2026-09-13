import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { ColorWheel } from "./ColorWheel";
import { normalizeHex } from "./viewer-colors";
import {
  HEX_INPUT_LABEL,
  PALETTE_LABEL,
  WHEEL_LABEL,
} from "./theme-labels";
import { swatchMarkColor, THEME_PALETTE } from "./theme-palette";

export interface ColorPickerProps {
  /** 今の色。"#rrggbb" */
  value: string;
  /** 新しい "#rrggbb" を返す。正規化は呼び出し側(ストア)が行う。 */
  onChange: (hex: string) => void;
  /** 外枠に付ける aria-label。 */
  label: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps): ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleInput = (nextDraft: string): void => {
    setDraft(nextDraft);
    const normalized = normalizeHex(nextDraft);
    if (normalized !== null) onChange(normalized);
  };

  const handleBlur = (): void => {
    const normalized = normalizeHex(draft);
    setDraft(normalized ?? value);
  };

  return (
    <div className="theme-picker" role="group" aria-label={label}>
      <ColorWheel value={value} onChange={onChange} label={WHEEL_LABEL} />
      <div className="theme-palette" role="group" aria-label={PALETTE_LABEL}>
        {THEME_PALETTE.map((swatch) => (
          <button
            className="theme-palette__swatch"
            type="button"
            aria-label={swatch.name}
            aria-pressed={swatch.hex === value}
            style={{ "--swatch-color": swatch.hex, "--swatch-mark": swatchMarkColor(swatch.hex) } as CSSProperties}
            onClick={() => onChange(swatch.hex)}
            key={swatch.hex}
          />
        ))}
      </div>
      <input
        className="input theme-picker__hex"
        type="text"
        aria-label={HEX_INPUT_LABEL}
        value={draft}
        onChange={(event) => handleInput(event.currentTarget.value)}
        onBlur={handleBlur}
        maxLength={7}
      />
    </div>
  );
}
