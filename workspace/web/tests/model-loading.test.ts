import { describe, expect, it } from "vitest";
import {
  BLOCKED_RESOURCE_URL,
  createModelLoadingManager,
  resolveModelResourceUrl,
} from "../src/features/viewer/model-loading";

const origin = "http://localhost:5173";

describe("model resource loading", () => {
  it.each([
    "data:application/octet-stream;base64,AAA",
    "blob:http://localhost/abc",
    "/api/projects/p/versions/v/model",
    "http://localhost:5173/x.bin",
  ])("allows an embedded or same-origin URL: %s", (url) => {
    expect(resolveModelResourceUrl(url, origin)).toBe(url);
  });

  it.each(["https://evil.example/pixel.png", "//evil.example/a.bin"])(
    "blocks an external URL: %s",
    (url) => {
      expect(resolveModelResourceUrl(url, origin)).toBe(BLOCKED_RESOURCE_URL);
    },
  );

  it("resolves an ordinary relative URL against the origin", () => {
    expect(resolveModelResourceUrl("not a url ::", origin)).toBe("not a url ::");
  });

  it("applies the same rule through LoadingManager.resolveURL", () => {
    const manager = createModelLoadingManager(origin);

    expect(manager.resolveURL("https://evil.example/a.png")).toBe(BLOCKED_RESOURCE_URL);
    expect(manager.resolveURL("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(manager.resolveURL("/textures/a.png")).toBe("/textures/a.png");
  });
});
