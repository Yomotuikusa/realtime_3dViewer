import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigate, parseRoute, projectPath } from "../src/app/routes";

describe("routes", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("maps the root path to the upload route", () => {
    expect(parseRoute("/")).toEqual({ name: "upload" });
  });

  it("maps a valid project path to the review route", () => {
    expect(parseRoute("/p/abc-123_X")).toEqual({ name: "review", projectId: "abc-123_X" });
  });

  it("rejects invalid project paths", () => {
    for (const pathname of ["/p/", "/p/a/b", "/x", "/p/a b"]) {
      expect(parseRoute(pathname)).toEqual({ name: "notFound", pathname });
    }
  });

  it("builds a project path", () => {
    expect(projectPath("p1")).toBe("/p/p1");
  });

  it("pushes history and dispatches popstate", () => {
    const listener = vi.fn();
    window.addEventListener("popstate", listener);

    navigate("/p/p1");

    expect(window.location.pathname).toBe("/p/p1");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("popstate", listener);
  });
});
