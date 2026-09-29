import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPlainLeftClick, navigate, parseRoute, projectPath } from "../src/app/routes";

describe("routes", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("maps the root and new paths to the projects and upload routes", () => {
    expect(parseRoute("/")).toEqual({ name: "projects" });
    expect(parseRoute("/new")).toEqual({ name: "upload" });
    expect(parseRoute("/new/x")).toEqual({ name: "notFound", pathname: "/new/x" });
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

  it("accepts only an unmodified left click", () => {
    expect(isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true);
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(isPlainLeftClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, [key]: true })).toBe(false);
    }
    expect(isPlainLeftClick({ button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false);
  });
});
