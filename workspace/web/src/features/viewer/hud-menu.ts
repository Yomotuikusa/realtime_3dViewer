export type HudMenuId = "camera";

/** 右上に並べる順。 */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera"];

/** トグルボタンの表示名。 */
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = { camera: "カメラ" };

/** トグルボタン押下後に開いているメニューを返す。 */
export function toggleHudMenu(open: HudMenuId | null, clicked: HudMenuId): HudMenuId | null {
  return open === clicked ? null : clicked;
}

/** document の pointerdown 後に開いているメニューを返す。 */
export function menuAfterPointerDown(
  open: HudMenuId | null,
  root: Element | null,
  target: EventTarget | null,
): HudMenuId | null {
  if (open === null) {
    return null;
  }
  if (root !== null && typeof Node !== "undefined" && target instanceof Node && root.contains(target)) {
    return open;
  }
  return null;
}
