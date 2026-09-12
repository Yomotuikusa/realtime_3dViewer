import { describe, expect, it } from "vitest";
import type { Stroke } from "@shared/types";
import { MAX_ROOM_STROKES, createRoom } from "../src/realtime/room-state";
import { addStroke, clearStrokes, removeStroke } from "../src/realtime/room-strokes";

const makeStroke = (id: string, userId = "spoofed"): Stroke => ({
  id,
  userId,
  color: "#123456",
  points: [[0, 0, 0], [1, 1, 1]],
  createdAt: 1,
});

describe("room strokes", () => {
  it("stores server ownership and time, returning a separate copy", () => {
    const room = createRoom();
    const incoming = makeStroke("s1", "spoofed");
    const result = addStroke(room, "owner", incoming, 42);
    const stored = room.strokes.get("s1")!;
    const returned = result[0]!.msg;
    expect(stored).toEqual({ ...incoming, userId: "owner", createdAt: 42 });
    expect(returned).toEqual({ type: "stroke:add", stroke: stored });
    if (returned.type !== "stroke:add") throw new Error("unexpected message");
    expect(returned.stroke).not.toBe(stored);
    expect(returned.stroke.points[0]).not.toBe(stored.points[0]);
    expect(incoming).toEqual(makeStroke("s1", "spoofed"));
  });

  it("rejects another owner without changing the room and replaces own ids", () => {
    const room = createRoom();
    addStroke(room, "owner", makeStroke("s1"), 1);
    const before = room.strokes.get("s1");
    expect(addStroke(room, "other", makeStroke("s1"), 2)).toEqual([
      { target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "stroke owned by another user" } },
    ]);
    expect(room.strokes.get("s1")).toBe(before);
    expect(addStroke(room, "owner", makeStroke("s1"), 3)[0]?.target).toBe("all");
    expect(room.strokes.get("s1")?.createdAt).toBe(3);
  });

  it("rejects new strokes at the limit without changing the room", () => {
    const room = createRoom();
    for (let index = 0; index < MAX_ROOM_STROKES; index += 1) {
      room.strokes.set(`s${index}`, makeStroke(`s${index}`, "owner"));
    }
    const before = [...room.strokes.entries()];
    expect(addStroke(room, "owner", makeStroke("overflow"), 2)).toEqual([
      { target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "room stroke limit reached" } },
    ]);
    expect([...room.strokes.entries()]).toEqual(before);
  });

  it("removes only an existing stroke owned by the caller", () => {
    const room = createRoom();
    addStroke(room, "owner", makeStroke("mine"), 1);
    addStroke(room, "other", makeStroke("theirs"), 1);
    expect(removeStroke(room, "other", "missing")).toEqual([]);
    expect(removeStroke(room, "other", "mine")).toEqual([]);
    expect(room.strokes.has("mine")).toBe(true);
    expect(removeStroke(room, "owner", "mine")).toEqual([
      { target: "all", msg: { type: "stroke:remove", strokeId: "mine" } },
    ]);
    expect(room.strokes.has("mine")).toBe(false);
  });

  it("clears only the caller's strokes and always broadcasts clear", () => {
    const room = createRoom();
    addStroke(room, "owner", makeStroke("mine"), 1);
    addStroke(room, "other", makeStroke("theirs"), 1);
    expect(clearStrokes(room, "owner")).toEqual([
      { target: "all", msg: { type: "stroke:clear", userId: "owner" } },
    ]);
    expect([...room.strokes.keys()]).toEqual(["theirs"]);
    const before = [...room.strokes.entries()];
    expect(clearStrokes(room, "nobody")).toEqual([
      { target: "all", msg: { type: "stroke:clear", userId: "nobody" } },
    ]);
    expect([...room.strokes.entries()]).toEqual(before);
  });
});
