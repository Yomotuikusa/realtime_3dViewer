/// <reference types="node" />

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "web/src/features/theme/theme.css"), "utf8");

function ruleBody(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^{}]*)\\}`))?.[1] ?? null;
}

describe("theme styles", () => {
  it("defines the settings, rows, picker, and palette layout", () => {
    expect(ruleBody(".theme-settings")).toContain("gap: var(--space-3)");
    expect(ruleBody(".theme-modes")).toContain("display: flex");
    expect(ruleBody(".theme-colors")).toContain("display: grid");
    expect(ruleBody(".theme-color-row")).toContain("display: grid");
    expect(ruleBody(".theme-color-row")).toContain("grid-template-columns: 1fr auto auto auto");
    expect(css).toContain(".theme-color-row__name");
    expect(css).toContain(".theme-color-row__hex");
    expect(ruleBody(".theme-color-row__name,\n.theme-color-row__hex")).toContain("white-space: nowrap");
    expect(ruleBody('.theme-color-row[data-changed="true"] .theme-color-row__name')).toContain("font-weight");
    expect(ruleBody(".theme-palette")).toContain("grid-template-columns: repeat(9, 1fr)");
    expect(ruleBody('.theme-palette__swatch[aria-pressed="true"]')).toContain("box-shadow: inset");
  });

  it("defines variable-driven swatches and wheel markers", () => {
    expect(ruleBody(".theme-swatch,\n.theme-palette__swatch")).toContain("background: var(--swatch-color, transparent)");
    expect(ruleBody(".theme-wheel")).toContain("position: relative");
    expect(ruleBody(".theme-wheel")).toContain("width: 176px");
    expect(ruleBody(".theme-wheel")).toContain("height: 176px");
    expect(ruleBody(".theme-wheel__canvas")).toContain("display: block");
    expect(ruleBody(".theme-wheel__marker")).toContain("position: absolute");
    expect(ruleBody(".theme-wheel__marker")).toContain("left: var(--marker-x, 0)");
    expect(ruleBody(".theme-wheel__marker")).toContain("top: var(--marker-y, 0)");
    expect(ruleBody(".theme-wheel__marker")).toContain("transform: translate(-50%, -50%)");
    expect(ruleBody(".theme-wheel__marker--hue")).toContain("width");
    expect(ruleBody(".theme-wheel__marker--sv")).toContain("width");
  });

  it("keeps state in attributes and does not redefine shared controls or raw colors", () => {
    expect(css).toContain('.theme-swatch[aria-expanded="true"]');
    expect(css).toContain('.theme-palette__swatch[aria-pressed="true"]');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl)\(/i);
    expect(css).not.toContain("!important");
    expect(css).not.toContain("@import");
    expect(css).not.toMatch(/(?:^|[,{\s])\.(?:btn|input|alert|badge)(?:[\s,{.:]|$)/);
  });
});
