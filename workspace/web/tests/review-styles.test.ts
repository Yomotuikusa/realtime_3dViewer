/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const urlPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), srcUrl.pathname.slice(1));
const srcDir = existsSync(urlPath) ? urlPath : join(process.cwd(), "web", "src");
const reviewCssText = readFileSync(join(srcDir, "app/review.css"), "utf8");
const reviewPageText = readFileSync(join(srcDir, "app/ReviewPage.tsx"), "utf8");

/** text 中で selector にちょうど一致するルールのブロック本文。無ければ null。 */
function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

describe("review model error styles", () => {
  it("centers the model error over the whole stage", () => {
    const body = ruleBody(reviewCssText, ".review-stage__error");

    expect(body).toContain("position: absolute");
    expect(body).toContain("inset: 0");
    expect(body).toContain("place-items: center");
    expect(body).toContain("pointer-events: none");
  });

  it("places the model error above the HUD", () => {
    const errorZIndex = ruleBody(reviewCssText, ".review-stage__error")?.match(/z-index:\s*(\d+)/)?.[1];
    const hudZIndex = ruleBody(reviewCssText, ".review-hud")?.match(/z-index:\s*(\d+)/)?.[1];

    expect(errorZIndex).toBeDefined();
    expect(hudZIndex).toBeDefined();
    expect(Number(errorZIndex)).toBeGreaterThan(Number(hudZIndex));
  });

  it("restores pointer interaction on the model error card", () => {
    expect(ruleBody(reviewCssText, ".review-stage__error .review-error")).toContain("pointer-events: auto");
  });

  it("places ErrorCard immediately inside the stage error wrapper", () => {
    expect(reviewPageText).toMatch(/<div className="review-stage__error">\s*<ErrorCard/);
  });

  it("uses the stage error wrapper only for the model failure fallback", () => {
    expect(reviewPageText.match(/review-stage__error/g)).toHaveLength(1);
  });
});
