import type { Vec3 } from "./types";

/** モデルの最大辺長から simplify の許容誤差を決める(modelSize * 0.001) */
export function simplifyTolerance(modelSize: number): number {
  return modelSize * 0.001;
}

function clonePoint(point: Vec3): Vec3 {
  return [...point];
}

function clonePoints(points: Vec3[]): Vec3[] {
  return points.map(clonePoint);
}

function pointToSegmentDistanceSquared(point: Vec3, start: Vec3, end: Vec3): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const lengthSquared = dx * dx + dy * dy + dz * dz;

  if (lengthSquared === 0) {
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2 + (point[2] - start[2]) ** 2;
  }

  const projection =
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy + (point[2] - start[2]) * dz) /
    lengthSquared;
  const ratio = Math.max(0, Math.min(1, projection));
  const nearestX = start[0] + dx * ratio;
  const nearestY = start[1] + dy * ratio;
  const nearestZ = start[2] + dz * ratio;
  return (point[0] - nearestX) ** 2 + (point[1] - nearestY) ** 2 + (point[2] - nearestZ) ** 2;
}

/** Ramer–Douglas–Peucker(3D)。再帰を使わず、深い折れ線も処理する。 */
export function simplify(points: Vec3[], tolerance: number): Vec3[] {
  if (points.length <= 2 || tolerance <= 0) {
    return clonePoints(points);
  }

  const kept = new Set<number>([0, points.length - 1]);
  const pending: Array<[number, number]> = [[0, points.length - 1]];
  const toleranceSquared = tolerance * tolerance;

  while (pending.length > 0) {
    const [startIndex, endIndex] = pending.pop()!;
    let furthestIndex = -1;
    let furthestDistanceSquared = toleranceSquared;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distanceSquared = pointToSegmentDistanceSquared(
        points[index],
        points[startIndex],
        points[endIndex],
      );
      if (distanceSquared > furthestDistanceSquared) {
        furthestDistanceSquared = distanceSquared;
        furthestIndex = index;
      }
    }

    if (furthestIndex !== -1) {
      kept.add(furthestIndex);
      pending.push([startIndex, furthestIndex], [furthestIndex, endIndex]);
    }
  }

  return points.filter((_point, index) => kept.has(index)).map(clonePoint);
}

/** 送信可能か: 2 点以上 2000 点以下 */
export function isSendableStroke(points: Vec3[]): boolean {
  return points.length >= 2 && points.length <= 2000;
}
