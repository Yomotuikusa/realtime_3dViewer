/// <reference types="node" />

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const srcUrl = new URL("../src", import.meta.url);
const urlPath = srcUrl.protocol === "file:" ? fileURLToPath(srcUrl) : join(process.cwd(), srcUrl.pathname.slice(1));
const srcDir = existsSync(urlPath) ? urlPath : join(process.cwd(), "web", "src");
const cssPaths = readdirSync(srcDir, { recursive: true })
  .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".css"))
  .map((entry) => join(srcDir, entry));
const cssFiles = cssPaths.map((path) => ({
  path,
  relativePath: relative(srcDir, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

const tokenNames = [
  "--font-ui",
  "--text-xs",
  "--text-sm",
  "--text-md",
  "--text-lg",
  "--text-xl",
  "--leading",
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--color-bg",
  "--color-surface",
  "--color-surface-subtle",
  "--color-surface-muted",
  "--color-text",
  "--color-text-muted",
  "--color-border",
  "--color-border-strong",
  "--color-accent",
  "--color-accent-subtle",
  "--color-on-accent",
  "--color-danger",
  "--color-danger-subtle",
  "--color-danger-border",
  "--color-success",
  "--color-success-subtle",
  "--color-warning",
  "--color-warning-subtle",
  "--color-surface-translucent",
  "--shadow-overlay",
  "--shadow-control",
  "--shadow-card",
  "--focus-ring-color",
  "--duration-fast",
  "--panel-width",
  "--outliner-width",
  "--header-height",
  "--follow-frame-width",
];

function collectVariableDeclarations(text: string): Set<string> {
  return new Set(
    [...text.matchAll(/(--[a-z0-9-]+)\s*:/gi)]
      .map((match) => match[1])
      .filter((name): name is string => name !== undefined),
  );
}

function collectVariableReferences(text: string): Array<{ name: string; fallback: boolean }> {
  const references: Array<{ name: string; fallback: boolean }> = [];
  let start = text.indexOf("var(");
  while (start >= 0) {
    let depth = 0;
    let end = start + 4;
    for (; end < text.length; end += 1) {
      const character = text[end];
      if (character === "(") depth += 1;
      if (character === ")") {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    const body = text.slice(start + 4, end);
    const comma = body.indexOf(",");
    const name = (comma < 0 ? body : body.slice(0, comma)).trim();
    if (name.startsWith("--")) {
      references.push({ name, fallback: comma >= 0 && body.slice(comma + 1).trim().length > 0 });
    }
    start = text.indexOf("var(", start + 4);
  }
  return references;
}

describe("web style rules", () => {
  it("defines every token in the :root block", () => {
    const tokens = cssFiles.find(({ relativePath }) => relativePath === "styles/tokens.css");
    expect(tokens).toBeDefined();
    const rootBlock = tokens?.text.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    for (const name of tokenNames) {
      expect(rootBlock).toMatch(new RegExp(`${name.replace("-", "\\-")}\\s*:`));
    }
  });

  it("keeps raw colors in tokens.css only", () => {
    const rawColor = /#[0-9a-f]{3,8}(?![0-9a-f])|\b(?:rgb|rgba|hsl)\(/i;
    for (const file of cssFiles) {
      if (file.relativePath !== "styles/tokens.css") expect(file.text).not.toMatch(rawColor);
    }
  });

  it("declares or provides fallbacks for every CSS variable reference", () => {
    const declarations = new Set(cssFiles.flatMap(({ text }) => [...collectVariableDeclarations(text)]));
    for (const file of cssFiles) {
      for (const reference of collectVariableReferences(file.text)) {
        expect(
          declarations.has(reference.name) || reference.fallback,
          `${file.relativePath} references ${reference.name} without a declaration or fallback`,
        ).toBe(true);
      }
    }
  });

  it("keeps !important confined to base.css and forbids CSS imports", () => {
    for (const file of cssFiles) {
      if (file.relativePath !== "styles/base.css") expect(file.text).not.toContain("!important");
      expect(file.text).not.toMatch(/@import\b/);
    }
  });

  it("imports the foundation styles in order from main.tsx", () => {
    const main = readFileSync(join(srcDir, "main.tsx"), "utf8");
    const imports = [...main.matchAll(/import\s+["']([^"']+)["'];?/g)].map((match) => match[1]);
    expect(imports.slice(0, 3)).toEqual([
      "./styles/tokens.css",
      "./styles/base.css",
      "./styles/controls.css",
    ]);
  });
});
