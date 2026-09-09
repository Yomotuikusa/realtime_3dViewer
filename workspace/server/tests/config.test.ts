import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("uses defaults", () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      dataDir: "./data",
      maxUploadBytes: MAX_UPLOAD_BYTES_DEFAULT,
    });
  });

  it("reads configured values", () => {
    expect(loadConfig({ PORT: "8080", DATA_DIR: "/x", MAX_UPLOAD_BYTES: "10" })).toEqual({
      port: 8080,
      dataDir: "/x",
      maxUploadBytes: 10,
    });
  });

  it("rejects invalid numeric values with the variable name", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ MAX_UPLOAD_BYTES: "-1" })).toThrow(/MAX_UPLOAD_BYTES/);
  });
});
