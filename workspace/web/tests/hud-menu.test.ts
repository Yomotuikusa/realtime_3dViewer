import { describe, expect, it } from "vitest";
import {
  HUD_MENU_INITIAL,
  HUD_MENU_LABELS,
  HUD_MENU_ORDER,
  toggleHudMenu,
} from "../src/features/viewer/hud-menu";

describe("viewer HUD menus", () => {
  it("defines the menu order and labels", () => {
    expect(HUD_MENU_ORDER).toEqual(["playback", "camera"]);
    expect(HUD_MENU_LABELS).toEqual({ playback: "アニメーション", camera: "カメラ" });
  });

  it("opens the camera menu initially", () => {
    expect(HUD_MENU_INITIAL).toBe("camera");
  });

  it.each([
    [null, "camera", "camera"],
    ["camera", "camera", null],
    ["camera", "playback", "playback"],
    ["playback", "playback", null],
  ] as const)("toggles %s with %s to %s", (open, clicked, expected) => {
    expect(toggleHudMenu(open, clicked)).toBe(expected);
  });

});
