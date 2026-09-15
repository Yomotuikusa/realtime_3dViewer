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
const objectList = readFileSync(join(srcDir, "features/objects/ObjectList.tsx"), "utf8");
const compareControls = readFileSync(join(srcDir, "features/objects/CompareControls.tsx"), "utf8");
const reviewCss = readFileSync(join(srcDir, "app/review.css"), "utf8");
const reviewPage = readFileSync(join(srcDir, "app/ReviewPage.tsx"), "utf8");

describe("objects styles and placement", () => {
  it("styles hidden object names with a semantic token", () => {
    expect(objectsCss).toContain('.objects__row[data-hidden="true"]');
    expect(objectsCss).toContain("var(--color-text-muted)");
    expect(objectsCss).not.toContain(".objects__file");
  });

  it("styles the compare controls with semantic layout tokens", () => {
    expect(objectsCss).toContain(".compare {");
    expect(objectsCss).toContain(".compare__field {");
    expect(objectsCss).toContain(".compare__range {");
    expect(objectsCss).toContain(".compare__check {");
    expect(objectsCss).toContain(".compare__legend {");
    expect(objectsCss).toContain("grid-template-columns: 3rem minmax(0, 1fr);");
  });

  it("places compare controls after adding files and before upload errors", () => {
    const addIndex = objectList.indexOf("objects__add");
    const compareIndex = objectList.indexOf("<CompareControls send={send} />");
    const alertIndex = objectList.indexOf('role="alert"');
    expect(compareIndex).toBeGreaterThan(addIndex);
    expect(compareIndex).toBeLessThan(alertIndex);
  });

  it("defines the compare control contract", () => {
    expect(compareControls).toContain("aria-label={COMPARE_HEADING}");
    expect(compareControls).toContain('type: "mesh:compare"');
    expect(compareControls).toContain("meshCompareEquals(");
    expect(compareControls.match(/<select\b/g)).toHaveLength(2);
    expect(compareControls.match(/type="range"/g)).toHaveLength(1);
    expect(compareControls.match(/type="checkbox"/g)).toHaveLength(1);
    expect(compareControls).toContain("checked={meshCompare.baseVisible === true}");
    expect(compareControls).toContain("baseVisible: event.target.checked");
    expect(compareControls).toContain("min={MIN_COMPARE_THRESHOLD_PERMILLE}");
    expect(compareControls).toContain("max={MAX_COMPARE_THRESHOLD_PERMILLE}");
    expect(compareControls).toContain("objects.length < 2");
    expect(compareControls).not.toMatch(/#[0-9a-f]{3,8}/i);
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
