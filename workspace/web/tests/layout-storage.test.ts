import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLayoutSize, LAYOUT_STORAGE_KEY, saveLayoutSize } from "../src/features/layout/layout-storage";

describe("layout storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when storage is empty or malformed", () => {
    expect(loadLayoutSize("panelWidth")).toBeNull();
    for (const value of ["{", "null", "[]", "5", '"x"', '{"panelWidth":"400"}', '{"panelWidth":null}', '{"panelWidth":1e999}']) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, value);
      expect(loadLayoutSize("panelWidth")).toBeNull();
    }
  });

  it("loads only finite numeric values for the requested name", () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, '{"panelWidth":400}');
    expect(loadLayoutSize("panelWidth")).toBe(400);
    expect(loadLayoutSize("timelineHeight")).toBeNull();
  });

  it("preserves other saved layout sizes", () => {
    saveLayoutSize("panelWidth", 400);
    saveLayoutSize("timelineHeight", 64);
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "null")).toEqual({ panelWidth: 400, timelineHeight: 64 });
    expect(loadLayoutSize("panelWidth")).toBe(400);
    expect(loadLayoutSize("timelineHeight")).toBe(64);
  });

  it("stores the outliner width independently", () => {
    saveLayoutSize("outlinerWidth", 300);
    expect(loadLayoutSize("outlinerWidth")).toBe(300);
    expect(loadLayoutSize("panelWidth")).toBeNull();
  });

  it("preserves panel width when saving the outliner width", () => {
    saveLayoutSize("panelWidth", 400);
    saveLayoutSize("outlinerWidth", 300);
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "null")).toEqual({ panelWidth: 400, outlinerWidth: 300 });
  });

  it("replaces malformed stored data and tolerates storage exceptions", () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, "{");
    saveLayoutSize("panelWidth", 400);
    expect(loadLayoutSize("panelWidth")).toBe(400);

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveLayoutSize("panelWidth", 500)).not.toThrow();
    setItem.mockRestore();
  });
});
