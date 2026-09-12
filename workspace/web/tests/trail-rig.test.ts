/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

describe("trail rig", () => {
  it("connects trail settings, scenes, clips, playback, and the frame loop", () => {
    const source = readSource("features/trail/TrailRig.tsx");
    expect(source).toContain("export function TrailRig(): null");
    expect(source).toContain("useDisplayStore(");
    expect(source).toContain("useModelScenesStore(");
    expect(source).toContain("useModelClipsStore(");
    expect(source).toContain("usePlaybackStore(");
    expect(source).toContain("resolveTrailTarget(");
    expect(source).toContain("selectModelClips(");
    expect(source).toContain("sampleTrail(");
    expect(source).toContain("addTrailOverlay(");
    expect(source).toContain("removeTrailOverlay(");
    expect(source).toContain("jointRadius(");
    expect(source).toContain("useFrame(");
    expect(source).toContain("setTrailCurrentFrame(");
    expect(source).toContain("}, [scenes, clips, motionTrail, clipIndex, fps]);");
  });

  it("places TrailRig after JointRig inside ViewerCanvas", () => {
    const page = readSource("app/ReviewPage.tsx");
    expect(page).toContain('import { TrailRig } from "../features/trail/TrailRig";');
    expect(page.match(/<TrailRig \/>/g)).toHaveLength(1);
    expect(page.indexOf("<TrailRig />")).toBeGreaterThan(page.indexOf("<JointRig />"));
    expect(page.indexOf("<TrailRig />")).toBeLessThan(page.indexOf("</ViewerCanvas>"));
  });
});
