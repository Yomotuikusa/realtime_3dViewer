import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewHeader } from "../src/app/ReviewHeader";
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

function headerProps(overrides: Partial<Parameters<typeof ReviewHeader>[0]> = {}) {
  return {
    projectName: "Project",
    joined: true,
    onOpenSettings: vi.fn(),
    outlinerOpen: true,
    panelOpen: true,
    onToggleOutliner: vi.fn(),
    onTogglePanel: vi.fn(),
    ...overrides,
  };
}

describe("ReviewHeader dock toggles", () => {
  it("renders labelled pressed buttons while open", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps()));
    try {
      for (const label of [OUTLINER_TOGGLE_LABEL, PANEL_TOGGLE_LABEL]) {
        const button = host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
        expect(button).not.toBeNull();
        expect(button?.getAttribute("aria-pressed")).toBe("true");
        expect(button?.type).toBe("button");
        expect(button?.classList.contains("review-header__dock")).toBe(true);
      }
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("renders unpressed buttons while closed", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps({
      outlinerOpen: false,
      panelOpen: false,
    })));
    try {
      expect(host.querySelector(`button[aria-label="${OUTLINER_TOGGLE_LABEL}"]`)?.getAttribute("aria-pressed")).toBe("false");
      expect(host.querySelector(`button[aria-label="${PANEL_TOGGLE_LABEL}"]`)?.getAttribute("aria-pressed")).toBe("false");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("calls only the matching toggle callback", async () => {
    const onToggleOutliner = vi.fn();
    const onTogglePanel = vi.fn();
    const { root, host } = await render(createElement(ReviewHeader, headerProps({ onToggleOutliner, onTogglePanel })));
    try {
      await act(async () => (host.querySelector(`button[aria-label="${OUTLINER_TOGGLE_LABEL}"]`) as HTMLButtonElement).click());
      expect(onToggleOutliner).toHaveBeenCalledTimes(1);
      expect(onTogglePanel).not.toHaveBeenCalled();
      await act(async () => (host.querySelector(`button[aria-label="${PANEL_TOGGLE_LABEL}"]`) as HTMLButtonElement).click());
      expect(onTogglePanel).toHaveBeenCalledTimes(1);
      expect(onToggleOutliner).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps both toggles available before joining", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps({ joined: false })));
    try {
      expect(host.querySelector(`button[aria-label="${OUTLINER_TOGGLE_LABEL}"]`)).not.toBeNull();
      expect(host.querySelector(`button[aria-label="${PANEL_TOGGLE_LABEL}"]`)).not.toBeNull();
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === SETTINGS_OPEN_LABEL)).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("places the toggles at the required header positions", async () => {
    const { root, host } = await render(createElement(ReviewHeader, headerProps()));
    try {
      const header = host.querySelector("header");
      const outlinerButton = host.querySelector(`button[aria-label="${OUTLINER_TOGGLE_LABEL}"]`);
      const panelButton = host.querySelector(`button[aria-label="${PANEL_TOGGLE_LABEL}"]`);
      const settingsButton = [...host.querySelectorAll("button")]
        .find((button) => button.textContent === SETTINGS_OPEN_LABEL);
      expect(header?.firstElementChild).toBe(outlinerButton);
      expect(settingsButton?.compareDocumentPosition(panelButton as Node)
        && (settingsButton!.compareDocumentPosition(panelButton as Node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
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

describe("dock toggle source contracts", () => {
  const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

  it("wires layout flags, width reservations, and conditional docks", () => {
    const page = read("web/src/app/ReviewPage.tsx");
    expect(page).toContain('useLayoutFlag("outlinerOpen")');
    expect(page).toContain('useLayoutFlag("panelOpen")');
    expect(page).toContain("panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0)");
    expect(page).toContain("outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0)");
    expect(page.match(/\{outlinerOpen && \(/g)).toHaveLength(2);
    expect(page.match(/\{panelOpen && \(/g)).toHaveLength(2);
    expect(page).toContain("onToggleOutliner=");
    expect(page).toContain("onTogglePanel=");
  });

  it("assigns fixed grid columns and dock icon dimensions", () => {
    const css = read("web/src/app/review.css");
    expect(ruleBody(css, ".review-outliner")).toContain("grid-column: 1");
    expect(ruleBody(css, ".review-viewer")).toContain("grid-column: 2");
    expect(ruleBody(css, ".review-panel")).toContain("grid-column: 3");
    expect(ruleBody(css, ".review-header__dock-icon")).toContain("width: 1rem");
  });

  it("uses the matching left and right SVG fills", () => {
    const icons = read("web/src/app/review-icons.tsx");
    expect(icons).toMatch(/OutlinerDockIcon[\s\S]*DOCK_LEFT_FILL_PATH/);
    expect(icons).toMatch(/PanelDockIcon[\s\S]*DOCK_RIGHT_FILL_PATH/);
    expect(icons.match(/aria-hidden="true"/g)).toHaveLength(2);
  });
});
