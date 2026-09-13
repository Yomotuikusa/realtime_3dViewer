import { describe, expect, it } from "vitest";
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  isDarkColor,
  relativeLuminance,
  rgbToHex,
} from "../src/features/theme/color-convert";

describe("color conversion", () => {
  it("converts valid, short, and invalid hexadecimal values to RGB", () => {
    expect(hexToRgb("#f97316")).toEqual({ r: 249, g: 115, b: 22 });
    expect(hexToRgb("#ABC")).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb("bad")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("rounds and clamps RGB components", () => {
    expect(rgbToHex({ r: 249, g: 115, b: 22 })).toBe("#f97316");
    expect(rgbToHex({ r: -5, g: 300, b: 12.6 })).toBe("#00ff0d");
  });

  it("converts primary and achromatic colors to HSV", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00ff00").h).toBe(120);
    expect(hexToHsv("#0000ff").h).toBe(240);
    expect(hexToHsv("#808080")).toEqual({ h: 0, s: 0, v: 128 / 255 });
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("bad")).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("normalizes hue and clamps HSV when converting to hex", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 390, s: 1, v: 1 })).toBe("#ff8000");
    expect(hsvToHex({ h: 0, s: -1, v: 2 })).toBe("#ffffff");
    for (const hex of ["#f97316", "#22d3ee", "#facc15", "#2563eb", "#000000", "#ffffff"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("calculates WCAG relative luminance and dark-color status", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
    expect(isDarkColor("#101828")).toBe(true);
    expect(isDarkColor("#f5f7fa")).toBe(false);
    expect(isDarkColor("#f97316")).toBe(false);
  });
});
