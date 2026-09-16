/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GIZMO_SIZE_PX } from "../src/features/viewer/light-gizmo";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), "web", "src");
const lightGizmoCssText = readFileSync(join(srcDir, "features/viewer/light-gizmo.css"), "utf8");
const lightGizmoText = readFileSync(join(srcDir, "features/viewer/LightGizmo.tsx"), "utf8");
const viewerCssText = readFileSync(join(srcDir, "features/viewer/viewer.css"), "utf8");

/** text 中で selector にちょうど一致するルールのブロック本文。無ければ null。 */
function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

describe("light gizmo styles", () => {
  it("removes the frame and surface styling from the light gizmo", () => {
    const body = ruleBody(lightGizmoCssText, ".light-gizmo");

    expect(body).not.toBeNull();
    expect(body).not.toMatch(/(?:^|;)\s*(?:border|background|box-shadow|overflow)\s*:/);
  });

  it("keeps the light gizmo positioned at its fixed size", () => {
    const body = ruleBody(lightGizmoCssText, ".light-gizmo");

    expect(body).toMatch(/(?:^|;)\s*position\s*:/);
    expect(body).toMatch(/(?:^|;)\s*right\s*:/);
    expect(body).toMatch(/(?:^|;)\s*bottom\s*:/);
    expect(body).toMatch(/(?:^|;)\s*width\s*:/);
    expect(body).toMatch(/(?:^|;)\s*height\s*:/);
    expect(body).toContain(`width: ${GIZMO_SIZE_PX}px`);
    expect(body).toContain(`height: ${GIZMO_SIZE_PX}px`);
  });

  it("does not confuse light gizmo child selectors with the parent rule", () => {
    const body = ruleBody(lightGizmoCssText, ".light-gizmo");

    expect(body).not.toContain("cursor: ew-resize");
    expect(body).not.toContain("min-height: 0");
  });

  it("styles the light brightness slider with the theme accent", () => {
    const body = ruleBody(lightGizmoCssText, ".light-gizmo__brightness");

    expect(body).toContain("flex: 1 1 auto");
    expect(body).toContain("accent-color: var(--color-accent)");
    expect(body).toContain("cursor: pointer");
    expect(body).not.toContain("position: absolute");
  });

  it("lays the brightness slider out as a row between two icons", () => {
    const body = ruleBody(lightGizmoCssText, ".light-gizmo__brightness-row");

    expect(body).toContain("position: absolute");
    expect(body).toContain("bottom: calc(var(--space-3) * -1)");
    expect(body).toContain("width: 100%");
    expect(body).toContain("display: flex");
    expect(body).toContain("align-items: center");
    expect(body).toContain("gap: var(--space-1)");
  });

  it("sizes the brightness icons without letting them shrink", () => {
    const body = ruleBody(lightGizmoCssText, ".light-gizmo__brightness-icon");

    expect(body).toContain("flex: none");
    expect(body).toContain("width: 14px");
    expect(body).toContain("height: 14px");
    expect(body).toContain("color: var(--color-text-muted)");
  });

  it("moves the light gizmo rules out of viewer.css into their own sheet", () => {
    expect(viewerCssText).not.toContain(".light-gizmo");
    expect(lightGizmoText).toContain('import "./light-gizmo.css"');
  });
});
