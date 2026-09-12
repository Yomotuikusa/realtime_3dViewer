/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MESH_DISPLAY_ORDER } from "../src/features/viewer/hud-labels";
import {
  CUBE_ALL_EDGES,
  CUBE_FRONT_EDGES,
  CUBE_LEFT,
  CUBE_OUTLINE,
  CUBE_RIGHT,
  CUBE_TOP,
  CUBE_VIEW_BOX,
  MESH_DISPLAY_ICONS,
  SolidIcon,
  SolidWireframeIcon,
  WireframeIcon,
} from "../src/features/viewer/display-icons";

const srcUrl = new URL("../src", import.meta.url);
const urlPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), srcUrl.pathname.slice(1));
const srcDir = existsSync(urlPath) ? urlPath : join(process.cwd(), "web", "src");
const displayModeBarText = readFileSync(join(srcDir, "features/viewer/DisplayModeBar.tsx"), "utf8");
const viewerHudText = readFileSync(join(srcDir, "features/viewer/ViewerHud.tsx"), "utf8");

function iconProps(icon: ReturnType<typeof SolidIcon>): Record<string, unknown> {
  return icon.props as Record<string, unknown>;
}

describe("display mode icons", () => {
  it("defines the shared cube geometry", () => {
    expect(CUBE_VIEW_BOX).toBe("0 0 16 16");
    expect(CUBE_OUTLINE.endsWith("Z")).toBe(true);
    expect(CUBE_OUTLINE.match(/M/g)).toHaveLength(1);
    for (const path of [CUBE_TOP, CUBE_LEFT, CUBE_RIGHT]) {
      expect(path.endsWith("Z")).toBe(true);
    }
    expect(new Set([CUBE_TOP, CUBE_LEFT, CUBE_RIGHT]).size).toBe(3);
    expect(CUBE_FRONT_EDGES.match(/M/g)).toHaveLength(3);
    expect(CUBE_FRONT_EDGES).not.toContain("Z");
    expect(CUBE_ALL_EDGES.match(/M/g)).toHaveLength(3);
    expect(CUBE_ALL_EDGES).not.toContain("Z");
    expect(CUBE_ALL_EDGES).not.toBe(CUBE_FRONT_EDGES);
  });

  it("renders the solid icon without root paint or dimensions", () => {
    const element = SolidIcon();
    const props = iconProps(element);

    expect(element.type).toBe("svg");
    expect(props.viewBox).toBe(CUBE_VIEW_BOX);
    expect(props.className).toBe("hud-display__icon");
    expect(props["aria-hidden"]).toBe("true");
    expect(props.focusable).toBe("false");
    expect(props.stroke).toBeUndefined();
    expect(props.fill).toBeUndefined();
    expect(props.width).toBeUndefined();
    expect(props.height).toBeUndefined();
  });

  it("renders the wireframe icon with root stroke settings", () => {
    const props = iconProps(WireframeIcon());

    expect(props.fill).toBe("none");
    expect(props.stroke).toBe("currentColor");
    expect(props.strokeWidth).toBe("1");
  });

  it("renders the solid-wireframe icon with child paint settings", () => {
    const props = iconProps(SolidWireframeIcon());

    expect(props.fill).toBeUndefined();
    expect(props.stroke).toBeUndefined();
    expect(props.width).toBeUndefined();
    expect(props.height).toBeUndefined();
  });

  it("maps each mesh display mode to its icon component", () => {
    expect(Object.keys(MESH_DISPLAY_ICONS).sort()).toEqual([...MESH_DISPLAY_ORDER].sort());
    for (const mode of MESH_DISPLAY_ORDER) {
      expect(typeof MESH_DISPLAY_ICONS[mode]).toBe("function");
      expect(MESH_DISPLAY_ICONS[mode]().type).toBe("svg");
    }
    expect(MESH_DISPLAY_ICONS.solid).toBe(SolidIcon);
  });
});

describe("display mode bar source", () => {
  it("draws one quiet-free icon button map", () => {
    expect(displayModeBarText.match(/className="btn hud-display__btn"/g)).toHaveLength(1);
    expect(displayModeBarText).not.toContain("btn--quiet");
    expect(displayModeBarText).not.toContain("onClose");
    expect(displayModeBarText).toContain("aria-label={MESH_DISPLAY_LABEL}");
    expect(displayModeBarText).toContain("title={MESH_DISPLAY_LABELS[mode]}");
    expect(displayModeBarText).toContain('type: "mesh:display"');
    expect(displayModeBarText).not.toContain(">{MESH_DISPLAY_LABELS");
  });

  it("places the bar before the camera menu and removes the old display menu", () => {
    expect(viewerHudText).toContain("<DisplayModeBar send={send} />");
    expect(viewerHudText).not.toContain('id="display"');
    expect(viewerHudText).not.toContain("DisplayMenu");
    expect(existsSync(join(srcDir, "features/viewer/DisplayMenu.tsx"))).toBe(false);
  });
});
