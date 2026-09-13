import { describe, expect, it } from "vitest";
import { THEME_MODE_ORDER } from "../src/features/theme/theme-mode";
import {
  CHANGED_LABEL,
  colorPickerLabel,
  HEX_INPUT_LABEL,
  PALETTE_LABEL,
  RESET_COLOR_LABEL,
  RESET_COLORS_LABEL,
  THEME_MODE_LABEL,
  THEME_MODE_LABELS,
  THEME_SETTINGS_HELP,
  THEME_SETTINGS_TITLE,
  VIEWER_COLOR_LABELS,
  VIEWER_COLORS_LABEL,
  WHEEL_LABEL,
} from "../src/features/theme/theme-labels";
import { VIEWER_COLOR_ORDER } from "../src/features/theme/viewer-colors";

describe("theme labels", () => {
  it("covers every theme mode and viewer color exactly once", () => {
    expect(Object.keys(THEME_MODE_LABELS)).toEqual(THEME_MODE_ORDER);
    expect(Object.keys(VIEWER_COLOR_LABELS)).toEqual(VIEWER_COLOR_ORDER);
    expect(new Set(Object.values(THEME_MODE_LABELS)).size).toBe(THEME_MODE_ORDER.length);
    expect(new Set(Object.values(VIEWER_COLOR_LABELS)).size).toBe(VIEWER_COLOR_ORDER.length);
    expect(Object.values(THEME_MODE_LABELS).every((label) => label.length > 0)).toBe(true);
    expect(Object.values(VIEWER_COLOR_LABELS).every((label) => label.length > 0)).toBe(true);
  });

  it("provides Japanese accessible labels and the local-only help", () => {
    const labels = [
      THEME_SETTINGS_TITLE, THEME_SETTINGS_HELP, THEME_MODE_LABEL, VIEWER_COLORS_LABEL,
      PALETTE_LABEL, WHEEL_LABEL, HEX_INPUT_LABEL, RESET_COLORS_LABEL, RESET_COLOR_LABEL, CHANGED_LABEL,
    ];
    for (const label of labels) expect(label).toMatch(/[一-龯ぁ-んァ-ヶ]/);
    expect(THEME_SETTINGS_HELP).toContain("この端末");
  });

  it("builds a color picker label without depending on UI state", () => {
    expect(colorPickerLabel("背景")).toBe("背景の色を選ぶ");
    expect(colorPickerLabel("選択したオブジェクト")).toBe("選択したオブジェクトの色を選ぶ");
  });
});
