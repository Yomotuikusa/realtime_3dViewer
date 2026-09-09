import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const testTmpRoot = fileURLToPath(new URL("../../.vite/test-tmp/", import.meta.url));

/** Create a temporary directory under server/.vite/test-tmp. */
export function makeTmpDir(prefix: string): string {
  mkdirSync(testTmpRoot, { recursive: true });
  return mkdtempSync(join(testTmpRoot, `${prefix}-`));
}

/** Remove a temporary directory and its contents if it exists. */
export function removeTmpDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
