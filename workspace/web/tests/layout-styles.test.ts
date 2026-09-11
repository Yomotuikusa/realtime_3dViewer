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
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) var(--panel-width)");
    expect(css).toContain("calc(var(--panel-width) - 4px)");
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
