import type { CameraState, Vec3 } from "@shared/types";

/** 決まった向きから見る視点。 */
export type ViewPreset = "front" | "back" | "right" | "left";

/** HUD の十字に並べる順。上(正面)から時計回り。 */
export const VIEW_PRESET_ORDER: readonly ViewPreset[] = ["front", "right", "back", "left"];

/** 3×3 グリッド上のセル(1 始まり)。 */
export interface GridCell {
  row: number;
  column: number;
}

/** 十字の中央。全体を表示ボタンを置く。 */
export const VIEW_CROSS_CENTER: GridCell = { row: 2, column: 2 };

/** 各視点を置くセル。中央を囲む十字になる。 */
export const VIEW_PRESET_CELLS: Readonly<Record<ViewPreset, GridCell>> = {
  front: { row: 1, column: 2 },
  right: { row: 2, column: 3 },
  back: { row: 3, column: 2 },
  left: { row: 2, column: 1 },
};

/**
 * 注視点から見たカメラ位置の単位方向。glTF の慣習に合わせて +Z を正面とする。
 * どれも水平方向なので、上方向(+Y)と平行にならない。
 */
export const VIEW_PRESET_DIRECTIONS: Readonly<Record<ViewPreset, Vec3>> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
};

/** 注視点とカメラが重なっているときに使う最小距離。 */
export const MIN_PRESET_DISTANCE = 0.001;

/** 現在の距離を保ったまま、preset の方向へカメラを置く。 */
export function presetCamera(preset: ViewPreset, current: CameraState): CameraState {
  const distance = Math.max(
    Math.hypot(
      current.position[0] - current.target[0],
      current.position[1] - current.target[1],
      current.position[2] - current.target[2],
    ),
    MIN_PRESET_DISTANCE,
  );
  const direction = VIEW_PRESET_DIRECTIONS[preset];
  return {
    position: [
      current.target[0] + direction[0] * distance,
      current.target[1] + direction[1] * distance,
      current.target[2] + direction[2] * distance,
    ],
    target: [...current.target],
  };
}
