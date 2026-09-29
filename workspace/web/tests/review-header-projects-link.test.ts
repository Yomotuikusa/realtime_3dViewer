import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReviewHeader } from "../src/app/ReviewHeader";
import { PROJECTS_LINK_LABEL } from "../src/app/review-labels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ReviewHeader project link", () => {
  beforeEach(() => window.history.replaceState({}, "", "/p/p1"));
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("places the projects link first in the actions while keeping h1 first", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(ReviewHeader, {
      projectName: "Robot",
      joined: false,
      onOpenSettings: () => undefined,
    })));
    const header = host.querySelector("header")!;
    const actions = host.querySelector(".review-header__actions")!;
    expect(header.firstElementChild?.matches("h1.review-header__title")).toBe(true);
    expect(actions.firstElementChild?.textContent).toBe(PROJECTS_LINK_LABEL);
    expect(actions.firstElementChild?.getAttribute("href")).toBe("/");
    await act(async () => (actions.firstElementChild as HTMLAnchorElement).click());
    expect(window.location.pathname).toBe("/");
    await act(async () => root.unmount());
  });
});
