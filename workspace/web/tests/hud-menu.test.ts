import { describe, expect, it } from "vitest";
import {
  HUD_MENU_LABELS,
  HUD_MENU_ORDER,
  menuAfterPointerDown,
  toggleHudMenu,
} from "../src/features/viewer/hud-menu";

describe("viewer HUD menus", () => {
  it("defines the menu order and labels", () => {
    expect(HUD_MENU_ORDER).toEqual(["camera"]);
    expect(HUD_MENU_LABELS).toEqual({ camera: "カメラ" });
  });

  it.each([
    [null, "camera", "camera"],
    ["camera", "camera", null],
  ] as const)("toggles %s with %s to %s", (open, clicked, expected) => {
    expect(toggleHudMenu(open, clicked)).toBe(expected);
  });

  it("keeps the menu open for a pointerdown inside its root", () => {
    const root = document.createElement("div");
    const inner = document.createElement("button");
    root.append(inner);

    expect(menuAfterPointerDown("camera", root, inner)).toBe("camera");
    expect(menuAfterPointerDown("camera", root, root)).toBe("camera");
  });

  it("closes for a pointerdown outside or an invalid target", () => {
    const root = document.createElement("div");
    const outside = document.createElement("div");

    expect(menuAfterPointerDown(null, root, outside)).toBeNull();
    expect(menuAfterPointerDown("camera", null, outside)).toBeNull();
    expect(menuAfterPointerDown("camera", root, null)).toBeNull();
    expect(menuAfterPointerDown("camera", root, {} as EventTarget)).toBeNull();
  });
});
