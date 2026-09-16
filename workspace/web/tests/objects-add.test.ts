/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED_MODEL_EXTENSIONS } from "@shared/api";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const objectList = readFileSync(join(srcDir, "features/objects/ObjectList.tsx"), "utf8");
const uploadPage = readFileSync(join(srcDir, "app/UploadPage.tsx"), "utf8");

describe("object file addition", () => {
  it("builds the file picker accept value from the shared extensions", () => {
    expect(objectList).toContain('accept={ALLOWED_MODEL_EXTENSIONS.join(",")}');
    expect(objectList).not.toContain('accept=".glb,.gltf"');
    expect(objectList).not.toMatch(/accept="[^"]*"/);
    expect(uploadPage).toContain('accept={ALLOWED_MODEL_EXTENSIONS.join(",")}');
    expect(ALLOWED_MODEL_EXTENSIONS.join(",")).toBe(".glb,.gltf,.fbx,.obj");
  });

  it("keeps validating selected files with the shared limits", () => {
    expect(objectList).toContain(
      "validateModelFiles(\n      files,\n      ALLOWED_MODEL_EXTENSIONS,\n      MAX_UPLOAD_BYTES_DEFAULT,\n    )",
    );
  });
});
