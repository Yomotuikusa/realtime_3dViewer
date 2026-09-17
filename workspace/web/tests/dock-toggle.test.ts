import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockCollapseBar, DockExpandButton } from "../src/app/ReviewDock";
import { ReviewHeader } from "../src/app/ReviewHeader";
import {
  CHEVRON_LEFT_PATH,
  CHEVRON_RIGHT_PATH,
  ChevronIcon,
} from "../src/app/review-icons";
import { OUTLINER_TOGGLE_LABEL, PANEL_TOGGLE_LABEL, SETTINGS_OPEN_LABEL } from "../src/app/review-labels";
import { useLayoutFlag } from "../src/features/layout/useLayoutFlag";
import type { LayoutFlagName } from "../src/features/layout/layout-storage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

async function render(element: ReturnType<typeof createElement>): Promise<Rendered> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { root, host };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

beforeEach(() => localStorage.clear());

describe("DockCollapseBar", () => {
  it("renders the outliner bar and left chevron", async () => {
    const { root, host } = await render(createElement(DockCollapseBar, {
      side: "outliner",
      label: OUTLINER_TOGGLE_LABEL,
      onCollapse: vi.fn(),
    }));
    try {
      const bar = host.querySelector("div.review-dock-bar[data-side=outliner]");
      const button = bar?.querySelector("button") as HTMLButtonElement | null;
      expect(bar).not.toBeNull();
      expect(button?.type).toBe("button");
      expect(button?.getAttribute("aria-expanded")).toBe("true");
      expect(button?.getAttribute("aria-label")).toBe(OUTLINER_TOGGLE_LABEL);
      expect(button?.classList.contains("btn")).toBe(true);
      expect(button?.classList.contains("btn--quiet")).toBe(true);
      expect(button?.classList.contains("review-dock-bar__button")).toBe(true);
      expect(button?.querySelector("path")?.getAttribute("d")).toBe(CHEVRON_LEFT_PATH);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("renders the panel bar and right chevron", async () => {
    const { root, host } = await render(createElement(DockCollapseBar, {
      side: "panel",
      label: PANEL_TOGGLE_LABEL,
      onCollapse: vi.fn(),
    }));
    try {
      expect(host.querySelector("div.review-dock-bar[data-side=panel] path")?.getAttribute("d"))
        .toBe(CHEVRON_RIGHT_PATH);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("calls onCollapse once", async () => {
    const onCollapse = vi.fn();
    const { root, host } = await render(createElement(DockCollapseBar, {
      side: "outliner",
      label: OUTLINER_TOGGLE_LABEL,
      onCollapse,
    }));
    try {
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      expect(onCollapse).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("DockExpandButton", () => {
  it("renders the outliner button and right chevron", async () => {
    const { root, host } = await render(createElement(DockExpandButton, {
      side: "outliner",
      label: OUTLINER_TOGGLE_LABEL,
      onExpand: vi.fn(),
    }));
    try {
      const button = host.querySelector("button.review-dock-expand[data-side=outliner]");
      expect(button?.getAttribute("aria-expanded")).toBe("false");
      expect(button?.classList.contains("btn")).toBe(true);
      expect(button?.classList.contains("btn--quiet")).toBe(false);
      expect(button?.querySelector("path")?.getAttribute("d")).toBe(CHEVRON_RIGHT_PATH);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("renders the panel button and left chevron", async () => {
    const { root, host } = await render(createElement(DockExpandButton, {
      side: "panel",
      label: PANEL_TOGGLE_LABEL,
      onExpand: vi.fn(),
    }));
    try {
      expect(host.querySelector("button.review-dock-expand[data-side=panel] path")?.getAttribute("d"))
        .toBe(CHEVRON_LEFT_PATH);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("calls onExpand once", async () => {
    const onExpand = vi.fn();
    const { root, host } = await render(createElement(DockExpandButton, {
      side: "panel",
      label: PANEL_TOGGLE_LABEL,
      onExpand,
    }));
    try {
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      expect(onExpand).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("ChevronIcon", () => {
  it("renders one accessible-hidden path", async () => {
    const { root, host } = await render(createElement(ChevronIcon, { direction: "left" }));
    try {
      const icon = host.querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      expect(icon?.getAttribute("focusable")).toBe("false");
      expect(icon?.getAttribute("class")).toBe("review-chevron-icon");
      expect(icon?.querySelectorAll("path")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

function headerProps(overrides: Partial<Parameters<typeof ReviewHeader>[0]> = {}) {
  return {
    projectName: "Project",
    joined: true,
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

describe("ReviewHeader", () => {
  it("does not render dock buttons and keeps the title first", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps()));
    try {
      const header = host.querySelector("header");
      expect(host.querySelector(`button[aria-label="${OUTLINER_TOGGLE_LABEL}"]`)).toBeNull();
      expect(host.querySelector(`button[aria-label="${PANEL_TOGGLE_LABEL}"]`)).toBeNull();
      expect(header?.firstElementChild?.matches("h1.review-header__title")).toBe(true);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps settings and copy buttons after joining", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps()));
    try {
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === SETTINGS_OPEN_LABEL)).toBe(true);
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === "URL をコピー")).toBe(true);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("hides settings before joining", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps({ joined: false })));
    try {
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === SETTINGS_OPEN_LABEL)).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

function FlagProbe({ name }: { name: LayoutFlagName }) {
  const [open, setOpen] = useLayoutFlag(name);
  return createElement("button", { type: "button", onClick: () => setOpen(!open) }, String(open));
}

describe("useLayoutFlag", () => {
  it("uses open by default and saves a changed flag", async () => {
    const { root, host } = await render(createElement(FlagProbe, { name: "outlinerOpen" }));
    try {
      expect(host.querySelector("button")?.textContent).toBe("true");
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      expect(host.querySelector("button")?.textContent).toBe("false");
      expect(JSON.parse(localStorage.getItem("3dreviewer:layout") ?? "null")).toEqual({ outlinerOpen: false });
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("loads a saved closed flag", async () => {
    localStorage.setItem("3dreviewer:layout", '{"panelOpen":false}');
    const { root, host } = await render(createElement(FlagProbe, { name: "panelOpen" }));
    try {
      expect(host.querySelector("button")?.textContent).toBe("false");
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

describe("dock source contracts", () => {
  const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

  it("wires saved flags, width reservations, and conditional docks", () => {
    const page = read("web/src/app/ReviewPage.tsx");
    expect(page).toContain('useLayoutFlag("outlinerOpen")');
    expect(page).toContain('useLayoutFlag("panelOpen")');
    expect(page).toContain("panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0)");
    expect(page).toContain("outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0)");
    expect(page.match(/\{outlinerOpen && \(/g)).toHaveLength(2);
    expect(page.match(/\{panelOpen && \(/g)).toHaveLength(2);
    expect(page.match(/\{!outlinerOpen && \(/g)).toHaveLength(1);
    expect(page.match(/\{!panelOpen && \(/g)).toHaveLength(1);
    expect(page).not.toContain("onToggleOutliner");
    expect(page).not.toContain("onTogglePanel");
  });

  it("orders expand and collapse controls around their contents", () => {
    const page = read("web/src/app/ReviewPage.tsx");
    expect(page.indexOf("<DockExpandButton")).toBeLessThan(page.indexOf("<ViewerHud send={realtime.send} />"));
    expect(page.indexOf("<DockExpandButton", page.indexOf("<DockExpandButton") + 1))
      .toBeGreaterThan(page.indexOf("<ViewerHud send={realtime.send} />"));
    expect(page.indexOf("<DockCollapseBar")).toBeLessThan(page.indexOf("<Outliner send={realtime.send} />"));
    expect(page.indexOf("<DockCollapseBar", page.indexOf("<DockCollapseBar") + 1))
      .toBeLessThan(page.indexOf("<PresenceList />"));
    expect(page.indexOf('className="review-panel__body"')).toBeGreaterThan(page.indexOf('className="review-panel"'));
    expect(page.indexOf('className="review-panel__body"')).toBeLessThan(page.indexOf("<PresenceList />"));
  });

  it("keeps grid columns and dock CSS contracts", () => {
    const css = read("web/src/app/review.css");
    expect(ruleBody(css, ".review-outliner")).toContain("grid-column: 1");
    expect(ruleBody(css, ".review-viewer")).toContain("grid-column: 2");
    expect(ruleBody(css, ".review-panel")).toContain("grid-column: 3");
    expect(ruleBody(css, ".review-panel")).toContain("background: var(--color-surface-subtle)");
    expect(ruleBody(css, ".review-panel__body")).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(ruleBody(css, ".review-panel__body")).toContain("overflow: auto");
    expect(ruleBody(css, ".review-dock-bar")).toContain("position: sticky");
    expect(ruleBody(css, '.review-dock-bar[data-side="outliner"]')).toContain("justify-content: flex-end");
    expect(ruleBody(css, '.review-dock-bar[data-side="panel"]')).toContain("justify-content: flex-start");
    expect(ruleBody(css, ".review-chevron-icon")).toContain("width: 1rem");
    expect(css).not.toContain(".review-header__dock");
  });

  it("uses the replacement chevron icon contract", () => {
    const icons = read("web/src/app/review-icons.tsx");
    expect(icons).toContain("CHEVRON_ICON_VIEW_BOX");
    expect(icons).toContain("CHEVRON_LEFT_PATH");
    expect(icons).toContain("CHEVRON_RIGHT_PATH");
    expect(icons).toContain("ChevronDirection");
    expect(icons).toContain("ChevronIcon");
    expect(icons).not.toContain("DOCK_LEFT_FILL_PATH");
    expect(icons).not.toContain("OutlinerDockIcon");
  });
});
