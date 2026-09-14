import { describe, expect, it } from "vitest";
import { applyDisplayMessage, createRoomDisplayState, displayWelcomeFields } from "../src/realtime/room-display";
import { RoomHub } from "../src/realtime/hub";

function join(hub: RoomHub, id: string, name: string) {
  const message = hub.handle(id, { type: "join", name })[0]?.msg;
  if (!message || message.type !== "welcome") throw new Error("expected welcome");
  return message;
}

describe("playback source room sharing", () => {
  it("starts unset and stores the source in display state and welcome fields", () => {
    const state = createRoomDisplayState();
    expect(state.playbackSource).toBeNull();
    expect(displayWelcomeFields(state)).not.toHaveProperty("playbackSource");
    expect(applyDisplayMessage(state, "u1", { type: "playback:source", versionId: "v1" })).toEqual({
      type: "playback:source", userId: "u1", versionId: "v1",
    });
    expect(state.playbackSource).toBe("v1");
    expect(displayWelcomeFields(state).playbackSource).toBe("v1");
  });

  it("relays the latest source and restores it for later joins", () => {
    const ids = ["a", "b"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");

    expect(hub.handle("a", { type: "playback:source", versionId: "v2" })).toEqual([{
      target: "others",
      msg: { type: "playback:source", userId: "a", versionId: "v2" },
    }]);
    expect(hub.playbackSourceIn("p1")).toBe("v2");
    hub.connect("p1");
    expect(join(hub, "b", "Bob").playbackSource).toBe("v2");

    expect(hub.handle("a", { type: "playback:source", versionId: "v3" })).toHaveLength(1);
    expect(hub.playbackSourceIn("p1")).toBe("v3");
  });

  it("omits an unset source and isolates/removes it with its room", () => {
    const ids = ["a", "b", "c"];
    const hub = new RoomHub({ newId: () => ids.shift()! });
    hub.connect("p1");
    join(hub, "a", "Alice");
    expect(hub.playbackSourceIn("missing")).toBeNull();

    hub.connect("p2");
    expect(join(hub, "b", "Bob")).not.toHaveProperty("playbackSource");
    expect(hub.playbackSourceIn("p2")).toBeNull();

    hub.handle("a", { type: "playback:source", versionId: "v2" });
    hub.disconnect("a");
    expect(hub.playbackSourceIn("p1")).toBeNull();
    hub.connect("p1");
    expect(join(hub, "c", "Carol")).not.toHaveProperty("playbackSource");
  });
});
