/// <reference types="node" />

import { Children, type ReactElement, type ReactNode } from "react";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JOINT_DOT_RADIUS,
  JOINT_LINK_PATH,
  JOINT_POINTS,
  JOINT_VIEW_BOX,
  JOINT_XRAY_SURFACE,
  JointIcon,
  JointXrayIcon,
} from "../src/features/joint/joint-icons";
import {
  JOINT_DISPLAY_LABEL,
  JOINT_VISIBLE_LABEL,
  JOINT_XRAY_LABEL,
} from "../src/features/joint/joint-labels";

const srcUrl = new URL("../src", import.meta.url);
const urlPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), srcUrl.pathname.slice(1));
const srcDir = existsSync(urlPath) ? urlPath : join(process.cwd(), "web", "src");
const jointDir = join(srcDir, "features/joint");
const jointDisplayBarText = readFileSync(join(jointDir, "JointDisplayBar.tsx"), "utf8");
const viewerHudText = readFileSync(join(srcDir, "features/viewer/ViewerHud.tsx"), "utf8");

function iconProps(icon: ReactElement): Record<string, unknown> {
  return icon.props as Record<string, unknown>;
}

function childElements(icon: ReactElement): ReactElement[] {
  const children = iconProps(icon).children;
  return Children.toArray(children as ReactNode).filter(
    (child): child is ReactElement => typeof child === "object" && child !== null,
  );
}

function expectJointRoot(icon: ReactElement): void {
  const props = iconProps(icon);

  expect(icon.type).toBe("svg");
  expect(props.viewBox).toBe(JOINT_VIEW_BOX);
  expect(props.className).toBe("hud-display__icon");
  expect(props["aria-hidden"]).toBe("true");
  expect(props.focusable).toBe("false");
  expect(props.fill).toBe("none");
  expect(props.stroke).toBe("currentColor");
  expect(props.strokeWidth).toBe("1");
  expect(props.width).toBeUndefined();
  expect(props.height).toBeUndefined();
}

describe("joint display icons", () => {
  it("defines the joint geometry", () => {
    expect(JOINT_VIEW_BOX).toBe("0 0 16 16");
    expect(JOINT_POINTS).toHaveLength(3);
    for (const point of JOINT_POINTS) {
      expect(point).toHaveLength(2);
      expect(point.every((value) => typeof value === "number" && value >= 0 && value <= 16)).toBe(true);
    }
    expect(JOINT_LINK_PATH.match(/M/g)).toHaveLength(1);
    expect(JOINT_LINK_PATH).not.toContain("Z");
    for (const [cx, cy] of JOINT_POINTS) {
      expect(JOINT_LINK_PATH).toContain(String(cx));
      expect(JOINT_LINK_PATH).toContain(String(cy));
    }
    expect(JOINT_XRAY_SURFACE).toMatch(/Z$/);
  });

  it("renders the joint icon with one link and one dot per point", () => {
    expectJointRoot(JointIcon());

    const children = childElements(JointIcon());
    expect(children.filter((child) => iconProps(child).d === JOINT_LINK_PATH)).toHaveLength(1);
    const circles = children.filter((child) => child.type === "circle");
    expect(circles).toHaveLength(JOINT_POINTS.length);
    circles.forEach((circle, index) => {
      const props = iconProps(circle);
      const [cx, cy] = JOINT_POINTS[index] ?? [];
      expect(props.fill).toBe("currentColor");
      expect(props.stroke).toBe("none");
      expect(props.r).toBe(JOINT_DOT_RADIUS);
      expect(props.cx).toBe(cx);
      expect(props.cy).toBe(cy);
    });
  });

  it("appends the translucent surface to the x-ray icon", () => {
    const icon = JointXrayIcon();
    expectJointRoot(icon);

    const children = childElements(icon);
    expect(children).toHaveLength(JOINT_POINTS.length + 2);
    const surface = children.at(-1);
    expect(surface).toBeDefined();
    const surfaceProps = iconProps(surface as ReactElement);
    expect(surfaceProps.d).toBe(JOINT_XRAY_SURFACE);
    expect(surfaceProps.fill).toBe("currentColor");
    expect(surfaceProps.fillOpacity).toBe(0.25);
    expect(surfaceProps.stroke).toBe("none");
  });
});

describe("joint display bar source", () => {
  it("renders two icon buttons with the joint display controls", () => {
    expect(jointDisplayBarText.match(/className="btn hud-display__btn"/g)).toHaveLength(2);
    expect(jointDisplayBarText).toContain('className="hud-display"');
    expect(jointDisplayBarText).toContain('role="group"');
    expect(jointDisplayBarText).toContain("aria-label={JOINT_DISPLAY_LABEL}");
    expect(jointDisplayBarText).toContain('type: "joint:display"');
    expect(jointDisplayBarText).toContain("jointDisplayEquals(");
    expect(jointDisplayBarText).toContain("disabled={!jointDisplay.visible}");
    expect(jointDisplayBarText.match(/<JointIcon \/>/g)).toHaveLength(1);
    expect(jointDisplayBarText.match(/<JointXrayIcon \/>/g)).toHaveLength(1);
    expect(jointDisplayBarText).toContain("type=\"button\"");
    expect(jointDisplayBarText).not.toContain("btn--quiet");
    expect(jointDisplayBarText).not.toContain("onClose");
    expect(jointDisplayBarText).not.toContain("MESH_DISPLAY");
    expect(jointDisplayBarText).not.toContain(">{JOINT_");
    expect(jointDisplayBarText).toContain('from "@shared/joint"');
  });

  it("defines non-empty Japanese labels", () => {
    for (const label of [JOINT_DISPLAY_LABEL, JOINT_VISIBLE_LABEL, JOINT_XRAY_LABEL]) {
      expect(label.trim()).not.toBe("");
      expect(label).toMatch(/[ぁ-んァ-ン一-龯]/);
    }
  });

  it("places the joint bar after the mesh bar in ViewerHud", () => {
    const displayIndex = viewerHudText.indexOf("<DisplayModeBar send={send} />");
    const jointIndex = viewerHudText.indexOf("<JointDisplayBar send={send} />");
    const hudMenusIndex = viewerHudText.indexOf('<div className="hud-menus">');
    const hudMenusClose = viewerHudText.indexOf("</div>", jointIndex);

    expect(viewerHudText.match(/<JointDisplayBar send={send} \/>/g)).toHaveLength(1);
    expect(displayIndex).toBeGreaterThan(hudMenusIndex);
    expect(jointIndex).toBeGreaterThan(displayIndex);
    expect(jointIndex).toBeLessThan(hudMenusClose);
    expect(viewerHudText).not.toContain("useDisplayStore");
  });
});
