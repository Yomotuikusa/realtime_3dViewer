import { beforeEach, describe, expect, it } from "vitest";
import { dispatchServerMessage } from "../src/app/realtime-dispatch";
import { useDisplayStore } from "../src/store/display";

beforeEach(() => useDisplayStore.getState().reset());

describe("playback source realtime dispatch", () => {
  it("starts unset, updates once per value, accepts null, and resets", () => {
    expect(useDisplayStore.getState().playbackSource).toBeNull();
    useDisplayStore.getState().setPlaybackSource("v1");
    expect(useDisplayStore.getState().playbackSource).toBe("v1");
    const before = useDisplayStore.getState();
    let calls = 0;
    const unsubscribe = useDisplayStore.subscribe(() => { calls += 1; });
    useDisplayStore.getState().setPlaybackSource("v1");
    expect(useDisplayStore.getState()).toBe(before);
    expect(calls).toBe(0);
    useDisplayStore.getState().setPlaybackSource(null);
    expect(useDisplayStore.getState().playbackSource).toBeNull();
    useDisplayStore.getState().setPlaybackSource("v2");
    useDisplayStore.getState().reset();
    expect(useDisplayStore.getState().playbackSource).toBeNull();
    unsubscribe();
  });

  it("applies welcome state and clears a previously selected source when omitted", () => {
    useDisplayStore.getState().setPlaybackSource("v1");
    dispatchServerMessage({ type: "welcome", selfId: "u1", users: [], strokes: [] });
    expect(useDisplayStore.getState().playbackSource).toBeNull();
    dispatchServerMessage({
      type: "welcome", selfId: "u1", users: [], strokes: [], playbackSource: "v2",
    });
    expect(useDisplayStore.getState().playbackSource).toBe("v2");
  });

  it("applies playback source relay events", () => {
    dispatchServerMessage({ type: "playback:source", userId: "u", versionId: "v3" });
    expect(useDisplayStore.getState().playbackSource).toBe("v3");
  });
});
