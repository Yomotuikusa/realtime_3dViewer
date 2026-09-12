/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const tokensCss = readFileSync(join(srcDir, "styles/tokens.css"), "utf8");
const commentsCss = readFileSync(join(srcDir, "features/comments/comments.css"), "utf8");
const reviewCss = readFileSync(join(srcDir, "app/review.css"), "utf8");
const commentList = readFileSync(join(srcDir, "features/comments/CommentList.tsx"), "utf8");
const commentCallout = readFileSync(join(srcDir, "features/comments/CommentCallout.tsx"), "utf8");
const commentComposer = readFileSync(join(srcDir, "features/comments/CommentComposer.tsx"), "utf8");

function selectorBlock(css: string, selector: string): string {
  const index = css.indexOf(`${selector} {`);
  expect(index).toBeGreaterThanOrEqual(0);
  const start = css.indexOf("{", index);
  const end = css.indexOf("}", start);
  return css.slice(start + 1, end);
}

describe("comments styles", () => {
  it("defines the card shadow token", () => {
    const rootBlock = selectorBlock(tokensCss, ":root");
    expect(rootBlock).toContain("--shadow-card:");
    const shadowValue = rootBlock.match(/--shadow-card:\s*([^;]+)/)?.[1] ?? "";
    expect(shadowValue).toContain("0 1px 2px");
    expect(shadowValue).toContain("0 1px 3px");
  });

  it("styles comment rows as cards", () => {
    const row = selectorBlock(commentsCss, ".comments-row");
    expect(row).toContain("border: 1px solid var(--color-border)");
    expect(row).toContain("border-radius: var(--radius-md)");
    expect(row).toContain("background: var(--color-surface)");
    expect(row).toContain("box-shadow: var(--shadow-card)");
    expect(row).toContain("padding: var(--space-2)");
    expect(row).not.toContain("border-left");
    expect(row).not.toContain("var(--radius-sm)");
    expect(commentsCss).not.toContain("border-left-color");
  });

  it("keeps hover and selected card states within the card surface", () => {
    expect(selectorBlock(commentsCss, ".comments-row:hover")).toContain(
      "border-color: var(--color-border-strong)",
    );
    const selected = selectorBlock(commentsCss, '.comments-row[data-selected="true"]');
    expect(selected).toContain("border-color: var(--color-accent)");
    expect(selected).toContain("background: var(--color-accent-subtle)");
    expect(selected).toContain(
      "box-shadow: 0 0 0 3px var(--color-accent-subtle), var(--shadow-card)",
    );
  });

  it("only mutes resolved comment bodies", () => {
    const resolvedBody = selectorBlock(
      commentsCss,
      '.comments-row[data-status="resolved"] .comments-row__body',
    );
    expect(resolvedBody).toContain("var(--color-text-muted)");
    const resolvedSelectors = [...commentsCss.matchAll(/([^{}\n]*\.comments-row\[data-status="resolved"\][^{}\n]*)\s*\{/g)]
      .map((match) => match[1]?.trim());
    expect(resolvedSelectors).toEqual(['.comments-row[data-status="resolved"] .comments-row__body']);
  });

  it("keeps list and row controls aligned with the card", () => {
    const list = selectorBlock(commentsCss, ".comments__list");
    expect(list).toContain("gap: var(--space-2)");
    expect(list).toContain("padding: var(--space-1)");
    expect(list).not.toContain("padding: 0");
    expect(selectorBlock(commentsCss, ".comments-row__select")).toContain("padding: 0");
    expect(selectorBlock(commentsCss, ".comments-row__toggle")).toContain("margin: 0");
  });

  it("stacks comment cards and expands only the selected body", () => {
    const list = selectorBlock(commentsCss, ".comments__list");
    expect(list).toContain("align-content: start");
    expect(list).not.toMatch(/align-content:\s*(?:stretch|space)/);

    const body = selectorBlock(commentsCss, "\n.comments-row__body");
    expect(body).toContain("-webkit-line-clamp: 2");
    expect(body).toContain("overflow: hidden");
    expect(body).toContain("overflow-wrap: anywhere");

    const selectedBody = selectorBlock(
      commentsCss,
      '.comments-row[data-selected="true"] .comments-row__body',
    );
    expect(selectedBody).toContain("display: block");
    expect(selectedBody).toContain("overflow: visible");
    expect(selectedBody).toContain("-webkit-line-clamp: unset");
    expect(commentsCss.match(/-webkit-line-clamp:\s*2/g)).toHaveLength(1);
    expect(commentList).toContain("data-selected");
    expect(commentList).toContain("comments-row__body");
  });

  it("keeps unselected bodies at two lines and makes the callout close circular", () => {
    const body = selectorBlock(commentsCss, "\n.comments-row__body");
    expect(body).toContain("min-height: calc(var(--leading) * 2em)");
    expect(body).toContain("-webkit-line-clamp: 2");
    expect(body).toContain("overflow: hidden");

    const selectedBody = selectorBlock(
      commentsCss,
      '.comments-row[data-selected="true"] .comments-row__body',
    );
    expect(selectedBody).not.toContain("min-height");
    expect(commentsCss.match(/min-height:\s*calc\(var\(--leading\) \* 2em\)/g)).toHaveLength(1);

    const close = selectorBlock(commentsCss, ".comments-callout__close");
    expect(close).toContain("border-radius: 50%");
    expect(close).toContain("width: 1.5rem");
    expect(close).toContain("height: 1.5rem");
    expect(close).toContain("min-height: 0");
    expect(close).toContain("padding: 0");
    expect(close).toContain("margin: 0");
    expect(close).toContain("border: 1px solid var(--color-border-strong)");
    expect(close).toContain("display: inline-flex");
    expect(close).not.toContain("outline");
    expect(commentsCss.match(/outline:/g)).toHaveLength(1);

    expect(commentCallout).toContain("comments-callout__close");
    expect(commentCallout).toContain("btn--quiet");
    expect(commentList).toContain("comments-row__body");
    expect(commentList).toContain("data-selected");
  });

  it("gives the composer the card shadow", () => {
    const composer = selectorBlock(commentsCss, ".comments-composer");
    expect(composer).toContain("box-shadow: var(--shadow-card)");
    expect(composer).toContain("border: 1px solid var(--color-accent)");
  });

  it("styles the selected comment callout and its body", () => {
    const callout = selectorBlock(commentsCss, ".comments-callout");
    expect(callout).toContain("width: 16rem");
    expect(callout).toContain("margin-left: var(--space-3)");
    expect(callout).toContain("border: 1px solid var(--color-accent)");
    expect(callout).toContain("box-shadow: var(--shadow-overlay)");
    expect(callout).toContain("transform: translateY(-50%)");
    expect(callout).toContain("pointer-events: auto");

    const body = selectorBlock(commentsCss, ".comments-callout__body");
    expect(body).toContain("max-height: 10rem");
    expect(body).toContain("overflow: auto");
    expect(body).toContain("white-space: pre-wrap");
    expect(body).toContain("overflow-wrap: anywhere");

    expect(selectorBlock(commentsCss, ".comments-callout__close")).toContain("margin: 0");
    expect(selectorBlock(
      commentsCss,
      '.comments-callout[data-status="resolved"] .comments-callout__body',
    )).toContain("var(--color-text-muted)");
  });

  it("styles the frame switch and playback badge", () => {
    const frameSwitch = selectorBlock(commentsCss, ".comments-composer__frame");
    expect(frameSwitch).toContain("display: flex");
    expect(frameSwitch).toContain("font-size: var(--text-sm)");
    expect(selectorBlock(commentsCss, ".comments-row__frame")).toContain("white-space: nowrap");
    expect(commentComposer).toContain("comments-composer__frame");
    expect(commentComposer).toContain("loadRecordFrame");
    expect(commentComposer).toContain("saveRecordFrame");
    expect(commentComposer).toContain("commentPlaybackOf");
    expect(commentList).toContain("comments-row__frame");
    expect(commentList).toContain("playbackBadge");
  });

  it("preserves pin focus outline and panel background", () => {
    expect(selectorBlock(commentsCss, ".comments-pin")).not.toContain("outline");
    expect(selectorBlock(commentsCss, '.comments-pin[aria-pressed="true"]')).toContain("outline:");
    expect(commentsCss.match(/outline:/g)).toHaveLength(1);
    expect(selectorBlock(reviewCss, ".review-panel")).toContain(
      "background: var(--color-surface-subtle)",
    );
  });

  it("keeps raw colors out of feature styles and preserves TSX class names", () => {
    const rawColor = /#[0-9a-f]{3,8}|\b(?:rgb|rgba|hsl)\(/i;
    expect(commentsCss).not.toMatch(rawColor);
    expect(reviewCss).not.toMatch(rawColor);
    expect(commentList).toContain("comments-row");
    expect(commentList).toContain("comments-row__select");
    expect(commentList).toContain("comments-row__toggle");
  });
});
