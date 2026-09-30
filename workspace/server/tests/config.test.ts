import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";
import {
  DEFAULT_MAX_UPLOAD_FILES,
  DEFAULT_WEB_DIST_DIR,
  DEFAULT_WS_HEARTBEAT_INTERVAL_MS,
  loadConfig,
  usesHttps,
} from "../src/config";

describe("loadConfig", () => {
  it("uses defaults", () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      dataDir: "./data",
      maxUploadBytes: MAX_UPLOAD_BYTES_DEFAULT,
      maxUploadFiles: DEFAULT_MAX_UPLOAD_FILES,
      webDistDir: DEFAULT_WEB_DIST_DIR,
      wsHeartbeatIntervalMs: DEFAULT_WS_HEARTBEAT_INTERVAL_MS,
      publicOrigin: null,
      trustProxy: false,
      host: null,
    });
  });

  it("reads configured values", () => {
    expect(loadConfig({
      PORT: "8080",
      DATA_DIR: "/x",
      MAX_UPLOAD_BYTES: "10",
      MAX_UPLOAD_FILES: "3",
      WEB_DIST_DIR: "/srv/dist",
      WS_HEARTBEAT_INTERVAL_MS: "1000",
      PUBLIC_ORIGIN: "https://review.example.com/",
      TRUST_PROXY: "1",
      HOST: "127.0.0.1",
    })).toEqual({
      port: 8080,
      dataDir: "/x",
      maxUploadBytes: 10,
      maxUploadFiles: 3,
      webDistDir: "/srv/dist",
      wsHeartbeatIntervalMs: 1000,
      publicOrigin: "https://review.example.com",
      trustProxy: true,
      host: "127.0.0.1",
    });
  });

  it("rejects invalid numeric values with the variable name", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ MAX_UPLOAD_BYTES: "-1" })).toThrow(/MAX_UPLOAD_BYTES/);
    expect(() => loadConfig({ MAX_UPLOAD_FILES: "abc" })).toThrow(/MAX_UPLOAD_FILES/);
    expect(() => loadConfig({ MAX_UPLOAD_FILES: "-1" })).toThrow(/MAX_UPLOAD_FILES/);
    expect(() => loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "abc" })).toThrow(/WS_HEARTBEAT_INTERVAL_MS/);
    expect(() => loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "-1" })).toThrow(/WS_HEARTBEAT_INTERVAL_MS/);
  });

  it("requires at least one upload file", () => {
    expect(() => loadConfig({ MAX_UPLOAD_FILES: "0" })).toThrow(
      /MAX_UPLOAD_FILES must be at least 1/,
    );
  });

  it("allows disabling the WebSocket heartbeat", () => {
    expect(loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "0" }).wsHeartbeatIntervalMs).toBe(0);
  });

  it("validates the public origin and proxy setting", () => {
    for (const value of ["ftp://x", "https://x/app", "https://x/?a=1", "not a url"]) {
      expect(() => loadConfig({ PUBLIC_ORIGIN: value })).toThrow(/PUBLIC_ORIGIN/);
    }
    expect(() => loadConfig({ TRUST_PROXY: "yes" })).toThrow(/TRUST_PROXY/);
    expect(loadConfig({ NODE_ENV: "production", PUBLIC_ORIGIN: "http://localhost:3000" }).publicOrigin)
      .toBe("http://localhost:3000");
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(
      /PUBLIC_ORIGIN is required when NODE_ENV=production/,
    );
  });

  it("detects HTTPS only from the public origin", () => {
    expect(usesHttps({ publicOrigin: "https://a" })).toBe(true);
    expect(usesHttps({ publicOrigin: "http://a" })).toBe(false);
    expect(usesHttps({ publicOrigin: null })).toBe(false);
    expect(usesHttps({})).toBe(false);
  });
});
