import { beforeEach, describe, expect, it } from "vitest";
import { resetReviewStores } from "../src/app/review-stores";
import { prefersDarkScheme } from "../src/features/theme/theme-mode";
import { loadTheme } from "../src/features/theme/theme-storage";
import { selectResolvedTheme, selectViewerColor, selectViewerColors, useThemeStore } from "../src/store/theme";

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ mode: "system", prefersDark: prefersDarkScheme(), colors: {} });
});

describe("theme store", () => {
  it("starts with local OS state and does not belong to review reset", () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe("system");
    expect(state.colors).toEqual({});
    expect(state.prefersDark).toBe(prefersDarkScheme());
    state.setMode("dark");
    state.setColor("joint", "#ff0000");
    resetReviewStores();
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(useThemeStore.getState().colors).toEqual({ joint: "#ff0000" });
  });

  it("persists mode and colors while suppressing no-op updates", () => {
    const initial = useThemeStore.getState();
    initial.setMode("system");
    expect(useThemeStore.getState()).toBe(initial);
    initial.setMode("dark");
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(loadTheme().mode).toBe("dark");
    useThemeStore.getState().setMode("light");

    const beforeColor = useThemeStore.getState().colors;
    useThemeStore.getState().setColor("selection", "zz");
    expect(useThemeStore.getState().colors).toBe(beforeColor);
    useThemeStore.getState().setColor("selection", "#f97316");
    expect(useThemeStore.getState().colors).toBe(beforeColor);
    useThemeStore.getState().setColor("selection", "#FF0000");
    expect(useThemeStore.getState().colors).toEqual({ selection: "#ff0000" });
    expect(useThemeStore.getState().colors).not.toBe(beforeColor);
    expect(loadTheme().colors).toEqual({ selection: "#ff0000" });
  });

  it("removes defaults and resets one or all overrides", () => {
    useThemeStore.getState().setColor("selection", "#ff0000");
    useThemeStore.getState().setColor("joint", "#ff0000");
    const withOverrides = useThemeStore.getState().colors;
    useThemeStore.getState().setColor("selection", "#f97316");
    expect(useThemeStore.getState().colors).toEqual({ joint: "#ff0000" });
    expect(useThemeStore.getState().colors).not.toBe(withOverrides);
    useThemeStore.getState().resetColor("selection");
    expect(loadTheme().colors).toEqual({ joint: "#ff0000" });
    const beforeNoop = useThemeStore.getState();
    beforeNoop.resetColor("selection");
    expect(useThemeStore.getState()).toBe(beforeNoop);
    useThemeStore.getState().resetColors();
    expect(useThemeStore.getState().colors).toEqual({});
    expect(loadTheme().colors).toEqual({});
    const beforeReset = useThemeStore.getState();
    beforeReset.resetColors();
    expect(useThemeStore.getState()).toBe(beforeReset);
    expect(useThemeStore.getState().mode).toBe("system");
  });

  it("updates OS preference without persistence and resolves selectors", () => {
    useThemeStore.getState().setPrefersDark(true);
    expect(useThemeStore.getState().prefersDark).toBe(true);
    expect(loadTheme()).toEqual({ mode: "system", colors: {} });
    const before = useThemeStore.getState();
    before.setPrefersDark(true);
    expect(useThemeStore.getState()).toBe(before);

    const state = useThemeStore.getState();
    expect(selectResolvedTheme(state)).toBe("dark");
    expect(selectViewerColor("joint")(state)).toBe("#22d3ee");
    state.setColor("selection", "#ff0000");
    const colors = selectViewerColors(useThemeStore.getState());
    expect(Object.keys(colors)).toHaveLength(11);
    expect(colors.selection).toBe("#ff0000");
  });
});
