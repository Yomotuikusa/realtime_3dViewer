import { BufferGeometry, Float32BufferAttribute } from "three";
import type { BufferAttribute } from "three";
import {
  type ClipTriangle,
  clipTriangleAtOrAbove,
} from "./triangle-clip";

/** 飛び出し(距離 ≥ threshold)三角形の group の materialIndex */
export const DIFFERENCE_OUTSIDE_MATERIAL = 0;
/** へこみ(距離 ≤ -threshold)三角形の group の materialIndex */
export const DIFFERENCE_INSIDE_MATERIAL = 1;

interface OutputVertex {
  from: number;
  to: number;
  t: number;
}

function distanceAt(
  signedDistance: ArrayLike<number>,
  vertex: number,
  positionCount: number,
): number {
  if (vertex < 0 || vertex >= positionCount || vertex >= signedDistance.length) return 0;
  const value = signedDistance[vertex]!;
  return Number.isFinite(value) ? value : 0;
}

function component(attribute: BufferAttribute, vertex: number, index: number): number {
  switch (index) {
    case 0: return attribute.getX(vertex);
    case 1: return attribute.getY(vertex);
    case 2: return attribute.getZ(vertex);
    case 3: return attribute.getW(vertex);
    default: return 0;
  }
}

function appendVector(
  output: number[],
  attribute: BufferAttribute,
  point: OutputVertex,
  normalize: boolean,
): void {
  let x = component(attribute, point.from, 0) + (component(attribute, point.to, 0) - component(attribute, point.from, 0)) * point.t;
  let y = component(attribute, point.from, 1) + (component(attribute, point.to, 1) - component(attribute, point.from, 1)) * point.t;
  let z = component(attribute, point.from, 2) + (component(attribute, point.to, 2) - component(attribute, point.from, 2)) * point.t;
  if (normalize) {
    const length = Math.hypot(x, y, z);
    if (length > 0) {
      x /= length;
      y /= length;
      z /= length;
    }
  }
  output.push(x, y, z);
}

function appendDiscrete(output: number[], attribute: BufferAttribute, point: OutputVertex): void {
  const vertex = point.t < 0.5 ? point.from : point.to;
  for (let componentIndex = 0; componentIndex < 4; componentIndex += 1) {
    output.push(component(attribute, vertex, componentIndex));
  }
}

function appendClips(
  output: OutputVertex[],
  clips: ClipTriangle[],
  sourceIndices: readonly [number, number, number],
): void {
  for (const clip of clips) {
    for (const point of clip) {
      output.push({
        from: sourceIndices[point.from],
        to: sourceIndices[point.to],
        t: point.t,
      });
    }
  }
}

function appendClippedAttributes(
  points: OutputVertex[],
  position: BufferAttribute,
  positionOutput: number[],
  normal: BufferAttribute | undefined,
  normalOutput: number[],
  skinIndex: BufferAttribute | undefined,
  skinWeight: BufferAttribute | undefined,
  skinIndexOutput: number[],
  skinWeightOutput: number[],
  morphPositions: BufferAttribute[],
  morphOutputs: number[][],
): void {
  for (const point of points) {
    appendVector(positionOutput, position, point, false);
    if (normal) appendVector(normalOutput, normal, point, true);
    if (skinIndex && skinWeight) {
      appendDiscrete(skinIndexOutput, skinIndex, point);
      appendDiscrete(skinWeightOutput, skinWeight, point);
    }
    morphPositions.forEach((morph, index) => appendVector(morphOutputs[index]!, morph, point, false));
  }
}

function readTriangleIndices(
  index: BufferAttribute | null,
  triangle: number,
): [number, number, number] {
  const first = triangle * 3;
  if (!index) return [first, first + 1, first + 2];
  return [index.getX(first), index.getX(first + 1), index.getX(first + 2)];
}

/** source の距離しきい値以上の領域だけを、非 index geometry として切り出す。 */
export function buildDifferenceGeometry(
  source: BufferGeometry,
  signedDistance: ArrayLike<number>,
  threshold: number,
): BufferGeometry {
  const position = source.getAttribute("position") as BufferAttribute | undefined;
  const normal = source.getAttribute("normal") as BufferAttribute | undefined;
  const skinIndex = source.getAttribute("skinIndex") as BufferAttribute | undefined;
  const skinWeight = source.getAttribute("skinWeight") as BufferAttribute | undefined;
  const morphPositions = (source.morphAttributes.position ?? []) as BufferAttribute[];
  const sourceIndex = source.getIndex();
  const points: OutputVertex[] = [];
  const outsidePoints: OutputVertex[] = [];
  const insidePoints: OutputVertex[] = [];

  if (position) {
    const triangleCount = Math.floor((sourceIndex?.count ?? position.count) / 3);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const indices = readTriangleIndices(sourceIndex, triangle);
      const values = indices.map((index) => distanceAt(signedDistance, index, position.count)) as [number, number, number];
      appendClips(outsidePoints, clipTriangleAtOrAbove(values, threshold), indices);
      appendClips(
        insidePoints,
        clipTriangleAtOrAbove(values.map((value) => -value) as [number, number, number], threshold),
        indices,
      );
    }
  }
  points.push(...outsidePoints, ...insidePoints);

  const positionOutput: number[] = [];
  const normalOutput: number[] = [];
  const skinIndexOutput: number[] = [];
  const skinWeightOutput: number[] = [];
  const morphOutputs = morphPositions.map(() => [] as number[]);
  if (position) {
    appendClippedAttributes(
      points,
      position,
      positionOutput,
      normal,
      normalOutput,
      skinIndex && skinWeight ? skinIndex : undefined,
      skinIndex && skinWeight ? skinWeight : undefined,
      skinIndexOutput,
      skinWeightOutput,
      morphPositions,
      morphOutputs,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positionOutput, 3));
  if (normal) geometry.setAttribute("normal", new Float32BufferAttribute(normalOutput, 3));
  if (skinIndex && skinWeight) {
    geometry.setAttribute("skinIndex", new Float32BufferAttribute(skinIndexOutput, 4));
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeightOutput, 4));
  }
  morphOutputs.forEach((output) => {
    if (!geometry.morphAttributes.position) geometry.morphAttributes.position = [];
    geometry.morphAttributes.position.push(new Float32BufferAttribute(output, 3));
  });
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  if (!normal) geometry.computeVertexNormals();

  const outsideCount = outsidePoints.length;
  const insideCount = insidePoints.length;
  geometry.addGroup(0, outsideCount, DIFFERENCE_OUTSIDE_MATERIAL);
  geometry.addGroup(outsideCount, insideCount, DIFFERENCE_INSIDE_MATERIAL);
  return geometry;
}
