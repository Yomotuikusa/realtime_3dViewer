import { describe, expect, it } from "vitest";
import {
  SWATCH_MARK_DARK,
  SWATCH_MARK_LIGHT,
  THEME_PALETTE,
  THEME_PALETTE_COLUMNS,
  swatchMarkColor,
} from "../src/features/theme/theme-palette";

describe("theme palette", () => {
  it("contains the fixed 9 by 3 palette in display order", () => {
    expect(THEME_PALETTE).toHaveLength(27);
    expect(THEME_PALETTE.length % THEME_PALETTE_COLUMNS).toBe(0);
    expect(THEME_PALETTE_COLUMNS).toBe(9);
    expect(THEME_PALETTE.map(({ hex }) => hex)).toEqual([
      "#ffffff", "#d0d5dd", "#fca5a5", "#fdba74", "#fde68a", "#86efac", "#67e8f9", "#93c5fd", "#d8b4fe",
      "#98a2b3", "#667085", "#dc2626", "#f97316", "#facc15", "#16a34a", "#22d3ee", "#2563eb", "#9333ea",
      "#101828", "#000000", "#7f1d1d", "#9a3412", "#a16207", "#14532d", "#0e7490", "#1e3a8a", "#581c87",
    ]);
  });

  it("uses unique lower-case hex values and Japanese names", () => {
    expect(new Set(THEME_PALETTE.map(({ hex }) => hex)).size).toBe(THEME_PALETTE.length);
    expect(new Set(THEME_PALETTE.map(({ name }) => name)).size).toBe(THEME_PALETTE.length);
    for (const swatch of THEME_PALETTE) {
      expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(swatch.name).toMatch(/[一-龯ぁ-んァ-ヶ]/);
    }
  });

  it("chooses a contrasting mark color", () => {
    expect(swatchMarkColor("#000000")).toBe(SWATCH_MARK_LIGHT);
    expect(swatchMarkColor("#ffffff")).toBe(SWATCH_MARK_DARK);
  });
});
