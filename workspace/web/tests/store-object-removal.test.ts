import { beforeEach, describe, expect, it } from "vitest";
import type { Comment, ModelVersion } from "@shared/types";
import { useCommentsStore } from "../src/store/comments";
import { latestObjectId, useObjectsStore } from "../src/store/objects";

const v1: ModelVersion = { id: "v1", projectId: "p1", number: 1, fileName: "one.glb", byteSize: 1, createdAt: 1 };
const v2: ModelVersion = { id: "v2", projectId: "p1", number: 2, fileName: "two.glb", byteSize: 2, createdAt: 2 };
const v3: ModelVersion = { id: "v3", projectId: "p1", number: 3, fileName: "three.glb", byteSize: 3, createdAt: 3 };

function comment(id: string, versionId: string): Comment {
  return {
    id,
    projectId: "p1",
    versionId,
    authorName: "Rin",
    body: id,
    anchor: [0, 0, 0],
    camera: { position: [0, 0, 1], target: [0, 0, 0] },
    strokes: [],
    status: "open",
    createdAt: Number(id.slice(1)),
    updatedAt: Number(id.slice(1)),
  };
}

beforeEach(() => {
  useObjectsStore.getState().reset();
  useCommentsStore.getState().reset();
});

describe("object and comment removal actions", () => {
  it("removes a version from objects, hidden ids, and hidden parts", () => {
    useObjectsStore.getState().setObjects([v3, v1, v2]);
    useObjectsStore.getState().setVisible("v2", false);
    useObjectsStore.getState().setPartVisible("v2", "0/1", false);
    useObjectsStore.getState().setPartVisible("v1", "0", false);

    useObjectsStore.getState().remove("v2");

    expect(useObjectsStore.getState().objects).toEqual([v1, v3]);
    expect(useObjectsStore.getState().hiddenIds).toEqual([]);
    expect(useObjectsStore.getState().hiddenParts).toEqual([{ versionId: "v1", objectPath: "0" }]);
  });

  it("removes an id that exists only in hidden ids", () => {
    useObjectsStore.getState().setVisible("orphan", false);
    useObjectsStore.getState().remove("orphan");
    expect(useObjectsStore.getState().hiddenIds).toEqual([]);
  });

  it("does not update object state when an id is absent", () => {
    useObjectsStore.getState().setObjects([v1]);
    const before = useObjectsStore.getState();
    useObjectsStore.getState().remove("missing");
    expect(useObjectsStore.getState()).toBe(before);
  });

  it("returns the id with the greatest number", () => {
    expect(latestObjectId([])).toBeNull();
    expect(latestObjectId([v1, v3, v2])).toBe("v3");
  });

  it("removes comments by version and clears only a removed selection", () => {
    useCommentsStore.getState().setAll([comment("c1", "v1"), comment("c2", "v2"), comment("c3", "v1")]);
    useCommentsStore.getState().select("c1");
    useCommentsStore.getState().removeByVersion("v1");
    expect(useCommentsStore.getState().items.map((item) => item.id)).toEqual(["c2"]);
    expect(useCommentsStore.getState().selectedId).toBeNull();

    useCommentsStore.getState().select("c2");
    useCommentsStore.getState().removeByVersion("v1");
    expect(useCommentsStore.getState().selectedId).toBe("c2");
  });

  it("does not update comment state when a version has no comments", () => {
    useCommentsStore.getState().setAll([comment("c1", "v1")]);
    const before = useCommentsStore.getState();
    useCommentsStore.getState().removeByVersion("missing");
    expect(useCommentsStore.getState()).toBe(before);
  });
});
