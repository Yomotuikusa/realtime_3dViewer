/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const tokensCssText = readFileSync(join(srcDir, "styles/tokens.css"), "utf8");
const reviewCssText = readFileSync(join(srcDir, "app/review.css"), "utf8");
const layoutCssText = readFileSync(join(srcDir, "features/layout/layout.css"), "utf8");
const objectsCssText = readFileSync(join(srcDir, "features/objects/objects.css"), "utf8");
const layersText = readFileSync(join(srcDir, "features/layout/layers.ts"), "utf8");
const commentPinsText = readFileSync(join(srcDir, "features/comments/CommentPins.tsx"), "utf8");
const commentCalloutText = readFileSync(join(srcDir, "features/comments/CommentCallout.tsx"), "utf8");
const remoteCamerasText = readFileSync(join(srcDir, "features/presence/RemoteCameras.tsx"), "utf8");

/** text 中で selector にちょうど一致するルールのブロック本文。無ければ null。 */
function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

function tokenValue(token: string): number {
  const value = ruleBody(tokensCssText, ":root")?.match(new RegExp(`${token}\\s*:\\s*(\\d+);`))?.[1];
  expect(value, `${token} should be defined in :root`).toBeDefined();
  return Number(value);
}

describe("shared UI layer definitions", () => {
  it("defines the seven ordered z-index tokens in :root", () => {
    const tokens = [
      "--z-canvas-overlay",
      "--z-canvas-callout",
      "--z-hud",
      "--z-resize-handle",
      "--z-stage-error",
      "--z-modal",
      "--z-alert",
    ];
    const values = tokens.map(tokenValue);

    expect(values).toEqual([1000, 1001, 1100, 1200, 1300, 1400, 1500]);
    expect(values.every((value, index) => index === 0 || value > (values[index - 1] ?? value))).toBe(true);
  });

  it("does not redefine layer tokens for the dark theme", () => {
    const darkBody = ruleBody(tokensCssText, ':root[data-theme="dark"]');

    expect(darkBody).not.toBeNull();
    expect(darkBody).not.toMatch(/--z-[-\w]+\s*:/);
  });

  it("keeps the Html layer ranges aligned with the CSS tokens", () => {
    const overlay = tokenValue("--z-canvas-overlay");
    const callout = tokenValue("--z-canvas-callout");

    expect(layersText).toContain(`CANVAS_OVERLAY_Z_RANGE: [number, number] = [${overlay}, 0]`);
    expect(layersText).toContain(`CANVAS_CALLOUT_Z_RANGE: [number, number] = [${callout}, ${callout}]`);
  });

  it("uses the shared global layers in the review and layout CSS", () => {
    expect(ruleBody(reviewCssText, ".review-stage")).toContain("isolation: isolate");
    expect(ruleBody(reviewCssText, ".review-hud")).toContain("z-index: var(--z-hud)");
    expect(ruleBody(reviewCssText, ".review-backdrop")).toContain("z-index: var(--z-modal)");
    expect(ruleBody(reviewCssText, ".review-stage__error")).toContain("z-index: var(--z-stage-error)");

    const alertBody = ruleBody(reviewCssText, ".review-page__alert");
    expect(alertBody).toContain("position: relative");
    expect(alertBody).toContain("z-index: var(--z-alert)");
    expect(ruleBody(layoutCssText, ".resize-handle")).toContain("z-index: var(--z-resize-handle)");
  });

  it("keeps the delete backdrop fixed without a local z-index", () => {
    const body = ruleBody(objectsCssText, ".objects-delete__backdrop");

    expect(body).toContain("position: fixed");
    expect(body).not.toMatch(/z-index\s*:/);
  });

  it("has no raw numeric z-index in the shared CSS files", () => {
    for (const cssText of [reviewCssText, layoutCssText, objectsCssText]) {
      expect(cssText).not.toMatch(/z-index:\s*\d/);
    }
  });

  it("passes imported layer ranges to every canvas Html", () => {
    expect(commentPinsText).toContain('from "../layout/layers"');
    expect(commentPinsText).toContain("zIndexRange={CANVAS_OVERLAY_Z_RANGE}");
    expect(commentCalloutText).toContain('from "../layout/layers"');
    expect(commentCalloutText).toContain("zIndexRange={CANVAS_CALLOUT_Z_RANGE}");
    expect(remoteCamerasText).toContain('from "../layout/layers"');
    expect(remoteCamerasText).toContain("zIndexRange={CANVAS_OVERLAY_Z_RANGE}");

    for (const sourceText of [commentPinsText, commentCalloutText, remoteCamerasText]) {
      expect(sourceText).not.toContain("zIndexRange={[");
    }
  });
});
