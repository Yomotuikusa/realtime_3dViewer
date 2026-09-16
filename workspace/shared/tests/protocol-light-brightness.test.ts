import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_BRIGHTNESS,
  LightBrightnessSchema,
  MAX_LIGHT_BRIGHTNESS,
  MIN_LIGHT_BRIGHTNESS,
} from "../src/types";
import {
  ClientMessageSchema,
  parseClientMessage,
  parseServerMessage,
  ServerMessageSchema,
} from "../src/protocol";

const welcome = { type: "welcome" as const, selfId: "user-1", users: [], strokes: [] };

describe("light brightness protocol", () => {
  it("exports the brightness range and default", () => {
    expect(MIN_LIGHT_BRIGHTNESS).toBe(0.25);
    expect(MAX_LIGHT_BRIGHTNESS).toBe(4);
    expect(DEFAULT_LIGHT_BRIGHTNESS).toBe(1);
  });

  it("validates finite brightness values within the range", () => {
    for (const brightness of [0.25, 1, 4, 1.5]) {
      expect(LightBrightnessSchema.safeParse(brightness).success).toBe(true);
    }
    for (const brightness of [0.2, 4.01, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expect(LightBrightnessSchema.safeParse(brightness).success).toBe(false);
    }
  });

  it("validates client and server brightness messages", () => {
    expect(ClientMessageSchema.safeParse({ type: "light:brightness", brightness: 2 }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "light:brightness" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "light:brightness", brightness: 0 }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "light:brightness", userId: "user-1", brightness: 2 }).success).toBe(true);
    expect(ServerMessageSchema.safeParse({ type: "light:brightness", brightness: 2 }).success).toBe(false);
  });

  it("accepts optional brightness in welcome", () => {
    const withoutBrightness = ServerMessageSchema.safeParse(welcome);
    expect(withoutBrightness.success).toBe(true);
    if (withoutBrightness.success) expect("lightBrightness" in withoutBrightness.data).toBe(false);

    const withBrightness = ServerMessageSchema.safeParse({ ...welcome, lightBrightness: 2 });
    expect(withBrightness.success).toBe(true);
    if (withBrightness.success && withBrightness.data.type === "welcome") {
      expect(withBrightness.data.lightBrightness).toBe(2);
    }
    expect(ServerMessageSchema.safeParse({ ...welcome, lightBrightness: 9 }).success).toBe(false);
  });

  it("parses brightness JSON frames with the same validation", () => {
    expect(parseClientMessage(JSON.stringify({ type: "light:brightness", brightness: 2 }))).toEqual({
      ok: true,
      msg: { type: "light:brightness", brightness: 2 },
    });
    expect(parseClientMessage(JSON.stringify({ type: "light:brightness", brightness: 0 })).ok).toBe(false);
    expect(parseServerMessage(JSON.stringify({ type: "light:brightness", userId: "user-1", brightness: 2 }))).toEqual({
      ok: true,
      msg: { type: "light:brightness", userId: "user-1", brightness: 2 },
    });
    expect(parseServerMessage(JSON.stringify({ type: "light:brightness", brightness: 2 })).ok).toBe(false);
  });
});
