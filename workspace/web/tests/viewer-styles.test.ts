/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const urlPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), srcUrl.pathname.slice(1));
const srcDir = existsSync(urlPath) ? urlPath : join(process.cwd(), "web", "src");
const tokensText = readFileSync(join(srcDir, "styles/tokens.css"), "utf8");
const viewerCssText = readFileSync(join(srcDir, "features/viewer/viewer.css"), "utf8");
const cameraMenuText = readFileSync(join(srcDir, "features/viewer/CameraMenu.tsx"), "utf8");

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
  });

  it("does not confuse light gizmo child selectors with the parent rule", () => {
    const body = ruleBody(viewerCssText, ".light-gizmo");

    expect(body).not.toContain("cursor: ew-resize");
    expect(body).not.toContain("min-height: 0");
  });
});
