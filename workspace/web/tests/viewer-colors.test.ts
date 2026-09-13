import { describe, expect, it } from "vitest";
import { COMPARE_INSIDE_COLOR, COMPARE_OUTSIDE_COLOR } from "../src/features/compare/overlay";
import { JOINT_COLOR, JOINT_LINK_COLOR } from "../src/features/joint/joint-display";
import { SELECTED_JOINT_COLOR } from "../src/features/joint/joint-highlight";
import { SELECTION_COLOR } from "../src/features/outliner/selection-highlight";
import { TRAIL_CURRENT_COLOR, TRAIL_LINE_COLOR, TRAIL_POINT_COLOR } from "../src/features/trail/trail-overlay";
import { WIREFRAME_OVERLAY_COLOR } from "../src/features/viewer/mesh-display";
import {
  hexToNumber,
  normalizeHex,
  numberToHex,
  resolveViewerColor,
  resolveViewerColors,
  VIEWER_COLOR_DEFAULTS,
  VIEWER_COLOR_ORDER,
} from "../src/features/theme/viewer-colors";

describe("viewer colors", () => {
  it("has 11 ordered keys and valid light and dark defaults", () => {
    expect(VIEWER_COLOR_ORDER).toHaveLength(11);
    expect(new Set(VIEWER_COLOR_ORDER).size).toBe(11);
    expect(Object.keys(VIEWER_COLOR_DEFAULTS.light).sort()).toEqual([...VIEWER_COLOR_ORDER].sort());
    expect(Object.keys(VIEWER_COLOR_DEFAULTS.dark).sort()).toEqual([...VIEWER_COLOR_ORDER].sort());
    for (const colors of Object.values(VIEWER_COLOR_DEFAULTS)) {
      for (const color of Object.values(colors)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the light defaults in sync with current viewer constants", () => {
    const light = VIEWER_COLOR_DEFAULTS.light;
    expect(hexToNumber(light.selection)).toBe(SELECTION_COLOR);
    expect(hexToNumber(light.wireframe)).toBe(WIREFRAME_OVERLAY_COLOR);
    expect(hexToNumber(light.joint)).toBe(JOINT_COLOR);
    expect(hexToNumber(light.jointLink)).toBe(JOINT_LINK_COLOR);
    expect(hexToNumber(light.jointSelected)).toBe(SELECTED_JOINT_COLOR);
    expect(hexToNumber(light.trailLine)).toBe(TRAIL_LINE_COLOR);
    expect(hexToNumber(light.trailPoint)).toBe(TRAIL_POINT_COLOR);
    expect(hexToNumber(light.trailCurrent)).toBe(TRAIL_CURRENT_COLOR);
    expect(hexToNumber(light.compareOutside)).toBe(COMPARE_OUTSIDE_COLOR);
    expect(hexToNumber(light.compareInside)).toBe(COMPARE_INSIDE_COLOR);
    expect(light.background).toBe("#f5f7fa");
  });

  it("normalizes and converts hexadecimal colors", () => {
    expect(normalizeHex("#F97316")).toBe("#f97316");
    expect(normalizeHex("f97316")).toBe("#f97316");
    expect(normalizeHex("  #ABC  ")).toBe("#aabbcc");
    for (const value of ["#abcd", "#gggggg", "", "#"]) expect(normalizeHex(value)).toBeNull();
    expect(hexToNumber("#f97316")).toBe(0xf97316);
    expect(hexToNumber("#ABC")).toBe(0xaabbcc);
    expect(hexToNumber("not a color")).toBe(0x000000);
    expect(numberToHex(0xf97316)).toBe("#f97316");
    expect(numberToHex(0)).toBe("#000000");
    expect(numberToHex(0xffffff)).toBe("#ffffff");
    expect(numberToHex(-1)).toBe("#000000");
    expect(numberToHex(0x1000000)).toBe("#ffffff");
    expect(numberToHex(1.6)).toBe("#000002");
    expect(numberToHex(Number.NaN)).toBe("#000000");
  });

  it("resolves overrides without losing any keys", () => {
    expect(resolveViewerColor("dark", {}, "background")).toBe("#14171f");
    expect(resolveViewerColor("dark", { background: "#ff0000" }, "background")).toBe("#ff0000");
    const colors = resolveViewerColors("light", { selection: "#ff0000" });
    expect(Object.keys(colors)).toHaveLength(11);
    expect(colors.selection).toBe("#ff0000");
    expect(colors.background).toBe(VIEWER_COLOR_DEFAULTS.light.background);
  });
});
