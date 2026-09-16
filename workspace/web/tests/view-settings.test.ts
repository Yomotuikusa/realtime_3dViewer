import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW_SETTINGS,
  VIEW_SETTING_GROUP_ORDER,
  VIEW_SETTING_ORDER,
  VIEW_SETTING_SPECS,
  clampViewSetting,
  isViewSettingKey,
} from "../src/features/view-settings/view-settings";
import { BASE_LINE_WIDTH, OVERLAY_OPACITY_RATIO } from "../src/features/annotation/stroke-overlay";

describe("view setting definitions", () => {
  it("defines every setting in grouped display order", () => {
    expect(VIEW_SETTING_ORDER).toHaveLength(10);
    expect(new Set(VIEW_SETTING_ORDER).size).toBe(VIEW_SETTING_ORDER.length);
    expect(VIEW_SETTING_GROUP_ORDER).toEqual(["annotation", "viewer", "input", "joint", "outliner"]);
    expect(VIEW_SETTING_ORDER.map((key) => VIEW_SETTING_SPECS[key].group)).toEqual([
      "annotation", "annotation", "viewer", "viewer", "input", "input", "joint", "joint", "outliner", "outliner",
    ]);
    for (const key of VIEW_SETTING_ORDER) {
      expect(DEFAULT_VIEW_SETTINGS[key]).toBe(VIEW_SETTING_SPECS[key].defaultValue);
    }
    expect(DEFAULT_VIEW_SETTINGS.strokeWidth).toBe(BASE_LINE_WIDTH);
    expect(DEFAULT_VIEW_SETTINGS.overlayOpacityRatio).toBe(OVERLAY_OPACITY_RATIO);
  });

  it("recognizes keys and clamps only to the declared range", () => {
    expect(isViewSettingKey("strokeWidth")).toBe(true);
    expect(isViewSettingKey("foo")).toBe(false);
    expect(isViewSettingKey(1)).toBe(false);
    expect(clampViewSetting("strokeWidth", 100)).toBe(8);
    expect(clampViewSetting("strokeWidth", 0)).toBe(1);
    expect(clampViewSetting("strokeWidth", Number.NaN)).toBe(3);
    expect(clampViewSetting("strokeWidth", Number.POSITIVE_INFINITY)).toBe(3);
    expect(clampViewSetting("strokeWidth", 2.3)).toBe(2.3);
  });
});
