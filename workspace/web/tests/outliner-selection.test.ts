import { afterEach, describe, expect, it } from "vitest";
import { isSelected, useSelectionStore } from "../src/features/outliner/selection";

afterEach(() => useSelectionStore.getState().reset());

describe("outliner selection", () => {
  it("selects, replaces, toggles, and clears an object", () => {
    expect(useSelectionStore.getState().selected).toBeNull();
    useSelectionStore.getState().toggleSelection({ versionId: "v1", objectId: "o1" });
    expect(useSelectionStore.getState().selected).toEqual({ versionId: "v1", objectId: "o1" });
    useSelectionStore.getState().toggleSelection({ versionId: "v1", objectId: "o1" });
    expect(useSelectionStore.getState().selected).toBeNull();
    useSelectionStore.getState().toggleSelection({ versionId: "v1", objectId: "o1" });
    useSelectionStore.getState().toggleSelection({ versionId: "v1", objectId: "o2" });
    expect(useSelectionStore.getState().selected).toEqual({ versionId: "v1", objectId: "o2" });
    useSelectionStore.getState().toggleSelection({ versionId: "v2", objectId: "o1" });
    expect(useSelectionStore.getState().selected).toEqual({ versionId: "v2", objectId: "o1" });
    useSelectionStore.getState().clear();
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().selected).toBeNull();
  });

  it("resets and checks both selection keys", () => {
    useSelectionStore.getState().toggleSelection({ versionId: "v1", objectId: "o1" });
    useSelectionStore.getState().reset();
    expect(useSelectionStore.getState().selected).toBeNull();
    expect(isSelected(null, "v1", "o1")).toBe(false);
    expect(isSelected({ versionId: "v1", objectId: "o1" }, "v1", "o1")).toBe(true);
    expect(isSelected({ versionId: "v1", objectId: "o1" }, "v1", "o2")).toBe(false);
    expect(isSelected({ versionId: "v1", objectId: "o1" }, "v2", "o1")).toBe(false);
  });
});
