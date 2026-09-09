import { afterEach, describe, expect, it } from "vitest";
import { resetReviewStores } from "../src/app/review-stores";
import { useAnnotationStore } from "../src/store/annotation";
import { useCameraStore } from "../src/store/camera";
import { useCommentsStore } from "../src/store/comments";
import { usePresenceStore } from "../src/store/presence";
import { useSessionStore } from "../src/store/session";

const user = { id: "u1", name: "Alice", color: "#112233", camera: null };
const stroke = {
  id: "s1",
  userId: "u1",
  color: "#ff0000",
  points: [[0, 0, 0], [1, 1, 1]] as [[number, number, number], [number, number, number]],
  createdAt: 1,
};

afterEach(() => resetReviewStores());

describe("resetReviewStores", () => {
  it("resets all review stores", () => {
    useSessionStore.getState().setName("Alice");
    useSessionStore.getState().setLastError("offline");
    usePresenceStore.getState().upsertUser(user);
    useAnnotationStore.getState().addStroke(stroke);
    useAnnotationStore.getState().beginDraft([2, 2, 2]);
    useCommentsStore.getState().setLastError("failed");
    useCommentsStore.getState().setComposerAnchor([1, 2, 3]);
    useCameraStore.getState().requestCamera({ position: [1, 2, 3], target: [0, 0, 0] });

    resetReviewStores();

    expect(useSessionStore.getState()).toMatchObject({ name: "", lastError: null });
    expect(usePresenceStore.getState()).toMatchObject({ users: {}, followingUserId: null });
    expect(useAnnotationStore.getState()).toMatchObject({
      strokes: {},
      mode: "none",
      drafting: null,
      replayStrokes: [],
    });
    expect(useCommentsStore.getState()).toMatchObject({
      items: [],
      selectedId: null,
      composerAnchor: null,
      lastError: null,
    });
    expect(useCameraStore.getState()).toMatchObject({ pendingCamera: null, modelSize: 1 });
  });
});
