/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App";
import { ThemeEffect } from "../src/features/theme/ThemeEffect";
import { useThemeStore } from "../src/store/theme";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type ChangeHandler = (event: MediaQueryListEvent) => void;

function setMatchMedia(matches: boolean, includeSubscription = true): {
  media: { matches: boolean; addEventListener?: ReturnType<typeof vi.fn>; removeEventListener?: ReturnType<typeof vi.fn> };
  emit: (nextMatches: boolean) => void;
} {
  let handler: ChangeHandler | undefined;
  const media = {
    matches,
    ...(includeSubscription
      ? {
          addEventListener: vi.fn((_type: string, nextHandler: ChangeHandler) => { handler = nextHandler; }),
          removeEventListener: vi.fn(),
        }
      : {}),
  };
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => media) });
  return {
    media,
    emit(nextMatches) {
      media.matches = nextMatches;
      handler?.({ matches: nextMatches } as MediaQueryListEvent);
    },
  };
}

async function render(element: React.ReactElement): Promise<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { root, host };
}

const appSourceUrl = new URL("../src/app/App.tsx", import.meta.url);
const appSourcePath = appSourceUrl.protocol === "file:"
  ? fileURLToPath(appSourceUrl)
  : join(process.cwd(), "web", "src/app/App.tsx");

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  useThemeStore.getState().setMode("light");
  useThemeStore.getState().setPrefersDark(false);
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
});

describe("ThemeEffect", () => {
  it("sets a theme even when matchMedia is unavailable", async () => {
    const { root } = await render(createElement(ThemeEffect));
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => root.unmount());
  });

  it("applies explicit light and dark modes and reacts to mode changes", async () => {
    const { root } = await render(createElement(ThemeEffect));
    try {
      expect(document.documentElement.dataset.theme).toBe("light");
      await act(async () => useThemeStore.getState().setMode("dark"));
      expect(document.documentElement.dataset.theme).toBe("dark");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("reads and subscribes to the system preference", async () => {
    const query = setMatchMedia(true);
    useThemeStore.getState().setMode("system");
    const { root } = await render(createElement(ThemeEffect));
    try {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(useThemeStore.getState().prefersDark).toBe(true);
      query.emit(false);
      await act(async () => undefined);
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(useThemeStore.getState().prefersDark).toBe(false);
    } finally {
      await act(async () => root.unmount());
      expect(query.media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
      const handler = query.media.removeEventListener?.mock.calls[0]?.[1];
      expect(handler).toBe(query.media.addEventListener?.mock.calls[0]?.[1]);
    }
  });

  it("updates only the preference when an explicit mode receives a change", async () => {
    const query = setMatchMedia(false);
    const { root } = await render(createElement(ThemeEffect));
    try {
      query.emit(true);
      await act(async () => undefined);
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(useThemeStore.getState().prefersDark).toBe(true);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("keeps the initial preference when media cannot be subscribed", async () => {
    const query = setMatchMedia(true, false);
    useThemeStore.getState().setMode("system");
    const { root } = await render(createElement(ThemeEffect));
    try {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(useThemeStore.getState().prefersDark).toBe(true);
      expect(query.media.addEventListener).toBeUndefined();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("continues applying the theme when matchMedia throws", async () => {
    useThemeStore.getState().setMode("dark");
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => { throw new Error("blocked"); }) });
    const { root } = await render(createElement(ThemeEffect));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await act(async () => root.unmount());
  });
});

describe("App theme placement", () => {
  it("renders the theme effect once around the upload and not-found routes", async () => {
    const source = readFileSync(appSourcePath, "utf8");
    expect(source.match(/<ThemeEffect\s*\/>/g)).toHaveLength(1);

    const upload = await render(createElement(App));
    try {
      expect(upload.host.querySelector(".upload")).not.toBeNull();
      expect(document.documentElement.dataset.theme).toBe("light");
    } finally {
      await act(async () => upload.root.unmount());
    }

    window.history.replaceState({}, "", "/unknown");
    const notFound = await render(createElement(App));
    try {
      expect(notFound.host.querySelector(".upload--message")).not.toBeNull();
      expect(notFound.host.querySelector("a[href='/']")).not.toBeNull();
    } finally {
      await act(async () => notFound.root.unmount());
    }
  });
});
