import { beforeEach, describe, expect, it } from "vitest";
import type { Comment, Vec3 } from "@shared/types";
import { selectVisible, useCommentsStore } from "../src/store/comments";

const anchor: Vec3 = [1, 2, 3];
const camera = { position: [1, 2, 3] as Vec3, target: [0, 0, 0] as Vec3 };

function comment(id: string, createdAt: number, status: Comment["status"] = "open"): Comment {
  return {
    id,
    projectId: "p1",
    versionId: "v1",
    authorName: "Rin",
    body: id,
    anchor,
    camera,
    strokes: [],
    status,
    createdAt,
    updatedAt: createdAt,
  };
}

beforeEach(() => {
  useCommentsStore.getState().reset();
});

describe("comments store", () => {
  it("starts with the documented initial state", () => {
    expect(useCommentsStore.getState()).toMatchObject({
      items: [],
      showOnlyOpen: false,
      selectedId: null,
      composerAnchor: null,
      lastError: null,
    });
  });

  it("sorts all comments by createdAt and then id", () => {
    useCommentsStore.getState().setAll([comment("c2", 2), comment("c3", 1), comment("c1", 1)]);
    expect(useCommentsStore.getState().items.map((item) => item.id)).toEqual(["c1", "c3", "c2"]);
  });

  it("replaces existing comments and inserts new comments in order", () => {
    useCommentsStore.getState().setAll([comment("c1", 1), comment("c2", 3)]);
    useCommentsStore.getState().upsert({ ...comment("c1", 1), body: "updated" });
    expect(useCommentsStore.getState().items).toHaveLength(2);
    expect(useCommentsStore.getState().items[0]?.body).toBe("updated");
    useCommentsStore.getState().upsert(comment("c3", 2));
    expect(useCommentsStore.getState().items.map((item) => item.id)).toEqual(["c1", "c3", "c2"]);
  });

  it("selects existing ids, clears unknown ids, and does not toggle", () => {
    useCommentsStore.getState().setAll([comment("c1", 1)]);
    useCommentsStore.getState().select("c1");
    expect(useCommentsStore.getState().selectedId).toBe("c1");
    useCommentsStore.getState().select("c1");
    expect(useCommentsStore.getState().selectedId).toBe("c1");
    useCommentsStore.getState().select("nope");
    expect(useCommentsStore.getState().selectedId).toBeNull();
    useCommentsStore.getState().select("c1");
    useCommentsStore.getState().select(null);
    expect(useCommentsStore.getState().selectedId).toBeNull();
  });

  it("normalizes selection when the filter hides it", () => {
    useCommentsStore.getState().setAll([comment("c1", 1, "resolved"), comment("c2", 2)]);
    useCommentsStore.getState().select("c1");
    useCommentsStore.getState().setFilter(true);
    expect(useCommentsStore.getState()).toMatchObject({ showOnlyOpen: true, selectedId: null });

    useCommentsStore.getState().select("c2");
    expect(useCommentsStore.getState().selectedId).toBe("c2");
    useCommentsStore.getState().setFilter(true);
    expect(useCommentsStore.getState().selectedId).toBe("c2");
    useCommentsStore.getState().setFilter(false);
    expect(useCommentsStore.getState().selectedId).toBe("c2");
  });

  it("normalizes selection after upsert and retains it when all comments are shown", () => {
    useCommentsStore.getState().setAll([comment("c1", 1)]);
    useCommentsStore.getState().select("c1");
    useCommentsStore.getState().setFilter(true);
    useCommentsStore.getState().upsert(comment("c1", 1, "resolved"));
    expect(useCommentsStore.getState().selectedId).toBeNull();

    useCommentsStore.getState().setFilter(false);
    useCommentsStore.getState().select("c1");
    useCommentsStore.getState().upsert({ ...comment("c1", 1, "resolved"), body: "changed" });
    expect(useCommentsStore.getState().selectedId).toBe("c1");
  });

  it("clears selection when setAll removes the selected item", () => {
    useCommentsStore.getState().setAll([comment("c1", 1)]);
    useCommentsStore.getState().select("c1");
    useCommentsStore.getState().setAll([]);
    expect(useCommentsStore.getState().selectedId).toBeNull();
  });

  it("selects visible comments without changing their order", () => {
    const items = [comment("open", 1), comment("resolved", 2, "resolved")];
    expect(selectVisible(items, true).map((item) => item.id)).toEqual(["open"]);
    expect(selectVisible(items, false)).toEqual(items);
  });

  it("stores the composer anchor and resets all state", () => {
    useCommentsStore.getState().setComposerAnchor(anchor);
    useCommentsStore.getState().setLastError("x");
    expect(useCommentsStore.getState().composerAnchor).toEqual(anchor);
    useCommentsStore.getState().setComposerAnchor(null);
    expect(useCommentsStore.getState().composerAnchor).toBeNull();
    useCommentsStore.getState().reset();
    expect(useCommentsStore.getState()).toMatchObject({
      items: [],
      showOnlyOpen: false,
      selectedId: null,
      composerAnchor: null,
      lastError: null,
    });
  });
});
