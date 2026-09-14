import { beforeEach, describe, expect, it } from "vitest";
import { dispatchServerMessage } from "../src/app/realtime-dispatch";
import { useCommentsStore } from "../src/store/comments";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";

beforeEach(() => {
  useCommentsStore.getState().reset();
  useDisplayStore.getState().reset();
  useObjectsStore.getState().reset();
});

describe("object removal realtime dispatch", () => {
  it("applies object:removed through the shared removal flow", () => {
    const version = {
      id: "v1",
      projectId: "p1",
      number: 1,
      fileName: "one.glb",
      byteSize: 1,
      createdAt: 1,
    };
    useObjectsStore.getState().setObjects([version]);
    useObjectsStore.getState().setVisible("v1", false);
    useCommentsStore.getState().setComposerAnchor([0, 0, 0]);

    dispatchServerMessage({ type: "object:removed", versionId: "v1" });

    expect(useObjectsStore.getState().objects).toEqual([]);
    expect(useObjectsStore.getState().hiddenIds).toEqual([]);
    expect(useCommentsStore.getState().composerAnchor).toBeNull();
  });
});
