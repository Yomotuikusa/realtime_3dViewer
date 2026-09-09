import { beforeEach, describe, expect, it } from "vitest";
import type { ServerMessage } from "@shared/protocol";
import { dispatchServerMessage } from "../src/app/realtime-dispatch";
import { useSessionStore } from "../src/store/session";

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe("realtime dispatch", () => {
  it("stores the self id and matching welcome color", () => {
    dispatchServerMessage({
      type: "welcome",
      selfId: "u1",
      users: [{ id: "u1", name: "Rin", color: "#f00", camera: null }],
      strokes: [],
    });

    expect(useSessionStore.getState().selfId).toBe("u1");
    expect(useSessionStore.getState().color).toBe("#f00");
  });

  it("keeps color null when the self user is absent", () => {
    dispatchServerMessage({ type: "welcome", selfId: "u1", users: [], strokes: [] });
    expect(useSessionStore.getState().selfId).toBe("u1");
    expect(useSessionStore.getState().color).toBeNull();
  });

  it("formats server errors in the session store", () => {
    dispatchServerMessage({ type: "error", code: "BAD_REQUEST", message: "x" });
    expect(useSessionStore.getState().lastError).toBe("BAD_REQUEST: x");
  });

  it("ignores messages not handled by this phase", () => {
    const message: ServerMessage = {
      type: "camera",
      userId: "u2",
      camera: { position: [0, 0, 0], target: [0, 0, 0] },
    };
    expect(() => dispatchServerMessage(message)).not.toThrow();
    expect(useSessionStore.getState().selfId).toBeNull();
  });

  it("has the documented initial state and resets to it", () => {
    expect(useSessionStore.getState()).toMatchObject({
      selfId: null,
      color: null,
      name: "",
      connection: "closed",
      lastError: null,
    });
    useSessionStore.getState().setConnection("open");
    useSessionStore.getState().setName("Rin");
    useSessionStore.getState().reset();
    expect(useSessionStore.getState()).toMatchObject({
      selfId: null,
      color: null,
      name: "",
      connection: "closed",
      lastError: null,
    });
  });
});
