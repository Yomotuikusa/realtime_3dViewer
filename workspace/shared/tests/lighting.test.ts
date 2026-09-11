import { describe, expect, it } from "vitest";
import { LightAnglesSchema } from "../src/types";

describe("LightAnglesSchema", () => {
  it("accepts finite and out-of-range angles, strips extras, and rejects invalid values", () => {
    for (const value of [
      { yaw: 0, pitch: 0 },
      { yaw: -3.14, pitch: 1.48 },
      { yaw: 1000, pitch: -1000 },
    ]) {
      expect(LightAnglesSchema.safeParse(value).success).toBe(true);
    }

    for (const value of [
      { yaw: Number.NaN, pitch: 0 },
      { yaw: 0, pitch: Number.POSITIVE_INFINITY },
      { yaw: 0 },
      { pitch: 0 },
      { yaw: "0", pitch: 0 },
    ]) {
      expect(LightAnglesSchema.safeParse(value).success).toBe(false);
    }

    const result = LightAnglesSchema.safeParse({ yaw: 0, pitch: 0, extra: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ yaw: 0, pitch: 0 });
  });
});
