import { useEffect } from "react";
import { selectResolvedTheme, useThemeStore } from "../../store/theme";

/** レビュー画面・アップロード画面の外側に 1 つだけ置く、描画しない部品。 */
export function ThemeEffect(): null {
  const resolvedTheme = useThemeStore(selectResolvedTheme);

  useEffect(() => {
    let media: MediaQueryList | undefined;
    let handler: ((event: MediaQueryListEvent) => void) | undefined;
    let subscribed = false;

    try {
      if (typeof window.matchMedia !== "function") return;
      media = window.matchMedia("(prefers-color-scheme: dark)");
      useThemeStore.getState().setPrefersDark(media.matches === true);
      if (typeof media.addEventListener !== "function") return;
      handler = (event) => useThemeStore.getState().setPrefersDark(event.matches === true);
      media.addEventListener("change", handler);
      subscribed = true;
    } catch {
      return;
    }

    return () => {
      if (!media || !handler || !subscribed || typeof media.removeEventListener !== "function") return;
      try {
        media.removeEventListener("change", handler);
      } catch {
        // Browser APIs may reject listener cleanup; unmount must remain safe.
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  return null;
}
