/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const objectsCss = readFileSync(join(srcDir, "features/objects/objects.css"), "utf8");
const reviewCss = readFileSync(join(srcDir, "app/review.css"), "utf8");
const reviewPage = readFileSync(join(srcDir, "app/ReviewPage.tsx"), "utf8");

describe("objects styles and placement", () => {
  it("styles hidden object names with a semantic token", () => {
    expect(objectsCss).toContain('.objects__row[data-hidden="true"]');
    expect(objectsCss).toContain("var(--color-text-muted)");
    expect(objectsCss).not.toContain(".objects__file");
  });

  it("uses three rows for the review panel", () => {
    expect(reviewCss).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
  });

  it("places objects between participants and comments", () => {
    const presenceIndex = reviewPage.indexOf("<PresenceList />");
    const objectsIndex = reviewPage.indexOf("<ObjectList");
    const commentsIndex = reviewPage.indexOf("review-panel__comments");
    expect(objectsIndex).toBeGreaterThan(presenceIndex);
    expect(objectsIndex).toBeLessThan(commentsIndex);
  });
});
