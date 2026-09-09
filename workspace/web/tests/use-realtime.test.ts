import { afterEach, describe, expect, it } from "vitest";
import type { ClientMessage } from "@shared/protocol";
import { onRealtimeStatus } from "../src/app/useRealtime";
import { useSessionStore } from "../src/store/session";

afterEach(() => useSessionStore.getState().reset());

describe("onRealtimeStatus", () => {
  it("opens the session, clears errors, and joins", () => {
    useSessionStore.getState().setLastError("previous error");
    const sent: ClientMessage[] = [];

    onRealtimeStatus("open", "Alice", (message) => {
      sent.push(message);
      return true;
    });

    expect(useSessionStore.getState()).toMatchObject({ connection: "open", lastError: null });
    expect(sent).toEqual([{ type: "join", name: "Alice" }]);
  });

  it("does not join or clear errors when closed", () => {
    useSessionStore.getState().setLastError("previous error");
    const sent: ClientMessage[] = [];

    onRealtimeStatus("closed", "Alice", (message) => {
      sent.push(message);
      return true;
    });

    expect(useSessionStore.getState()).toMatchObject({ connection: "closed", lastError: "previous error" });
    expect(sent).toEqual([]);
  });
});
