/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTLINER_WIDTH_DEFAULT_PX, PANEL_WIDTH_DEFAULT_PX } from "../src/features/layout/resize";

const sourceUrl = new URL("../src", import.meta.url);
const resolvedSourceRoot = sourceUrl.protocol === "file:"
  ? sourceUrl.pathname
  : join(process.cwd(), "web", "src");
const sourceRoot = existsSync(resolvedSourceRoot) ? resolvedSourceRoot : join(process.cwd(), "web", "src");
const readSource = (path: string): string => readFileSync(join(sourceRoot, path), "utf8");

function tokenRemValue(css: string, name: string): number {
  const value = css.match(new RegExp(`${name.replaceAll("-", "\\-")}\\s*:\\s*([0-9.]+)rem`))?.[1];
  if (value === undefined) throw new Error(`${name} must be declared in rem`);
  return Number(value) * 16;
}

describe("layout token defaults", () => {
  it("keeps panel and outliner token fallbacks aligned with resize defaults", () => {
    const tokens = readSource("styles/tokens.css");
    expect(tokenRemValue(tokens, "--panel-width")).toBe(PANEL_WIDTH_DEFAULT_PX);
    expect(tokenRemValue(tokens, "--outliner-width")).toBe(OUTLINER_WIDTH_DEFAULT_PX);
  });

  it("passes effective widths to the review body", () => {
    const reviewPage = readSource("app/ReviewPage.tsx");
    expect(reviewPage).toContain('"--outliner-width": effectiveOutlinerWidth + "px"');
    expect(reviewPage).toContain('"--panel-width": effectivePanelWidth + "px"');
  });
});
