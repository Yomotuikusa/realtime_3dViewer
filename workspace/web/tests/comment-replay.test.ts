import { beforeEach, describe, expect, it } from "vitest";
import type { CameraState, Comment, Stroke } from "@shared/types";
import { cameraEquals } from "@shared/camera";
import { applyCommentReplay, REPLAY_OPACITY } from "../src/features/comments/replay";
import { useAnnotationStore } from "../src/store/annotation";
import { useCameraStore } from "../src/store/camera";
import { usePresenceStore } from "../src/store/presence";

const camera: CameraState = { position: [1, 2, 3], target: [0, 1, 0] };
const otherCamera: CameraState = { position: [4, 5, 6], target: [1, 0, -1] };
const strokeA: Stroke = {
  id: "stroke-a",
  userId: "author",
  color: "#ff0000",
  points: [[0, 0, 0], [1, 1, 1]],
  createdAt: 1,
};
const strokeB: Stroke = {
  id: "stroke-b",
  userId: "author",
  color: "#00ff00",
  points: [[1, 0, 0], [1, 1, 0]],
  createdAt: 2,
};

function comment(id: string, commentCamera: CameraState, strokes: Stroke[]): Comment {
  return {
    id,
    projectId: "project",
    versionId: "version",
    authorName: "Reviewer",
    body: `Comment ${id}`,
    anchor: [0, 0, 0],
    camera: commentCamera,
    strokes,
    status: "open",
    createdAt: 1,
    updatedAt: 1,
  };
}

const firstComment = comment("first", camera, [strokeA, strokeB]);
const secondComment = comment("second", otherCamera, [strokeB]);

beforeEach(() => {
  useAnnotationStore.getState().reset();
  useCameraStore.getState().reset();
  usePresenceStore.getState().reset();
});

describe("applyCommentReplay", () => {
  it("queues a cloned camera and replaces replay strokes", () => {
    applyCommentReplay(firstComment);

    const pending = useCameraStore.getState().consumePendingCamera();
    expect(pending).not.toBeNull();
    expect(pending).not.toBe(firstComment.camera);
    expect(cameraEquals(pending!, firstComment.camera)).toBe(true);
    expect(useAnnotationStore.getState().replayStrokes).toEqual([strokeA, strokeB]);
  });

  it("unfollows immediately while replaying a comment", () => {
    usePresenceStore.getState().upsertUser({ id: "a", name: "Alice", color: "#112233", camera: null });
    usePresenceStore.getState().follow("a");

    applyCommentReplay(firstComment);

    expect(usePresenceStore.getState().followingUserId).toBeNull();
  });

  it("clears replay strokes without queuing a camera when deselected", () => {
    applyCommentReplay(firstComment);
    expect(useCameraStore.getState().consumePendingCamera()).not.toBeNull();

    applyCommentReplay(null);

    expect(useAnnotationStore.getState().replayStrokes).toEqual([]);
    expect(useCameraStore.getState().pendingCamera).toBeNull();
  });

  it("does not change camera or presence when no comment is selected", () => {
    const cameraBefore = useCameraStore.getState();
    const presenceBefore = usePresenceStore.getState();

    expect(() => applyCommentReplay(null)).not.toThrow();

    expect(useCameraStore.getState()).toBe(cameraBefore);
    expect(usePresenceStore.getState()).toBe(presenceBefore);
    expect(useAnnotationStore.getState().replayStrokes).toEqual([]);
  });

  it("uses the latest camera and strokes for consecutive selections", () => {
    applyCommentReplay(firstComment);
    applyCommentReplay(secondComment);

    const pending = useCameraStore.getState().pendingCamera;
    expect(pending).not.toBeNull();
    expect(cameraEquals(pending!, secondComment.camera)).toBe(true);
    expect(useAnnotationStore.getState().replayStrokes).toEqual([strokeB]);
  });

  it("keeps live strokes separate from replay strokes", () => {
    useAnnotationStore.getState().addStroke(strokeA);

    applyCommentReplay(firstComment);

    expect(useAnnotationStore.getState().strokes).toEqual({ [strokeA.id]: strokeA });
    expect(useAnnotationStore.getState().replayStrokes).toEqual([strokeA, strokeB]);
  });

  it("uses the documented replay opacity", () => {
    expect(REPLAY_OPACITY).toBe(0.6);
  });
});
