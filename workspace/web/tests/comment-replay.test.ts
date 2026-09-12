import { beforeEach, describe, expect, it } from "vitest";
import type { CameraState, Comment, CommentPlayback, Stroke } from "@shared/types";
import { cameraEquals } from "@shared/camera";
import { applyCommentPlayback, applyCommentReplay, REPLAY_OPACITY } from "../src/features/comments/replay";
import { useAnnotationStore } from "../src/store/annotation";
import { useCameraStore } from "../src/store/camera";
import { usePresenceStore } from "../src/store/presence";
import { usePlaybackStore } from "../src/store/playback";

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

function comment(id: string, commentCamera: CameraState, strokes: Stroke[], playback?: CommentPlayback): Comment {
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
    ...(playback === undefined ? {} : { playback }),
  };
}

const firstComment = comment("first", camera, [strokeA, strokeB]);
const secondComment = comment("second", otherCamera, [strokeB]);

beforeEach(() => {
  useAnnotationStore.getState().reset();
  useCameraStore.getState().reset();
  usePresenceStore.getState().reset();
  usePlaybackStore.getState().reset();
});

describe("applyCommentPlayback", () => {
  beforeEach(() => {
    usePlaybackStore.getState().setClips([{ name: "a", duration: 2 }, { name: "b", duration: 4 }], 24);
  });

  it("pauses, selects the clip, and seeks to the recorded frame", () => {
    usePlaybackStore.getState().play();
    expect(applyCommentPlayback({ clipIndex: 1, frame: 48 })).toBe(true);
    expect(usePlaybackStore.getState()).toMatchObject({ playing: false, clipIndex: 1, time: 2 });
  });

  it("clamps a recorded frame to the selected clip duration", () => {
    expect(applyCommentPlayback({ clipIndex: 0, frame: 96 })).toBe(true);
    expect(usePlaybackStore.getState().time).toBe(2);
  });

  it("does not change playback for an out-of-range clip", () => {
    usePlaybackStore.getState().selectClip(1);
    usePlaybackStore.getState().seek(1.5);
    usePlaybackStore.getState().play();
    const before = usePlaybackStore.getState();
    expect(applyCommentPlayback({ clipIndex: 5, frame: 0 })).toBe(false);
    expect(usePlaybackStore.getState()).toMatchObject({
      clipIndex: before.clipIndex,
      time: before.time,
      playing: before.playing,
    });
  });

  it("does not change playback for null or undefined", () => {
    usePlaybackStore.getState().play();
    const before = usePlaybackStore.getState();
    expect(applyCommentPlayback(null)).toBe(false);
    expect(applyCommentPlayback(undefined)).toBe(false);
    expect(usePlaybackStore.getState()).toMatchObject({
      clipIndex: before.clipIndex,
      time: before.time,
      playing: before.playing,
    });
  });

  it("does not seek when there are no clips", () => {
    usePlaybackStore.getState().setClips([]);
    expect(applyCommentPlayback({ clipIndex: 0, frame: 0 })).toBe(false);
  });
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

  it("also applies playback when the selected comment has a recording", () => {
    const playbackComment = comment("with-playback", camera, [strokeA], { clipIndex: 1, frame: 48 });
    usePlaybackStore.getState().setClips([{ name: "a", duration: 2 }, { name: "b", duration: 4 }], 24);
    usePlaybackStore.getState().play();

    applyCommentReplay(playbackComment);

    expect(usePlaybackStore.getState()).toMatchObject({ playing: false, clipIndex: 1, time: 2 });
    expect(useAnnotationStore.getState().replayStrokes).toEqual([strokeA]);
  });

  it("leaves playback unchanged for a comment without a recording", () => {
    usePlaybackStore.getState().setClips([{ name: "a", duration: 2 }], 24);
    usePlaybackStore.getState().play();
    const before = usePlaybackStore.getState();

    applyCommentReplay(firstComment);

    expect(usePlaybackStore.getState()).toMatchObject({
      playing: before.playing,
      clipIndex: before.clipIndex,
      time: before.time,
    });
  });

  it("does not touch playback when the selection is cleared", () => {
    usePlaybackStore.getState().setClips([{ name: "a", duration: 2 }], 24);
    usePlaybackStore.getState().play();

    applyCommentReplay(null);

    expect(usePlaybackStore.getState().playing).toBe(true);
    expect(useAnnotationStore.getState().replayStrokes).toEqual([]);
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
