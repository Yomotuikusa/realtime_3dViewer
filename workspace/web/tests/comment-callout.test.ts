/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const callout = readFileSync(join(srcDir, "features/comments/CommentCallout.tsx"), "utf8");
const pins = readFileSync(join(srcDir, "features/comments/CommentPins.tsx"), "utf8");

describe("comment callout source", () => {
  it("renders the selected comment with a fixed, high Html layer", () => {
    expect(callout).toContain("export function CommentCallout");
    expect(callout).toContain('from "@react-three/drei"');
    expect(callout).toContain("<Html position={comment.anchor} zIndexRange={[16777272, 16777272]}>");
    expect(callout).toContain('className="comments-callout"');
    expect(callout).toContain('role="dialog"');
    expect(callout).toContain("data-status={comment.status}");
  });

  it("stops overlay pointer events and supports closing the selection", () => {
    expect(callout.match(/stopPropagation\(\)/g)).toHaveLength(2);
    expect(callout).toContain("comments-callout__close");
    expect(callout).toContain("aria-label={CLOSE_CALLOUT_LABEL}");
    expect(callout).toContain("select(null)");
  });

  it("renders the complete comment metadata and body", () => {
    for (const token of [
      "comments-callout__body",
      "formatCommentTime",
      "statusLabel",
      "statusTone",
      "playbackBadge",
      "playbackTitle",
      "pinLabel",
      "comment.playback ?? null",
    ]) {
      expect(callout).toContain(token);
    }
  });

  it("places the selected visible comment after its pins", () => {
    expect(pins).toContain('import { CommentCallout } from "./CommentCallout";');
    expect(pins).toContain("visibleItems.find(");
    expect(pins).toContain("<CommentCallout comment=");
    expect(pins).toContain("comments-pin");
    expect(pins).toContain("aria-pressed");
    expect(pins).toContain("select(id)");
    expect(pins.indexOf("visibleItems.map")).toBeLessThan(pins.indexOf("<CommentCallout comment="));
  });

  it("keeps presentation out of inline styles and outlines", () => {
    expect(callout).not.toContain("outline");
    expect(callout).not.toContain("style={{");
    expect(pins).not.toContain("outline");
    expect(pins).not.toContain("style={{");
  });
});
