import { describe, expect, it, vi } from "vitest";
import type { LightAngles } from "@shared/types";
import type { SendThrottle } from "../src/features/viewer/send-throttle";
import {
  lightAnglesEqual,
  onLightingChange,
  type LightingChange,
} from "../src/features/viewer/useLightBroadcast";

const angles: LightAngles = { yaw: 1, pitch: 0.5 };

function createThrottleStub(): SendThrottle<LightAngles> {
  return {
    update: vi.fn(),
    markSent: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("lightAnglesEqual", () => {
  it("compares yaw and pitch strictly", () => {
    expect(lightAnglesEqual(angles, { yaw: 1, pitch: 0.5 })).toBe(true);
    expect(lightAnglesEqual(angles, { yaw: 1.0000001, pitch: 0.5 })).toBe(false);
    expect(lightAnglesEqual(angles, { yaw: 1, pitch: -0.5 })).toBe(false);
    expect(lightAnglesEqual({ yaw: 0, pitch: 0 }, { yaw: -0, pitch: 0 })).toBe(true);
  });
});

describe("onLightingChange", () => {
  it("updates the throttle for local changes", () => {
    const throttle = createThrottleStub();
    const change: LightingChange = { angles, origin: "local" };

    onLightingChange(throttle, change);

    expect(throttle.update).toHaveBeenCalledOnce();
    expect(throttle.update).toHaveBeenCalledWith(angles);
    expect(throttle.markSent).not.toHaveBeenCalled();
  });

  it("updates the throttle for every consecutive local change", () => {
    const throttle = createThrottleStub();

    onLightingChange(throttle, { angles, origin: "local" });
    onLightingChange(throttle, { angles, origin: "local" });
    onLightingChange(throttle, { angles, origin: "local" });

    expect(throttle.update).toHaveBeenCalledTimes(3);
    expect(throttle.markSent).not.toHaveBeenCalled();
  });

  it("marks remote changes as sent without updating the throttle", () => {
    const throttle = createThrottleStub();
    const change: LightingChange = { angles, origin: "remote" };

    onLightingChange(throttle, change);

    expect(throttle.markSent).toHaveBeenCalledOnce();
    expect(throttle.markSent).toHaveBeenCalledWith(angles);
    expect(throttle.update).not.toHaveBeenCalled();
  });

  it("preserves the order of local and remote changes", () => {
    const calls: string[] = [];
    const throttle: SendThrottle<LightAngles> = {
      update: vi.fn(() => calls.push("update")),
      markSent: vi.fn(() => calls.push("markSent")),
      dispose: vi.fn(),
    };

    onLightingChange(throttle, { angles, origin: "local" });
    onLightingChange(throttle, { angles, origin: "remote" });
    onLightingChange(throttle, { angles, origin: "local" });

    expect(calls).toEqual(["update", "markSent", "update"]);
  });
});
