import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: here,
  cacheDir: ".vite",
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared/src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
