/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KIND_LABELS } from "../src/features/outliner/outliner-labels";
import {
  ChevronIcon,
  MeshIcon,
  OUTLINER_KIND_ICONS,
} from "../src/features/outliner/outliner-icons";
import type { OutlinerNodeKind } from "../src/features/outliner/outliner-tree";

const sourceRoot = existsSync(join(process.cwd(), "web", "src")) ? join(process.cwd(), "web", "src") : join(process.cwd(), "src");
const cssText = readFileSync(join(sourceRoot, "features/outliner/outliner.css"), "utf8");
const outlinerText = readFileSync(join(sourceRoot, "features/outliner/Outliner.tsx"), "utf8");
const rowText = readFileSync(join(sourceRoot, "features/outliner/OutlinerRow.tsx"), "utf8");
const iconText = readFileSync(join(sourceRoot, "features/outliner/outliner-icons.tsx"), "utf8");

function ruleBody(text: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^{}]*)\\}`))?.[1] ?? null;
}

describe("outliner styles and source contracts", () => {
  it("renders every kind icon with the shared SVG contract", () => {
    for (const kind of Object.keys(KIND_LABELS) as OutlinerNodeKind[]) {
      const element = OUTLINER_KIND_ICONS[kind]() as React.ReactElement<Record<string, unknown>>;
      expect(element.type).toBe("svg");
      expect(element.props.viewBox).toBe("0 0 16 16");
      expect(element.props.className).toBe("outliner__icon");
      expect(element.props["aria-hidden"]).toBe("true");
      expect(element.props.focusable).toBe("false");
      expect(element.props["data-kind"]).toBe(kind);
      expect(element.props.width).toBeUndefined();
      expect(element.props.height).toBeUndefined();
    }
    const chevron = ChevronIcon() as React.ReactElement<Record<string, unknown>>;
    expect(chevron.type).toBe("svg");
    expect(chevron.props.className).toBe("outliner__chevron");
    expect(chevron.props["data-kind"]).toBeUndefined();
    expect(OUTLINER_KIND_ICONS.mesh).toBe(MeshIcon);
  });

  it("keeps the required CSS state rules", () => {
    expect(ruleBody(cssText, '.outliner__select[aria-pressed="true"]')).toContain("var(--color-accent-subtle)");
    expect(ruleBody(cssText, ".outliner__row")).toContain("var(--outliner-depth, 0)");
    expect(ruleBody(cssText, '.outliner__expand[aria-expanded="true"] .outliner__chevron')).toContain("rotate(90deg)");
    expect(ruleBody(cssText, '.outliner__item[data-hidden="true"] > .outliner__row')).not.toBeNull();
    expect(iconText).toContain("CUBE_OUTLINE");
    expect(iconText).toContain("CUBE_FRONT_EDGES");
    expect(iconText).toContain('from "../viewer/display-icons"');
    expect(iconText).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("keeps tree and selection local to the outliner", () => {
    expect(outlinerText).toContain("useState<string[]>([])");
    expect(outlinerText).toContain('role="tree"');
    expect(outlinerText).toContain("useModelScenesStore");
    expect(outlinerText).toContain("useSelectionStore");
    expect(outlinerText).toContain("buildOutlinerTree(");
    expect(outlinerText).toContain("toggleId(");
    expect(outlinerText).toContain("versionTag(");
    expect(outlinerText).toContain("isObjectVisible(");
    expect(outlinerText).toContain('import "./outliner.css"');
    expect(rowText).toContain('role="treeitem"');
    expect(rowText).toContain('role="group"');
    expect(rowText).toContain("aria-expanded={");
    expect(rowText).toContain("aria-selected={");
    expect(rowText).toContain("aria-pressed={selected}");
    expect(rowText).toContain("expandAriaLabel(");
    expect(rowText).toContain('data-tone="neutral"');
    expect(rowText).toContain('"--outliner-depth"');
    expect(rowText).toContain("<OutlinerBranch");
    expect(outlinerText).not.toContain("send(");
    expect(outlinerText).not.toContain("ClientMessage");
    expect(rowText).not.toContain("send(");
    expect(rowText).not.toContain("ClientMessage");
  });
});
