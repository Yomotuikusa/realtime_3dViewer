import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceUrl = new URL("../src", import.meta.url);
const resolvedSourceRoot = sourceUrl.protocol === "file:"
  ? fileURLToPath(sourceUrl)
  : join(process.cwd(), sourceUrl.pathname.slice(1));
const sourceRoot = existsSync(resolvedSourceRoot) ? resolvedSourceRoot : join(process.cwd(), "web", "src");
const readSource = (path: string): string => readFileSync(join(sourceRoot, path), "utf8");

/** text 中で selector にちょうど一致するルールのブロック本文。無ければ null。 */
function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*(?:/\\*[\\s\\S]*?\\*/\\s*)*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

describe("layout resize styles and wiring", () => {
  it("defines the shared handle affordance", () => {
    const css = readSource("features/layout/layout.css");
    expect(css).toContain("position: absolute");
    expect(css).toContain("touch-action: none");
    expect(css).toContain('.resize-handle[data-axis="x"]');
    expect(css).toContain("cursor: col-resize");
    expect(css).toContain('.resize-handle[data-axis="y"]');
    expect(css).toContain("cursor: row-resize");
    expect(css).toContain("var(--color-accent)");
  });

  it("places the handle on the review body boundary", () => {
    const css = readSource("app/review.css");
    expect(css).toContain("position: relative");
    expect(css).toContain("grid-template-columns: var(--outliner-width) minmax(0, 1fr) var(--panel-width)");
    expect(css).toContain("calc(var(--panel-width) - 4px)");
  });

  it("places the outliner handle and styles the outliner dock", () => {
    const css = readSource("app/review.css");
    expect(ruleBody(css, ".review-body__resize--outliner")).toContain("right: auto");
    expect(ruleBody(css, ".review-body__resize--outliner")).toContain("left: calc(var(--outliner-width) - 4px)");
    expect(ruleBody(css, ".review-outliner")).toContain("overflow: auto");
    expect(ruleBody(css, ".review-outliner")).toContain("border-right: 1px solid var(--color-border)");
    expect(ruleBody(css, ".review-outliner")).toContain("background: var(--color-surface-subtle)");
  });

  it("declares and wires the saved outliner width", () => {
    const tokens = readSource("styles/tokens.css");
    const page = readSource("app/ReviewPage.tsx");
    expect(tokens).toContain("--outliner-width:");
    expect(page).toContain('useLayoutSize("outlinerWidth")');
    expect(page).toContain('useLayoutSize("panelWidth")');
    expect(page).toContain('"--outliner-width"');
    expect(page).toContain('"--panel-width"');
    expect(page.match(/side="start"/g)).toHaveLength(1);
    expect(page).toContain('className="review-body__resize review-body__resize--outliner"');
    expect(page).toContain("label={OUTLINER_RESIZE_LABEL}");
    expect(page.match(/<ResizeHandle/g)).toHaveLength(2);
    expect(page).toContain("panelWidthMax(bodySize.width, OUTLINER_WIDTH_MIN_PX)");
    expect(page).toContain("outlinerWidthMax(bodySize.width, effectivePanelWidth)");
  });

  it("orders the outliner, viewer, and panel columns", () => {
    const page = readSource("app/ReviewPage.tsx");
    expect(page.indexOf('className="review-outliner"')).toBeLessThan(page.indexOf('side="start"'));
    expect(page.indexOf('side="start"')).toBeLessThan(page.indexOf('className="review-viewer"'));
    expect(page.indexOf('className="review-viewer"')).toBeLessThan(page.indexOf('className="review-panel"'));
    expect(page.match(/<Outliner \/>/g)).toHaveLength(1);
    expect(page.match(/<SelectionRig \/>/g)).toHaveLength(1);
    expect(page.indexOf("<SelectionRig />")).toBeGreaterThan(page.indexOf("<CommentPins />"));
    expect(page.match(/<VisibilityRig \/>/g)).toHaveLength(1);
    expect(page.indexOf("<VisibilityRig />")).toBeGreaterThan(page.indexOf("<SelectionRig />"));
    expect(page.indexOf("<VisibilityRig />")).toBeLessThan(page.indexOf("</ViewerCanvas>"));
  });

  it("wires the horizontal handle and inline panel width", () => {
    const page = readSource("app/ReviewPage.tsx");
    const handle = readSource("features/layout/ResizeHandle.tsx");
    expect(page).toContain("<ResizeHandle");
    expect(page).toContain('axis="x"');
    expect(page).toContain('"--panel-width"');
    expect(handle).toContain('role="separator"');
    expect(handle).toContain('import "./layout.css"');
  });
});
