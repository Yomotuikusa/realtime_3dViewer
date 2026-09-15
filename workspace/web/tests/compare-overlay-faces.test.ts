import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import {
  compareSourceIndex,
  COMPARE_OVERLAY_OPACITY,
  colorizeDeviation,
  createCompareOverlayGeometry,
  expandByIndex,
} from "../src/features/compare/overlay";

const COLORS = { outside: 0xff0000, inside: 0x00ff00 };

function rgba(geometry: BufferGeometry, vertex: number): number[] {
  const color = geometry.getAttribute("color") as Float32BufferAttribute;
  return [color.getX(vertex), color.getY(vertex), color.getZ(vertex), color.getW(vertex)];
}

function expectRgba(geometry: BufferGeometry, vertex: number, expected: number[]): void {
  rgba(geometry, vertex).forEach((value, component) => expect(value).toBeCloseTo(expected[component]!, 6));
}

function expectFace(geometry: BufferGeometry, face: number, color: Color | null): void {
  const expected = color ? [color.r, color.g, color.b, COMPARE_OVERLAY_OPACITY] : [0, 0, 0, 0];
  for (let corner = 0; corner < 3; corner += 1) expectRgba(geometry, face * 3 + corner, expected);
}

function box(): Mesh {
  return new Mesh(new BoxGeometry(), new MeshStandardMaterial());
}

describe("compare overlay faces", () => {
  it("expands indexed attributes in index order and preserves item size", () => {
    const position = new Float32BufferAttribute([
      0, 1, 2,
      3, 4, 5,
      6, 7, 8,
      9, 10, 11,
    ], 3);
    const itemFour = new Float32BufferAttribute([
      0, 1, 2, 3,
      4, 5, 6, 7,
      8, 9, 10, 11,
      12, 13, 14, 15,
    ], 4);
    const index = new BufferAttribute(new Uint16Array([0, 2, 1, 2, 3, 1]), 1);

    const expandedPosition = expandByIndex(position, index);
    const expandedItemFour = expandByIndex(itemFour, index);
    expect(expandedPosition.count).toBe(6);
    expect(expandedPosition.itemSize).toBe(3);
    expect(expandedPosition.getX(1)).toBe(position.getX(2));
    expect(expandedPosition.getY(1)).toBe(position.getY(2));
    expect(expandedPosition.getZ(1)).toBe(position.getZ(2));
    expect(expandedPosition).not.toBe(position);
    expect(expandedItemFour.itemSize).toBe(4);
    expect(expandedItemFour.count).toBe(6);
  });

  it("creates an indexed overlay with its source vertex mapping", () => {
    const source = box();
    const geometry = createCompareOverlayGeometry(source);
    const sourceIndex = source.geometry.getIndex()!;

    expect(geometry.getIndex()).toBeNull();
    expect(geometry.getAttribute("position").count).toBe(36);
    expect(geometry.getAttribute("position")).not.toBe(source.geometry.getAttribute("position"));
    expect(geometry.getAttribute("color").count).toBe(36);
    expect(geometry.getAttribute("color").itemSize).toBe(4);
    expect(Array.from(geometry.getAttribute("color").array as Float32Array).every((value) => value === 0)).toBe(true);
    expect(geometry.getAttribute("normal")).toBeUndefined();
    expect(geometry.getAttribute("uv")).toBeUndefined();
    expect(compareSourceIndex(geometry)).toBe(sourceIndex.array);
    expect(source.geometry.getIndex()).toBe(sourceIndex);
  });

  it("shares attributes for non-indexed geometry and handles missing position", () => {
    const source = box();
    const nonIndexed = new Mesh((source.geometry as BoxGeometry).toNonIndexed(), new MeshBasicMaterial());
    const geometry = createCompareOverlayGeometry(nonIndexed);
    expect(geometry.getAttribute("position")).toBe(nonIndexed.geometry.getAttribute("position"));
    expect(geometry.getAttribute("position").count).toBe(36);
    expect(compareSourceIndex(geometry)).toBeNull();

    const empty = createCompareOverlayGeometry(new Mesh(new BufferGeometry(), new MeshBasicMaterial()));
    expect(empty.getAttribute("color").count).toBe(0);
  });

  it("selects the largest absolute distance and paints complete faces", () => {
    const geometry = createCompareOverlayGeometry(box());
    const outside = new Color(COLORS.outside);
    const inside = new Color(COLORS.inside);

    colorizeDeviation(geometry, new Float32Array([1, -1, 0, 0.1]), 0.5, COLORS);
    expectFace(geometry, 0, outside);
    expectFace(geometry, 1, inside);
    expectFace(geometry, 2, null);

    colorizeDeviation(geometry, new Float32Array([0.05, -0.05, 0, 0]), 0.1, COLORS);
    expectFace(geometry, 0, null);
    expectFace(geometry, 1, null);

    colorizeDeviation(geometry, new Float32Array([0.3, -0.3, 0, 0]), 0.1, COLORS);
    expectFace(geometry, 0, outside);
    expectFace(geometry, 1, inside);
  });

  it("ignores non-finite and out-of-range distances", () => {
    const geometry = createCompareOverlayGeometry(box());
    const outside = new Color(COLORS.outside);
    const inside = new Color(COLORS.inside);

    colorizeDeviation(geometry, new Float32Array([NaN, 0.2, Infinity, -Infinity]), 0.1, COLORS);
    expectFace(geometry, 0, outside);
    expectFace(geometry, 1, outside);
    colorizeDeviation(geometry, new Float32Array([NaN, NaN, NaN, NaN]), 0.1, COLORS);
    expectFace(geometry, 0, null);
    colorizeDeviation(geometry, new Float32Array([0.2, -0.2, 0, 0]), 0, COLORS);
    expectFace(geometry, 0, outside);
    expectFace(geometry, 1, inside);
    colorizeDeviation(geometry, new Float32Array([0, 0, 0, 0]), 0, COLORS);
    expectFace(geometry, 0, null);

    colorizeDeviation(geometry, new Float32Array([1]), 0, COLORS);
    expectFace(geometry, 0, outside);
    expectFace(geometry, 1, null);
    colorizeDeviation(geometry, new Float32Array(100).fill(-1), 0, COLORS);
    expectFace(geometry, 0, inside);
    expectFace(geometry, 11, inside);
  });

  it("uses local vertices for non-indexed geometry", () => {
    const source = new Mesh(new BoxGeometry().toNonIndexed(), new MeshStandardMaterial());
    const geometry = createCompareOverlayGeometry(source);
    const outside = new Color(COLORS.outside);
    colorizeDeviation(geometry, new Float32Array([1, 0, 0]), 0.5, COLORS);
    expectFace(geometry, 0, outside);
    expectFace(geometry, 1, null);
  });

  it("does nothing without a four-component color attribute", () => {
    const withoutColor = new BufferGeometry();
    expect(() => colorizeDeviation(withoutColor, new Float32Array([1]), 0, COLORS)).not.toThrow();

    const wrongColor = new BufferGeometry();
    const color = new Float32BufferAttribute(9, 3);
    wrongColor.setAttribute("color", color);
    colorizeDeviation(wrongColor, new Float32Array([1]), 0, COLORS);
    expect(color.version).toBe(0);
    expect(Array.from(color.array as Float32Array).every((value) => value === 0)).toBe(true);
  });
});
