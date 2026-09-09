import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: here,
  cacheDir: ".vite",
  plugins: [react()],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared/src", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
