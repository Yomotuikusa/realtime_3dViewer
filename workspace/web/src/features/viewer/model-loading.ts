import { LoadingManager } from "three";

export const BLOCKED_RESOURCE_URL = "about:blank";

export function resolveModelResourceUrl(url: string, origin: string): string {
  if (/^(data|blob):/i.test(url)) {
    return url;
  }

  try {
    const resolved = new URL(url, origin);
    return resolved.origin === new URL(origin).origin ? url : BLOCKED_RESOURCE_URL;
  } catch {
    return BLOCKED_RESOURCE_URL;
  }
}

export function createModelLoadingManager(origin: string): LoadingManager {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => resolveModelResourceUrl(url, origin));
  return manager;
}
