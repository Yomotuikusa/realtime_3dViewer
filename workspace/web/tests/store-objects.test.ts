import { afterEach, describe, expect, it } from "vitest";
import type { ModelVersion, ObjectPartRef } from "@shared/types";
import {
  hiddenObjectPaths,
  isObjectPartVisible,
  isObjectVisible,
  primaryObjectId,
  useObjectsStore,
} from "../src/store/objects";

const v1: ModelVersion = { id: "v1", projectId: "p1", number: 1, fileName: "one.glb", byteSize: 1, createdAt: 1 };
const v2: ModelVersion = { id: "v2", projectId: "p1", number: 2, fileName: "two.glb", byteSize: 2, createdAt: 2 };
const v3: ModelVersion = { id: "v3", projectId: "p1", number: 3, fileName: "three.glb", byteSize: 3, createdAt: 3 };

afterEach(() => useObjectsStore.getState().reset());

describe("objects store", () => {
  it("sorts and clones objects while preserving hidden ids", () => {
    useObjectsStore.getState().setVisible("v2", false);
    const versions = [v2, v1];
    useObjectsStore.getState().setObjects(versions);

    expect(useObjectsStore.getState().objects).toEqual([v1, v2]);
    expect(useObjectsStore.getState().objects).not.toBe(versions);
    expect(useObjectsStore.getState().objects[0]).not.toBe(v1);
    expect(useObjectsStore.getState().hiddenIds).toEqual(["v2"]);
  });

  it("appends in number order and ignores duplicate ids without changing state", () => {
    useObjectsStore.getState().setObjects([v1, v3]);
    useObjectsStore.getState().append(v2);
    expect(useObjectsStore.getState().objects).toEqual([v1, v2, v3]);

    const before = useObjectsStore.getState();
    useObjectsStore.getState().append(v1);
    expect(useObjectsStore.getState()).toBe(before);
  });

  it("changes visibility only when needed", () => {
    useObjectsStore.getState().setVisible("v1", false);
    expect(useObjectsStore.getState().hiddenIds).toEqual(["v1"]);
    const hiddenState = useObjectsStore.getState();
    useObjectsStore.getState().setVisible("v1", false);
    expect(useObjectsStore.getState()).toBe(hiddenState);
    useObjectsStore.getState().setVisible("v1", true);
    expect(useObjectsStore.getState().hiddenIds).toEqual([]);
    const visibleState = useObjectsStore.getState();
    useObjectsStore.getState().setVisible("nope", true);
    expect(useObjectsStore.getState()).toBe(visibleState);
  });

  it("changes part visibility only when needed and preserves insertion order", () => {
    expect(useObjectsStore.getState().hiddenParts).toEqual([]);
    useObjectsStore.getState().setPartVisible("v1", "0/1", false);
    expect(useObjectsStore.getState().hiddenParts).toEqual([{ versionId: "v1", objectPath: "0/1" }]);
    const hiddenState = useObjectsStore.getState();
    useObjectsStore.getState().setPartVisible("v1", "0/1", false);
    expect(useObjectsStore.getState()).toBe(hiddenState);

    useObjectsStore.getState().setPartVisible("v1", "2", false);
    useObjectsStore.getState().setPartVisible("v1", "0/1", true);
    expect(useObjectsStore.getState().hiddenParts).toEqual([{ versionId: "v1", objectPath: "2" }]);
    const visibleState = useObjectsStore.getState();
    useObjectsStore.getState().setPartVisible("v1", "0/1", true);
    expect(useObjectsStore.getState()).toBe(visibleState);

    useObjectsStore.getState().setPartVisible("v2", "0/1", false);
    expect(useObjectsStore.getState().hiddenParts).toEqual([
      { versionId: "v1", objectPath: "2" },
      { versionId: "v2", objectPath: "0/1" },
    ]);
  });

  it("replaces welcome hidden ids, removes duplicates, and resets", () => {
    const welcomeParts: ObjectPartRef[] = [
      { versionId: "v1", objectPath: "0" },
      { versionId: "v1", objectPath: "0" },
      { versionId: "v2", objectPath: "1" },
    ];
    useObjectsStore.getState().applyWelcome(["v2", "v1", "v2"], welcomeParts);
    expect(useObjectsStore.getState().hiddenIds).toEqual(["v2", "v1"]);
    expect(useObjectsStore.getState().hiddenParts).toEqual([
      { versionId: "v1", objectPath: "0" },
      { versionId: "v2", objectPath: "1" },
    ]);
    const welcomeState = useObjectsStore.getState();
    useObjectsStore.getState().applyWelcome(["v2", "v1", "v2"], welcomeParts);
    expect(useObjectsStore.getState()).toBe(welcomeState);
    welcomeParts[0]!.objectPath = "changed";
    expect(useObjectsStore.getState().hiddenParts[0]).toEqual({ versionId: "v1", objectPath: "0" });

    useObjectsStore.getState().applyWelcome([]);
    expect(useObjectsStore.getState().hiddenParts).toEqual([]);
    useObjectsStore.getState().setObjects([v1]);
    useObjectsStore.getState().setPartVisible("v1", "0", false);
    useObjectsStore.getState().setObjects([v1]);
    expect(useObjectsStore.getState().hiddenParts).toEqual([{ versionId: "v1", objectPath: "0" }]);
    useObjectsStore.getState().reset();
    expect(useObjectsStore.getState()).toMatchObject({ objects: [], hiddenIds: [], hiddenParts: [] });
  });

  it("provides visibility, part paths, and primary object helpers", () => {
    expect(isObjectVisible(["v1"], "v1")).toBe(false);
    expect(isObjectVisible(["v1"], "v2")).toBe(true);
    const hiddenParts: ObjectPartRef[] = [
      { versionId: "v1", objectPath: "2" },
      { versionId: "v2", objectPath: "0" },
      { versionId: "v1", objectPath: "0/1" },
    ];
    expect(isObjectPartVisible(hiddenParts, "v1", "0/1")).toBe(false);
    expect(isObjectPartVisible(hiddenParts, "v1", "0/2")).toBe(true);
    expect(isObjectPartVisible(hiddenParts, "v2", "0/1")).toBe(true);
    expect(hiddenObjectPaths(hiddenParts, "v1")).toEqual(["2", "0/1"]);
    expect(hiddenObjectPaths(hiddenParts, "v3")).toEqual([]);
    expect(primaryObjectId([v3, v1, v2])).toBe("v1");
    expect(primaryObjectId([])).toBeNull();
  });
});
