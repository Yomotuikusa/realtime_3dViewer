/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const srcDir = srcUrl.protocol === "file:"
  ? fileURLToPath(srcUrl)
  : join(process.cwd(), "web/src");
const uploadPage = readFileSync(join(srcDir, "app/UploadPage.tsx"), "utf8");

describe("UploadPage input limits", () => {
  it("uses the shared project name length", () => {
    expect(uploadPage).toContain('import { MAX_PROJECT_NAME_LENGTH } from "@shared/types";');
    expect(uploadPage).toContain("maxLength={MAX_PROJECT_NAME_LENGTH}");
    expect(uploadPage).not.toMatch(/maxLength=\{\d+\}/);
  });
});
