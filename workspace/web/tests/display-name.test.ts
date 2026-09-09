import { afterEach, describe, expect, it, vi } from "vitest";
import {
  guestName,
  loadStoredName,
  NAME_STORAGE_KEY,
  resolveDisplayName,
  saveName,
} from "../src/app/display-name";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("display name", () => {
  it("trims and limits names, and creates a guest for blank input", () => {
    expect(resolveDisplayName("  Rin  ")).toBe("Rin");
    expect(resolveDisplayName("", () => "0042")).toBe("Guest-0042");
    expect(resolveDisplayName("   ", () => "0042")).toBe("Guest-0042");
    expect(resolveDisplayName("x".repeat(60))).toHaveLength(50);
  });

  it("loads and saves the trimmed name", () => {
    saveName("  Rin  ");
    expect(loadStoredName()).toBe("Rin");

    saveName("   ");
    expect(loadStoredName()).toBe("Rin");
    expect(localStorage.getItem(NAME_STORAGE_KEY)).toBe("Rin");
  });

  it("returns an empty name when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadStoredName()).toBe("");

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveName("Rin")).not.toThrow();
  });

  it("uses the supplied guest digits", () => {
    expect(guestName(() => "1234")).toBe("Guest-1234");
  });
});
