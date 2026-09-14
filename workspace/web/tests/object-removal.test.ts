import { beforeEach, describe, expect, it } from "vitest";
import type { ModelVersion } from "@shared/types";
import { applyObjectRemoved } from "../src/app/object-removal";
import { useSelectionStore } from "../src/features/outliner/selection";
import { useCommentsStore } from "../src/store/comments";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";

const v1: ModelVersion = { id: "v1", projectId: "p1", number: 1, fileName: "one.glb", byteSize: 1, createdAt: 1 };
const v2: ModelVersion = { id: "v2", projectId: "p1", number: 2, fileName: "two.glb", byteSize: 2, createdAt: 2 };

beforeEach(() => {
  useCommentsStore.getState().reset();
  useDisplayStore.getState().reset();
  useObjectsStore.getState().reset();
  useSelectionStore.getState().reset();
});

describe("applyObjectRemoved", () => {
  it("clears a selected version and removes its related state", () => {
    useObjectsStore.getState().setObjects([v1, v2]);
    useObjectsStore.getState().setVisible("v2", false);
    useSelectionStore.getState().select({ versionId: "v2", objectId: "mesh" });
    useDisplayStore.getState().setMeshCompare({ baseId: "v1", targetId: "v2", thresholdPermille: 50 });
    useDisplayStore.getState().setPlaybackSource("v2");

    applyObjectRemoved("v2");

    expect(useObjectsStore.getState().objects).toEqual([v1]);
    expect(useObjectsStore.getState().hiddenIds).toEqual([]);
    expect(useSelectionStore.getState().selected).toBeNull();
    expect(useDisplayStore.getState().meshCompare).toEqual({ baseId: "v1", targetId: null, thresholdPermille: 50 });
    expect(useDisplayStore.getState().playbackSource).toBeNull();
  });

  it("keeps selection and playback source for another version", () => {
    useObjectsStore.getState().setObjects([v1, v2]);
    useSelectionStore.getState().select({ versionId: "v1", objectId: "mesh" });
    useDisplayStore.getState().setPlaybackSource("v1");

    applyObjectRemoved("v2");

    expect(useSelectionStore.getState().selected).toEqual({ versionId: "v1", objectId: "mesh" });
    expect(useDisplayStore.getState().playbackSource).toBe("v1");
  });

  it("clears the composer anchor when the last object is removed", () => {
    useObjectsStore.getState().setObjects([v1]);
    useCommentsStore.getState().setComposerAnchor([1, 2, 3]);

    applyObjectRemoved("v1");

    expect(useObjectsStore.getState().objects).toEqual([]);
    expect(useCommentsStore.getState().composerAnchor).toBeNull();
  });

  it("is idempotent for a repeated removal", () => {
    useObjectsStore.getState().setObjects([v1]);
    applyObjectRemoved("v1");
    const objects = useObjectsStore.getState();
    const comments = useCommentsStore.getState();
    const display = useDisplayStore.getState();
    const selection = useSelectionStore.getState();

    expect(() => applyObjectRemoved("v1")).not.toThrow();
    expect(useObjectsStore.getState()).toBe(objects);
    expect(useCommentsStore.getState()).toBe(comments);
    expect(useDisplayStore.getState()).toBe(display);
    expect(useSelectionStore.getState()).toBe(selection);
  });
});
