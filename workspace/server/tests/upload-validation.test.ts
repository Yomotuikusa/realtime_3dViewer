import { describe, expect, it } from "vitest";
import { HttpError } from "../src/errors";
import {
  assertModelBytes,
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
    expect(modelExtension("a.b.GLB")).toBe(".glb");
    expect(modelExtension("b.gltf")).toBe(".gltf");
    expect(modelExtension("a.FBX")).toBe(".fbx");
    expect(modelExtension("a.OBJ")).toBe(".obj");
  });

  it("rejects unsupported or ambiguous extensions", () => {
    for (const name of ["a.stl", "noext", "a.glb.zip"]) {
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

  it("checks binary and ASCII FBX signatures", () => {
    const binary = new Uint8Array([
      ...new TextEncoder().encode("Kaydara FBX Binary  \0"),
      1,
      2,
    ]);
    assertModelBytes(".fbx", binary);
    assertModelBytes(
      ".fbx",
      new TextEncoder().encode(
        "; FBX 7.4 project file\nFBXHeaderExtension:  {\n\tFBXVersion: 7400\n}",
      ),
    );
    for (const bytes of [
      new TextEncoder().encode("Kaydara FBX Binary "),
      new TextEncoder().encode("FBXHeaderExtension:  {"),
      new TextEncoder().encode("glTF1234"),
      new Uint8Array(),
      new TextEncoder().encode(`${"x".repeat(5000)}FBXVersion:`),
    ]) {
      expectHttpError(
        () => assertModelBytes(".fbx", bytes),
        400,
        "UNSUPPORTED_FORMAT",
      );
    }
  });

  it("checks OBJ vertex lines and empty input", () => {
    assertModelBytes(
      ".obj",
      new TextEncoder().encode("# comment\nv 0 0 0\nv 1 0 0\nf 1 2 3\n"),
    );
    assertModelBytes(".obj", new TextEncoder().encode("v -1.5 0.0 2.25"));
    for (const source of ["mtllib a.mtl\nusemtl x\n", "vt 0 0\nvn 0 1 0\n"]) {
      expectHttpError(
        () => assertModelBytes(".obj", new TextEncoder().encode(source)),
        400,
        "UNSUPPORTED_FORMAT",
      );
    }
    expectHttpError(
      () => assertModelBytes(".obj", new Uint8Array()),
      400,
      "UNSUPPORTED_FORMAT",
    );
  });

});
