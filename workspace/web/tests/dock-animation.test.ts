/// <reference types="node" />

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOCK_ANIMATION_MS,
  DOCK_ANIMATION_RELEASE_MS,
  useDockAnimation as useDockAnimationHook,
} from "../src/features/layout/useDockAnimation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type SetOpen = (open: boolean) => void;
type Rendered = { root: ReturnType<typeof createRoot>; host: HTMLDivElement };

function AnimationProbe({ setOpen }: { setOpen: SetOpen }): ReturnType<typeof createElement> {
  const [animating, toggle] = useDockAnimationHook();
  return createElement("button", {
    "data-animating": String(animating),
    onClick: () => toggle(setOpen, false),
  });
}

async function render(setOpen: SetOpen): Promise<Rendered> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(AnimationProbe, { setOpen })));
  return { root, host };
}

function animating(host: HTMLDivElement): boolean {
  return host.querySelector("button")?.dataset.animating === "true";
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function ruleBody(text: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const rulePattern = "(?:^|})\\s*(?:/\\*[\\s\\S]*?\\*/\\s*)*" + escapedSelector + "\\s*\\{([^{}]*)\\}";
  return text.match(new RegExp(rulePattern))?.[1] ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("useDockAnimation", () => {
  it("starts idle and toggles the open state once", async () => {
    const setOpen = vi.fn();
    const { root, host } = await render(setOpen);
    try {
      expect(animating(host)).toBe(false);
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      expect(animating(host)).toBe(true);
      expect(setOpen).toHaveBeenCalledTimes(1);
      expect(setOpen).toHaveBeenCalledWith(false);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("releases the animation flag at the end of the release wait", async () => {
    const { root, host } = await render(vi.fn());
    try {
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      await act(async () => vi.advanceTimersByTime(DOCK_ANIMATION_RELEASE_MS - 1));
      expect(animating(host)).toBe(true);
      await act(async () => vi.advanceTimersByTime(1));
      expect(animating(host)).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("extends the wait when toggled again", async () => {
    const { root, host } = await render(vi.fn());
    try {
      const button = host.querySelector("button") as HTMLButtonElement;
      await act(async () => button.click());
      await act(async () => vi.advanceTimersByTime(100));
      await act(async () => button.click());
      await act(async () => vi.advanceTimersByTime(DOCK_ANIMATION_RELEASE_MS - 100));
      expect(animating(host)).toBe(true);
      await act(async () => vi.advanceTimersByTime(100));
      expect(animating(host)).toBe(false);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("cleans up the timer when unmounted", async () => {
    const { root, host } = await render(vi.fn());
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the documented duration constants", () => {
    expect(DOCK_ANIMATION_MS).toBe(200);
    expect(DOCK_ANIMATION_RELEASE_MS).toBeGreaterThan(DOCK_ANIMATION_MS);
  });
});

describe("dock animation source contracts", () => {
  it("registers the duration token and typed width properties", () => {
    const tokens = read("web/src/styles/tokens.css");
    const root = tokens.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(root).toContain("--duration-medium: 200ms");
    expect(tokens.indexOf("@property --outliner-width")).toBeGreaterThan(tokens.indexOf(root));
    expect(tokens).toMatch(/@property --outliner-width\s*\{[^}]*syntax:\s*"<length>";[^}]*inherits:\s*true;/s);
    expect(tokens).toMatch(/@property --panel-width\s*\{[^}]*syntax:\s*"<length>";[^}]*inherits:\s*true;/s);
    expect(tokens).toMatch(/--panel-width:\s*22rem/);
    expect(tokens).toMatch(/--outliner-width:\s*16rem/);
  });

  it("limits width transitions to the dock animation state", () => {
    const css = read("web/src/app/review.css");
    const animated = ruleBody(css, '.review-body[data-dock-animating="true"]');
    expect(animated).toContain("transition");
    expect(animated).toContain("--outliner-width");
    expect(animated).toContain("--panel-width");
    expect(animated).toContain("var(--duration-medium)");
    expect(ruleBody(css, ".review-body")).not.toContain("transition");
  });

  it("delays the HUD expand button until the column is closed", () => {
    const css = read("web/src/app/review-dock.css");
    const expand = ruleBody(css, ".review-hud .review-dock-expand");
    expect(expand).toContain("review-dock-expand-in");
    expect(expand).toContain("var(--duration-medium)");
    expect(expand).toContain("backwards");
    expect(css).toContain("@keyframes review-dock-expand-in");
    expect(css).toContain("opacity: 0");
    expect(css).toContain("opacity: 1");
  });

  it("connects every dock toggle to the animation hook", () => {
    const page = read("web/src/app/ReviewPage.tsx");
    expect(page).toContain("useDockAnimation()");
    expect(page).toContain("data-dock-animating={dockAnimating}");
    expect(page.match(/toggleDock\(setOutlinerOpen, open\)/g)).toHaveLength(1);
    expect(page.match(/toggleDock\(setPanelOpen, open\)/g)).toHaveLength(1);
    expect(page.match(/toggleDock\(setOutlinerOpen, true\)/g)).toHaveLength(1);
    expect(page.match(/toggleDock\(setPanelOpen, true\)/g)).toHaveLength(1);
    expect(page).not.toContain("onToggle={setOutlinerOpen}");
    expect(page).not.toContain("onToggle={setPanelOpen}");
  });
});
