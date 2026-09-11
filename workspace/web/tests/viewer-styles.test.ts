/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GIZMO_SIZE_PX } from "../src/features/viewer/light-gizmo";

const srcUrl = new URL("../src", import.meta.url);
const urlPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), srcUrl.pathname.slice(1));
const srcDir = existsSync(urlPath) ? urlPath : join(process.cwd(), "web", "src");
const tokensText = readFileSync(join(srcDir, "styles/tokens.css"), "utf8");
const viewerCssText = readFileSync(join(srcDir, "features/viewer/viewer.css"), "utf8");
const cameraMenuText = readFileSync(join(srcDir, "features/viewer/CameraMenu.tsx"), "utf8");
const hudMenuText = readFileSync(join(srcDir, "features/viewer/HudMenu.tsx"), "utf8");
const viewerHudText = readFileSync(join(srcDir, "features/viewer/ViewerHud.tsx"), "utf8");

/** text 中で selector にちょうど一致するルールのブロック本文。無ければ null。 */
function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

function rootBody(text: string): string {
  return text.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
}

describe("viewer styles", () => {
  it("defines the translucent surface token", () => {
    const root = rootBody(tokensText);

    expect(root).toMatch(
      /--color-surface-translucent\s*:\s*color-mix\([^;]*var\(--color-surface\)/,
    );
  });

  it("defines a positive pixel width for the follow frame", () => {
    const width = rootBody(tokensText).match(/--follow-frame-width\s*:\s*([\d.]+)px/)?.[1];

    expect(width).toBeDefined();
    expect(Number(width)).toBeGreaterThan(0);
  });

  it("renders the follow frame through a contents wrapper", () => {
    expect(ruleBody(viewerCssText, ".hud-following")).toContain("display: contents");
  });

  it("draws a non-interactive user-colored frame around the viewer", () => {
    const body = ruleBody(viewerCssText, ".hud-follow-frame");

    expect(body).toContain("position: absolute");
    expect(body).toContain("inset: 0");
    expect(body).toContain("pointer-events: none");
    expect(body).toMatch(/border\s*:[^;]*var\(--follow-frame-width\)/);
    expect(body).toContain("var(--user-color");
  });

  it("docks the follow badge to the frame's top edge", () => {
    const body = ruleBody(viewerCssText, ".hud-follow");

    expect(body).toContain("top: var(--follow-frame-width)");
    expect(body).toContain("background: var(--color-surface)");
    expect(body).not.toContain("--color-surface-translucent");
    expect(body).toContain("font-size: var(--text-lg)");
    expect(body).toContain("padding: var(--space-2) var(--space-3)");
    expect(body).toContain("translate: -50% 0");
    expect(body).not.toContain("border-left");
  });

  it("matches the follow badge selector without matching its child blocks", () => {
    const body = ruleBody(viewerCssText, ".hud-follow");

    expect(body).not.toContain("hud-follow__bar");
    expect(body).not.toContain("hud-follow__unfollow");
    expect(body).not.toContain("hud-follow-frame");
    expect(body).not.toContain("hud-following");
  });

  it("uses a vertical participant-color bar in the follow badge", () => {
    const body = ruleBody(viewerCssText, ".hud-follow__bar");

    expect(body).toContain("width: 4px");
    expect(body).toContain("align-self: stretch");
    expect(body).toContain("var(--user-color");
    expect(body).not.toContain("border-radius: 50%");
  });

  it("styles the follow badge button like a camera menu item", () => {
    const body = ruleBody(viewerCssText, ".hud-follow__unfollow");

    expect(body).toContain("box-shadow: var(--shadow-control)");
    expect(viewerHudText).toContain('className="btn hud-follow__unfollow"');
    expect(viewerHudText).not.toContain("btn--quiet");
  });

  it("renders the follow frame before the follow badge and provides the color once", () => {
    const frameIndex = viewerHudText.indexOf('className="hud-follow-frame"');
    const badgeIndex = viewerHudText.indexOf('className="hud-follow"');

    expect(viewerHudText).toContain('className="hud-following"');
    expect(frameIndex).toBeGreaterThan(viewerHudText.indexOf('className="hud-following"'));
    expect(badgeIndex).toBeGreaterThan(frameIndex);
    expect(viewerHudText.match(/"--user-color"/g)).toHaveLength(1);
    expect(viewerHudText).toContain("followingUserId !== null &&");
    expect(viewerHudText).not.toContain("hud-follow__dot");
  });

  it("sets the docked camera menu width", () => {
    expect(ruleBody(viewerCssText, ".hud-menu")).toContain("width: 13.5rem");
  });

  it("makes the camera toggle fill the translucent menu width", () => {
    const body = ruleBody(viewerCssText, ".hud-menu__toggle");

    expect(body).toContain("width: 100%");
    expect(body).toContain("background: var(--color-surface-translucent)");
  });

  it("joins an expanded camera toggle to its panel", () => {
    const body = ruleBody(viewerCssText, '.hud-menu__toggle[aria-expanded="true"]');

    expect(body).not.toContain("--color-accent");
    expect(body).toContain("border-bottom-left-radius: 0");
    expect(body).toContain("border-bottom-right-radius: 0");
  });

  it("docks the translucent camera panel below its toggle", () => {
    const body = ruleBody(viewerCssText, ".hud-menu__panel");

    expect(body).toContain("top: 100%");
    expect(body).toContain("left: 0");
    expect(body).toContain("right: 0");
    expect(body).toContain("border-top: 0");
    expect(body).toContain("background: var(--color-surface-translucent)");
    expect(body).not.toContain("min-width");
  });

  it("starts ViewerHud with the camera menu open without document pointerdown handling", () => {
    expect(viewerHudText).toContain("useState<HudMenuId | null>(HUD_MENU_INITIAL)");
    expect(viewerHudText).not.toContain("menuAfterPointerDown");
    expect(viewerHudText).not.toContain("addEventListener");
  });

  it("uses a chevron in the HUD menu toggle", () => {
    expect(hudMenuText).toContain("hud-menu__chevron");
  });

  it("keeps camera controls independent from menu closing", () => {
    expect(cameraMenuText).not.toContain("onClose");
  });

  it("defines a control shadow with positive x and y offsets", () => {
    const shadow = rootBody(tokensText).match(/--shadow-control\s*:\s*([^;]+)/)?.[1] ?? "";
    const offsets = shadow.match(/^\s*(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\b/);

    expect(offsets).not.toBeNull();
    expect(Number(offsets?.[1])).toBeGreaterThan(0);
    expect(Number(offsets?.[2])).toBeGreaterThan(0);
  });

  it("adds the control shadow to camera menu items", () => {
    expect(ruleBody(viewerCssText, ".hud-menu__item")).toContain("box-shadow: var(--shadow-control)");
  });

  it("keeps all camera menu item buttons quiet-free", () => {
    const classes = [...cameraMenuText.matchAll(/className="([^"]*hud-menu__item[^"]*)"/g)].map(
      (match) => match[1] ?? "",
    );

    expect(classes).toHaveLength(3);
    expect(classes.every((className) => !className.includes("btn--quiet"))).toBe(true);
  });

  it("removes the frame and surface styling from the light gizmo", () => {
    const body = ruleBody(viewerCssText, ".light-gizmo");

    expect(body).not.toBeNull();
    expect(body).not.toMatch(/(?:^|;)\s*(?:border|background|box-shadow|overflow)\s*:/);
  });

  it("keeps the light gizmo positioned at its fixed size", () => {
    const body = ruleBody(viewerCssText, ".light-gizmo");

    expect(body).toMatch(/(?:^|;)\s*position\s*:/);
    expect(body).toMatch(/(?:^|;)\s*right\s*:/);
    expect(body).toMatch(/(?:^|;)\s*bottom\s*:/);
    expect(body).toMatch(/(?:^|;)\s*width\s*:/);
    expect(body).toMatch(/(?:^|;)\s*height\s*:/);
    expect(body).toContain(`width: ${GIZMO_SIZE_PX}px`);
    expect(body).toContain(`height: ${GIZMO_SIZE_PX}px`);
  });

  it("leaves enough room for the light gizmo beside the hint", () => {
    const body = ruleBody(viewerCssText, ".hud-hint");

    expect(body).toContain(`right: calc(${GIZMO_SIZE_PX}px + var(--space-3) * 2)`);
  });

  it("does not confuse light gizmo child selectors with the parent rule", () => {
    const body = ruleBody(viewerCssText, ".light-gizmo");

    expect(body).not.toContain("cursor: ew-resize");
    expect(body).not.toContain("min-height: 0");
  });
});
