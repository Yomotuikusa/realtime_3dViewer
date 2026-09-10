/// <reference types="node" />

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webUrl = new URL("..", import.meta.url);
const webPath = webUrl.protocol === "file:"
  ? fileURLToPath(webUrl)
  : join(process.cwd(), webUrl.pathname.slice(1));
const webDir = existsSync(webPath) ? webPath : join(process.cwd(), "web");
const srcDir = join(webDir, "src");
const testsDir = join(webDir, "tests");
const ignoredDirectories = new Set(["node_modules", "dist", ".vite"]);

function recursiveEntries(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => join(dir, entry));
}

function isIgnoredPath(path: string): boolean {
  const pathSegments = relative(webDir, path).replaceAll("\\", "/").split("/");
  return pathSegments.some((segment) => ignoredDirectories.has(segment));
}

const sourcePaths = recursiveEntries(srcDir)
  .filter((path) => !isIgnoredPath(path) && /\.(?:ts|tsx|css)$/.test(path));
const summaryPaths = recursiveEntries(webDir)
  .filter((path) => !isIgnoredPath(path) && path.endsWith("_Summary.md"));
const sourceSummaryPaths = summaryPaths.filter((path) => {
  const pathFromSrc = relative(srcDir, path);
  return pathFromSrc !== "" && !pathFromSrc.startsWith("..") && !pathFromSrc.startsWith("../");
});
const summaryTexts = summaryPaths.map((path) => ({ path, text: readFileSync(path, "utf8") }));
const webSummaryPath = join(webDir, "web_Summary.md");
const webSummaryText = readFileSync(webSummaryPath, "utf8");
const testNames = readdirSync(testsDir)
  .filter((entry) => /\.test\.(?:ts|tsx)$/.test(entry));

function nearestSummary(sourcePath: string): string {
  let directory = dirname(sourcePath);
  while (true) {
    const candidate = join(directory, `${basename(directory)}_Summary.md`);
    if (existsSync(candidate)) return candidate;
    if (directory === webDir) break;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`No nearest Summary found for ${relative(webDir, sourcePath)}`);
}

describe("web summaries", () => {
  it("names every folder summary after its folder", () => {
    for (const summaryPath of sourceSummaryPaths) {
      expect(
        basename(summaryPath),
        `${relative(webDir, summaryPath)} must be named after ${basename(dirname(summaryPath))}`,
      ).toBe(`${basename(dirname(summaryPath))}_Summary.md`);
    }
  });

  it("lists every source file in the nearest summary by relative path", () => {
    for (const sourcePath of sourcePaths) {
      const summaryPath = nearestSummary(sourcePath);
      const summary = readFileSync(summaryPath, "utf8");
      const sourceRelativePath = relative(dirname(summaryPath), sourcePath).replaceAll("\\", "/");
      expect(
        summary,
        `${sourceRelativePath} is missing from ${relative(webDir, summaryPath)}`,
      ).toContain(sourceRelativePath);
    }
  });

  it("lists every test file in some summary by file name", () => {
    for (const testName of testNames) {
      expect(
        summaryTexts.some(({ text }) => text.includes(testName)),
        `${testName} is missing from every web Summary`,
      ).toBe(true);
    }
  });

  it("indexes every folder summary from web_Summary.md", () => {
    for (const summaryPath of sourceSummaryPaths) {
      const summaryRelativePath = relative(webDir, summaryPath).replaceAll("\\", "/");
      expect(webSummaryText, `${summaryRelativePath} is missing from web/web_Summary.md`).toContain(summaryRelativePath);
    }
  });
});
