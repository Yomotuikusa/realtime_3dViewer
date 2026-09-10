export type HudMenuId = "camera";

/** 右上に並べる順。 */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera"];

/** トグルボタンの表示名。 */
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = { camera: "カメラ" };

/** ページ表示直後に開いているメニュー。カメラは常設パネルとして最初から展開する。 */
export const HUD_MENU_INITIAL: HudMenuId | null = "camera";

/** トグルボタン押下後に開いているメニューを返す。 */
export function toggleHudMenu(open: HudMenuId | null, clicked: HudMenuId): HudMenuId | null {
  return open === clicked ? null : clicked;
}
