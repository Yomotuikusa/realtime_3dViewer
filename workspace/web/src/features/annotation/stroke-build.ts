import { isSendableStroke, simplify, simplifyTolerance } from "@shared/stroke";
import type { Stroke, Vec3 } from "@shared/types";

export const NORMAL_OFFSET_RATIO = 0.002;

export function offsetAlongNormal(point: Vec3, normal: Vec3 | null, modelSize: number): Vec3 {
  if (normal === null) {
    return [...point];
  }
  const offset = modelSize * NORMAL_OFFSET_RATIO;
  return [
    point[0] + normal[0] * offset,
    point[1] + normal[1] * offset,
    point[2] + normal[2] * offset,
  ];
}

export function buildStroke(
  points: Vec3[],
  meta: { id: string; userId: string; color: string; createdAt: number; modelSize: number },
): Stroke | null {
  const simplified = simplify(points, simplifyTolerance(meta.modelSize));
  if (!isSendableStroke(simplified)) {
    return null;
  }
  return {
    id: meta.id,
    userId: meta.userId,
    color: meta.color,
    points: simplified,
    createdAt: meta.createdAt,
  };
}

export function latestOwnStrokeId(strokes: Record<string, Stroke>, userId: string): string | null {
  let latest: Stroke | null = null;
  for (const stroke of Object.values(strokes)) {
    if (stroke.userId !== userId) {
      continue;
    }
    if (
      latest === null
      || stroke.createdAt > latest.createdAt
      || (stroke.createdAt === latest.createdAt && stroke.id > latest.id)
    ) {
      latest = stroke;
    }
  }
  return latest?.id ?? null;
}
