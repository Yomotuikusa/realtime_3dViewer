import { useEffect, useState } from "react";

export type Route =
  | { name: "projects" }
  | { name: "upload" }
  | { name: "review"; projectId: string }
  | { name: "notFound"; pathname: string };

export function parseRoute(pathname: string): Route {
  if (pathname === "/") {
    return { name: "projects" };
  }
  if (pathname === "/new") {
    return { name: "upload" };
  }

  const reviewMatch = /^\/p\/([A-Za-z0-9_-]+)$/.exec(pathname);
  const projectId = reviewMatch?.[1];
  if (projectId !== undefined) {
    return { name: "review", projectId };
  }

  return { name: "notFound", pathname };
}

/** 一覧画面のパス */
export const PROJECTS_PATH = "/";
/** 新規作成(アップロード)画面のパス */
export const NEW_PROJECT_PATH = "/new";

export function projectPath(projectId: string): string {
  return `/p/${projectId}`;
}

/** 修飾キーなしの左クリックだけを SPA 遷移に使う。 */
export function isPlainLeftClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

/** history.pushState した後 popstate を dispatch して購読側に伝える */
export function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** popstate を購読して現在の Route を返す React フック */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return route;
}
