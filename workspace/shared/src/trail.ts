import { z } from "zod";
import { isSameObjectPart } from "./object-part";
import { ObjectPartRefSchema, type ObjectPartRef } from "./types";

/** ルームで共有するモーション軌跡の表示設定 */
export interface MotionTrail {
  /** 軌跡を描くなら true */
  visible: boolean;
  /** 軌跡を描く対象の部位。未選択なら null */
  target: ObjectPartRef | null;
}

/** 誰も切り替えていないルームの値 */
export const DEFAULT_MOTION_TRAIL: MotionTrail = { visible: false, target: null };

export const MotionTrailSchema = z.object({
  visible: z.boolean(),
  target: ObjectPartRefSchema.nullable(),
}) satisfies z.ZodType<MotionTrail>;

/** visible と target の内容が等しいとき true */
export function motionTrailEquals(a: MotionTrail, b: MotionTrail): boolean {
  if (a.visible !== b.visible) return false;
  if (a.target === null || b.target === null) return a.target === b.target;
  return isSameObjectPart(a.target, b.target);
}

/** target の参照まで複製する */
export function cloneMotionTrail(trail: MotionTrail): MotionTrail {
  return {
    visible: trail.visible,
    target: trail.target ? { ...trail.target } : null,
  };
}
