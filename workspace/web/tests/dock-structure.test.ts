import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DockColumn } from "../src/app/ReviewDock";
import { dockRegionLabel } from "../src/app/review-labels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

async function render(element: ReturnType<typeof createElement>): Promise<Rendered> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { root, host };
}

afterEach(() => document.body.replaceChildren());

describe("DockColumn", () => {
  it("keeps an open outliner and its children in the dock column", async () => {
    const onToggle = vi.fn();
    const { root, host } = await render(createElement(DockColumn, {
      side: "outliner",
      open: true,
      title: "アウトライナ",
      label: "アウトライナドックの表示",
      onToggle,
      children: createElement("span", { className: "probe" }, "child"),
    }));
    try {
      const aside = host.querySelector("aside.review-outliner") as HTMLElement | null;
      const inner = aside?.querySelector(":scope > .review-dock__inner") as HTMLElement | null;
      expect(aside?.getAttribute("data-open")).toBe("true");
      expect(aside?.getAttribute("aria-label")).toBe("アウトライナドック");
      expect(aside?.hasAttribute("inert")).toBe(false);
      expect(inner?.children.item(0)?.className).toBe("review-dock-bar");
      expect(inner?.children.item(1)?.className).toBe("probe");
      expect(inner?.querySelector(".probe")?.textContent).toBe("child");
      await act(async () => (inner?.querySelector("button") as HTMLButtonElement).click());
      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(false);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps a closed panel mounted and inert", async () => {
    const { root, host } = await render(createElement(DockColumn, {
      side: "panel",
      open: false,
      title: "インスペクタ",
      label: "インスペクタの表示",
      onToggle: vi.fn(),
      children: createElement("span", { className: "probe" }, "child"),
    }));
    try {
      const aside = host.querySelector("aside.review-panel") as HTMLElement | null;
      expect(aside?.getAttribute("data-open")).toBe("false");
      expect(aside?.getAttribute("aria-label")).toBe("インスペクタドック");
      expect(aside?.hasAttribute("inert")).toBe(true);
      expect(aside?.querySelector(".probe")?.textContent).toBe("child");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("labels an open panel as the inspector dock", async () => {
    const { root, host } = await render(createElement(DockColumn, {
      side: "panel",
      open: true,
      title: "インスペクタ",
      label: "インスペクタの表示",
      onToggle: vi.fn(),
      children: createElement("span", null, "child"),
    }));
    try {
      const aside = host.querySelector("aside.review-panel") as HTMLElement | null;
      expect(aside?.getAttribute("data-open")).toBe("true");
      expect(aside?.getAttribute("aria-label")).toBe("インスペクタドック");
      expect(aside?.hasAttribute("inert")).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*(?:/\\*[\\s\\S]*?\\*/\\s*)*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

describe("dock structure source contracts", () => {
  it("keeps both columns mounted and only handles conditional", () => {
    const page = read("web/src/app/ReviewPage.tsx");
    expect(page).toContain('useLayoutFlag("outlinerOpen")');
    expect(page).toContain('useLayoutFlag("panelOpen")');
    expect(page).toContain("panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0)");
    expect(page).toContain("outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0)");
    expect(page.match(/<DockColumn/g)).toHaveLength(2);
    expect(page).toContain('side="outliner"');
    expect(page).toContain('side="panel"');
    expect(page).not.toContain("<DockCollapseBar");
    expect(page.match(/\{outlinerOpen && \(/g)).toHaveLength(1);
    expect(page.match(/\{panelOpen && \(/g)).toHaveLength(1);
    expect(page.match(/\{!outlinerOpen && \(/g)).toHaveLength(1);
    expect(page.match(/\{!panelOpen && \(/g)).toHaveLength(1);
    expect(page).toContain('"--outliner-width": outlinerOpen ? effectiveOutlinerWidth + "px" : "0px"');
    expect(page).toContain('"--panel-width": panelOpen ? effectivePanelWidth + "px" : "0px"');
    expect(page).toContain('"--outliner-open-width": effectiveOutlinerWidth + "px"');
    expect(page).toContain('"--panel-open-width": effectivePanelWidth + "px"');
    expect(page).toContain("title={OUTLINER_HEADING}");
    expect(page).toContain("title={PANEL_DOCK_TITLE}");
    expect(page).not.toContain("onToggleOutliner");
    expect(page).not.toContain("onTogglePanel");
    expect(page.indexOf('side="outliner"')).toBeLessThan(page.indexOf('side="start"'));
    expect(page.indexOf('side="start"')).toBeLessThan(page.indexOf('className="review-viewer"'));
    expect(page.indexOf('className="review-viewer"')).toBeLessThan(page.lastIndexOf('side="panel"'));
    expect(page.indexOf("<PresenceList />")).toBeLessThan(page.indexOf("<ObjectList"));
    expect(page.indexOf("<ObjectList")).toBeLessThan(page.indexOf("review-panel__comments"));
  });

  it("keeps expand controls around the viewer HUD", () => {
    const page = read("web/src/app/ReviewPage.tsx");
    expect(page.indexOf("<DockExpandButton")).toBeLessThan(page.indexOf("<ViewerHud send={realtime.send} />"));
    expect(page.indexOf("<DockExpandButton", page.indexOf("<DockExpandButton") + 1))
      .toBeGreaterThan(page.indexOf("<ViewerHud send={realtime.send} />"));
    expect(page).not.toContain("<DockCollapseBar");
  });

  it("keeps the dock-specific CSS in its own stylesheet", () => {
    const css = read("web/src/app/review.css");
    const dockCss = read("web/src/app/review-dock.css");
    const dockSource = read("web/src/app/ReviewDock.tsx");
    expect(dockSource).toContain('import "./review-dock.css"');
    expect(css).not.toContain(".review-dock-bar");
    expect(css).not.toContain(".review-chevron-icon");
    expect(css).not.toContain(".review-dock-expand");
    expect(ruleBody(css, ".review-body")).toContain("--outliner-open-width:");
    expect(ruleBody(css, ".review-body")).toContain("--panel-open-width:");
    expect(ruleBody(css, ".review-outliner")).toContain("overflow: auto");
    expect(ruleBody(css, ".review-outliner")).toContain("overflow-x: hidden");
    expect(ruleBody(css, ".review-panel")).toContain("grid-column: 3");
    expect(ruleBody(css, ".review-panel")).toContain("background: var(--color-surface-subtle)");
    expect(ruleBody(css, ".review-panel")).not.toContain("display: grid");
    expect(ruleBody(dockCss, ".review-outliner .review-dock__inner")).toContain("width: var(--outliner-open-width)");
    expect(ruleBody(dockCss, ".review-panel .review-dock__inner")).toContain("width: var(--panel-open-width)");
    expect(ruleBody(dockCss, ".review-panel .review-dock__inner")).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(ruleBody(dockCss, ".review-dock-bar")).toContain("position: sticky");
    expect(ruleBody(dockCss, ".review-dock-bar__button")).toContain("flex: 1");
    expect(ruleBody(dockCss, ".review-dock-bar__button")).toContain("justify-content: space-between");
    expect(ruleBody(dockCss, '.review-dock-bar[data-side="panel"] .review-dock-bar__button')).toContain("flex-direction: row-reverse");
    expect(ruleBody(dockCss, ".review-chevron-icon")).toContain("width: 1rem");
    expect(css).not.toContain(".review-header__dock");
  });

  it("keeps the replacement chevron icon contract", () => {
    const icons = read("web/src/app/review-icons.tsx");
    expect(icons).toContain("CHEVRON_ICON_VIEW_BOX");
    expect(icons).toContain("CHEVRON_LEFT_PATH");
    expect(icons).toContain("CHEVRON_RIGHT_PATH");
    expect(icons).toContain("ChevronDirection");
    expect(icons).toContain("ChevronIcon");
    expect(icons).not.toContain("DOCK_LEFT_FILL_PATH");
    expect(icons).not.toContain("OutlinerDockIcon");
  });

  it("defines the region label from the visible title", () => {
    expect(dockRegionLabel("インスペクタ")).toBe("インスペクタドック");
  });
});
