import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadRecordFrame,
  RECORD_FRAME_STORAGE_KEY,
  saveRecordFrame,
} from "../src/features/comments/frame-switch";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("comment frame recording switch", () => {
  it("defaults to enabled when nothing is saved", () => {
    expect(loadRecordFrame()).toBe(true);
  });

  it("saves and loads false", () => {
    saveRecordFrame(false);
    expect(localStorage.getItem(RECORD_FRAME_STORAGE_KEY)).toBe("false");
    expect(loadRecordFrame()).toBe(false);
  });

  it("saves and loads true", () => {
    saveRecordFrame(true);
    expect(localStorage.getItem(RECORD_FRAME_STORAGE_KEY)).toBe("true");
    expect(loadRecordFrame()).toBe(true);
  });

  it("treats invalid saved values as enabled", () => {
    localStorage.setItem(RECORD_FRAME_STORAGE_KEY, "maybe");
    expect(loadRecordFrame()).toBe(true);
  });

  it("does not leak read errors", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(loadRecordFrame()).toBe(true);
  });

  it("does not leak write errors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(() => saveRecordFrame(false)).not.toThrow();
  });
});
