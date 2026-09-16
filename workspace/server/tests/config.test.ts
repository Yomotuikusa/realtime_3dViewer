import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";
import {
  DEFAULT_WEB_DIST_DIR,
  DEFAULT_WS_HEARTBEAT_INTERVAL_MS,
  loadConfig,
} from "../src/config";

describe("loadConfig", () => {
  it("uses defaults", () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      dataDir: "./data",
      maxUploadBytes: MAX_UPLOAD_BYTES_DEFAULT,
      webDistDir: DEFAULT_WEB_DIST_DIR,
      wsHeartbeatIntervalMs: DEFAULT_WS_HEARTBEAT_INTERVAL_MS,
    });
  });

  it("reads configured values", () => {
    expect(loadConfig({
      PORT: "8080",
      DATA_DIR: "/x",
      MAX_UPLOAD_BYTES: "10",
      WEB_DIST_DIR: "/srv/dist",
      WS_HEARTBEAT_INTERVAL_MS: "1000",
    })).toEqual({
      port: 8080,
      dataDir: "/x",
      maxUploadBytes: 10,
      webDistDir: "/srv/dist",
      wsHeartbeatIntervalMs: 1000,
    });
  });

  it("rejects invalid numeric values with the variable name", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ MAX_UPLOAD_BYTES: "-1" })).toThrow(/MAX_UPLOAD_BYTES/);
    expect(() => loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "abc" })).toThrow(/WS_HEARTBEAT_INTERVAL_MS/);
    expect(() => loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "-1" })).toThrow(/WS_HEARTBEAT_INTERVAL_MS/);
  });

  it("allows disabling the WebSocket heartbeat", () => {
    expect(loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "0" }).wsHeartbeatIntervalMs).toBe(0);
  });
});
