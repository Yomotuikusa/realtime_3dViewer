/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RULER_HEIGHT_PX } from "../src/features/timeline/TimelineRuler";
import { LAYOUT_SIZE_SPECS } from "../src/features/layout/resize";

const srcUrl = new URL("../src", import.meta.url);
const srcPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), "web", "src");
const srcDir = existsSync(srcPath) ? srcPath : join(process.cwd(), "web", "src");
const read = (path: string): string => readFileSync(join(srcDir, path), "utf8");
const reviewCss = read("app/review.css");
const reviewPage = read("app/ReviewPage.tsx");
const viewerCanvas = read("features/viewer/ViewerCanvas.tsx");
const viewerHud = read("features/viewer/ViewerHud.tsx");
const timelineCss = read("features/timeline/timeline.css");
const playbackTimeline = read("features/timeline/PlaybackTimeline.tsx");
const timelineRuler = read("features/timeline/TimelineRuler.tsx");

function ruleBody(text: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return text.match(new RegExp("(?:^|})\\s*" + escaped + "\\s*\\{([^{}]*)\\}"))?.[1] ?? "";
}

describe("timeline layout styles", () => {
  it("docks the viewer stage and timeline as grid rows", () => {
    const viewer = ruleBody(reviewCss, ".review-viewer");
    const stage = ruleBody(reviewCss, ".review-stage");
    expect(viewer).toContain("position: relative");
    expect(viewer).toContain("display: grid");
    expect(viewer).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(stage).toContain("position: relative");
    expect(stage).toContain("overflow: hidden");
  });

  it("places the timeline between the stage and modal backdrops", () => {
    const stageIndex = reviewPage.indexOf('className="review-stage"');
    const hudIndex = reviewPage.indexOf('className="review-hud"');
    const timelineIndex = reviewPage.indexOf("<PlaybackTimeline send={realtime.send} />");
    const dialogIndex = reviewPage.indexOf("<JoinDialog");
    expect(stageIndex).toBeGreaterThan(-1);
    expect(hudIndex).toBeGreaterThan(stageIndex);
    expect(timelineIndex).toBeGreaterThan(stageIndex);
    expect(timelineIndex).toBeLessThan(dialogIndex);
  });

  it("removes the canvas minimum height and playback HUD", () => {
    expect(viewerCanvas).not.toContain("minHeight");
    expect(viewerHud).not.toContain("PlaybackMenu");
    expect(viewerHud).not.toContain("usePlaybackStore");
    expect(read("features/viewer/viewer.css")).not.toContain("hud-playback");
  });

  it("keeps the ruler touch-safe and centers transport controls", () => {
    expect(RULER_HEIGHT_PX).toBe(LAYOUT_SIZE_SPECS.timelineHeight.defaultValue);
    expect(ruleBody(timelineCss, ".timeline__track")).toContain("height: var(--timeline-track-height, " + RULER_HEIGHT_PX + "px)");
    expect(ruleBody(timelineCss, ".timeline__track")).toContain("touch-action: none");
    expect(ruleBody(timelineCss, ".timeline")).toContain("position: relative");
    expect(ruleBody(timelineCss, ".timeline__resize")).toContain("top: -4px");
    expect(ruleBody(timelineCss, ".timeline__transport")).toContain("margin-inline: auto");
    expect(playbackTimeline).toContain('import "./timeline.css"');
    const sourceIndex = playbackTimeline.indexOf("<PlaybackSourceSelect send={send} />");
    const clipIndex = playbackTimeline.indexOf("timeline__clip");
    expect(sourceIndex).toBeGreaterThan(-1);
    expect(sourceIndex).toBeLessThan(clipIndex);
  });

  it("places and sizes the timeline resize handle", () => {
    expect(playbackTimeline).toContain("<ResizeHandle");
    expect(playbackTimeline).toContain('axis="y"');
    expect(playbackTimeline).toContain('"--timeline-track-height"');
    expect(playbackTimeline.indexOf("<ResizeHandle")).toBeLessThan(playbackTimeline.indexOf("<TimelineRuler"));
  });

  it("measures the ruler track width and height with useElementSize", () => {
    expect(timelineRuler).toContain("useElementSize");
    expect(timelineRuler).not.toContain("new ResizeObserver");
    expect(timelineRuler).toContain('"0 0 " + width + " " + height');
    expect(timelineRuler).not.toContain('"0 0 " + width + " " + RULER_HEIGHT_PX');
  });

  it("sizes the playback source select", () => {
    expect(ruleBody(timelineCss, ".timeline__source")).toContain("max-width: 12rem");
  });
});
