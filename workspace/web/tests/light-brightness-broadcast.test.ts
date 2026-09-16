/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SendThrottle } from "../src/features/viewer/send-throttle";
import {
  onLightBrightnessChange,
  type LightBrightnessChange,
} from "../src/features/viewer/useLightBrightnessBroadcast";

function createThrottleStub(): SendThrottle<number> {
  return {
    update: vi.fn(),
    markSent: vi.fn(),
    dispose: vi.fn(),
  };
}

const sourceDir = existsSync(join(process.cwd(), "src"))
  ? join(process.cwd(), "src")
  : join(process.cwd(), "web/src");

function readSource(relativePath: string): string {
  return readFileSync(join(sourceDir, relativePath), "utf8");
}

describe("onLightBrightnessChange", () => {
  it("updates the throttle for local changes", () => {
    const throttle = createThrottleStub();
    const change: LightBrightnessChange = { brightness: 2, brightnessOrigin: "local" };

    onLightBrightnessChange(throttle, change);

    expect(throttle.update).toHaveBeenCalledOnce();
    expect(throttle.update).toHaveBeenCalledWith(2);
    expect(throttle.markSent).not.toHaveBeenCalled();
  });

  it("updates the throttle for every consecutive local change", () => {
    const throttle = createThrottleStub();

    onLightBrightnessChange(throttle, { brightness: 1, brightnessOrigin: "local" });
    onLightBrightnessChange(throttle, { brightness: 2, brightnessOrigin: "local" });
    onLightBrightnessChange(throttle, { brightness: 3, brightnessOrigin: "local" });

    expect(throttle.update).toHaveBeenCalledTimes(3);
    expect(throttle.markSent).not.toHaveBeenCalled();
  });

  it("marks remote changes as sent without updating the throttle", () => {
    const throttle = createThrottleStub();

    onLightBrightnessChange(throttle, { brightness: 2, brightnessOrigin: "remote" });

    expect(throttle.markSent).toHaveBeenCalledOnce();
    expect(throttle.markSent).toHaveBeenCalledWith(2);
    expect(throttle.update).not.toHaveBeenCalled();
  });

  it("preserves the order of local and remote changes", () => {
    const calls: string[] = [];
    const throttle: SendThrottle<number> = {
      update: vi.fn(() => calls.push("update")),
      markSent: vi.fn(() => calls.push("markSent")),
      dispose: vi.fn(),
    };

    onLightBrightnessChange(throttle, { brightness: 1, brightnessOrigin: "local" });
    onLightBrightnessChange(throttle, { brightness: 2, brightnessOrigin: "remote" });
    onLightBrightnessChange(throttle, { brightness: 3, brightnessOrigin: "local" });

    expect(calls).toEqual(["update", "markSent", "update"]);
  });
});

describe("light brightness broadcast wiring", () => {
  it("uses the brightness message, shared interval, and lighting subscription", () => {
    const source = readSource("features/viewer/useLightBrightnessBroadcast.ts");

    expect(source).toContain("createSendThrottle<number>");
    expect(source).toContain('type: "light:brightness"');
    expect(source).toContain("LIGHT_SEND_INTERVAL_MS");
    expect(source).toContain("useLightingStore.subscribe");
  });

  it("is enabled immediately after the light angle broadcast", () => {
    const source = readSource("app/ReviewPage.tsx");
    const angleIndex = source.indexOf("useLightBroadcast(realtime.send);");
    const brightnessIndex = source.indexOf("useLightBrightnessBroadcast(realtime.send);");

    expect(angleIndex).toBeGreaterThanOrEqual(0);
    expect(brightnessIndex).toBe(angleIndex + "useLightBroadcast(realtime.send);".length + 3);
  });
});
