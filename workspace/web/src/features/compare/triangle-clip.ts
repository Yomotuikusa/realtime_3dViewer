/** 三角形内のローカル頂点番号 */
export type Corner = 0 | 1 | 2;

/** 切り出した三角形の頂点を表す、元の三角形の辺上の位置。 */
export interface ClipVertex {
  from: Corner;
  to: Corner;
  t: number;
}

/** 元の三角形と同じ巻き順を保つ切断後の三角形。 */
export type ClipTriangle = readonly [ClipVertex, ClipVertex, ClipVertex];

function vertex(corner: Corner): ClipVertex {
  return { from: corner, to: corner, t: 0 };
}

function edge(
  from: Corner,
  to: Corner,
  values: readonly [number, number, number],
  threshold: number,
): ClipVertex {
  const t = (threshold - values[from]) / (values[to] - values[from]);
  return {
    from,
    to,
    t: t === 0 ? 0 : t,
  };
}

/** 三角形のしきい値以上の領域を、元の巻き順のまま三角形へ分割する。 */
export function clipTriangleAtOrAbove(
  values: readonly [number, number, number],
  threshold: number,
): ClipTriangle[] {
  const above = values.map((value) => value >= threshold) as [boolean, boolean, boolean];
  const count = above.filter(Boolean).length;
  if (count === 0) return [];
  if (count === 3) return [[vertex(0), vertex(1), vertex(2)]];

  if (count === 1) {
    const k = above[0] ? 0 : above[1] ? 1 : 2;
    const next = ((k + 1) % 3) as Corner;
    const prev = ((k + 2) % 3) as Corner;
    return [[vertex(k), edge(k, next, values, threshold), edge(k, prev, values, threshold)]];
  }

  let k: Corner = 0;
  for (const candidate of [0, 1, 2] as const) {
    const next = ((candidate + 1) % 3) as Corner;
    const prev = ((candidate + 2) % 3) as Corner;
    if (above[candidate] && above[next] && !above[prev]) {
      k = candidate;
      break;
    }
  }
  const next = ((k + 1) % 3) as Corner;
  const prev = ((k + 2) % 3) as Corner;
  const crossing = edge(next, prev, values, threshold);
  return [
    [vertex(k), vertex(next), crossing],
    [vertex(k), crossing, edge(k, prev, values, threshold)],
  ];
}
