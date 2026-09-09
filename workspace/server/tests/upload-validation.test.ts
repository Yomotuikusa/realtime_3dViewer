import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors";
import {
  assertModelBytes,
  assertUploadSize,
  modelExtension,
} from "../src/routes/upload-validation";

function expectHttpError(action: () => void, status: number, code: string): void {
  try {
    action();
    expect.fail("expected HttpError");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).code).toBe(code);
  }
}

describe("upload validation", () => {
  it("accepts supported extensions case-insensitively", () => {
    expect(modelExtension("a.GLB")).toBe(".glb");
    expect(modelExtension("b.gltf")).toBe(".gltf");
  });

  it("rejects unsupported or ambiguous extensions", () => {
    for (const name of ["a.fbx", "noext", "a.glb.zip"]) {
      expectHttpError(() => modelExtension(name), 400, "UNSUPPORTED_FORMAT");
    }
  });

  it("checks the GLB magic bytes and empty input", () => {
    assertModelBytes(
      ".glb",
      new TextEncoder().encode("glTF12345678"),
    );
    for (const bytes of [new TextEncoder().encode("FBX!...."), new Uint8Array()]) {
      expectHttpError(
        () => assertModelBytes(".glb", bytes),
        400,
        "UNSUPPORTED_FORMAT",
      );
    }
  });

  it("checks that GLTF is a JSON object with an asset", () => {
    assertModelBytes(
      ".gltf",
      new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
    );
    for (const source of ["{}", "not json", "null", "[]"]) {
      expectHttpError(
        () => assertModelBytes(".gltf", new TextEncoder().encode(source)),
        400,
        "UNSUPPORTED_FORMAT",
      );
    }
  });

  it("rejects only numeric content lengths above the limit", () => {
    expectHttpError(
      () => assertUploadSize("101", 100),
      413,
      "PAYLOAD_TOO_LARGE",
    );
    for (const value of ["100", undefined, "abc"]) {
      expect(() => assertUploadSize(value, 100)).not.toThrow();
    }
  });
});
