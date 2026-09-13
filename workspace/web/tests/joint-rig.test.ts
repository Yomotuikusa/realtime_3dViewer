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

describe("joint rig", () => {
  it("connects display settings and scenes to the frame loop", () => {
    const source = readSource("features/joint/JointRig.tsx");
    expect(source).toContain("export function JointRig(): null");
    expect(source).toContain("useDisplayStore(");
    expect(source).toContain("useModelScenesStore(");
    expect(source).toContain("useFrame(");
    expect(source).toContain("addJointOverlay(");
    expect(source).toContain("removeJointOverlay(");
    expect(source).toContain("setJointOverlayXray(");
    expect(source).toContain("updateJointOverlay(");
    expect(source).not.toContain("send");
    expect(source).not.toContain("props");
    expect(source).toContain("}, [scenes, jointDisplay.visible, jointColor, linkColor]);");
    expect(source).toContain("}, [scenes, jointDisplay.visible, jointDisplay.xray]);");
  });

  it("keeps joint display independent from React stores", () => {
    const source = readSource("features/joint/joint-display.ts");
    expect(source).toContain('VIEWER_OVERLAY_KEY, isViewerOverlay } from "../viewer/mesh-display"');
    expect(source).not.toContain("useDisplayStore");
    expect(source).not.toContain('from "react"');
    expect(readSource("features/viewer/mesh-display.ts")).not.toContain("JointRig");
    expect(readSource("features/viewer/mesh-display.ts")).not.toContain("addJointOverlay");
    expect(readSource("features/outliner/visibility.ts")).not.toContain("JointRig");
    expect(readSource("features/outliner/visibility.ts")).not.toContain("addJointOverlay");
  });
});
