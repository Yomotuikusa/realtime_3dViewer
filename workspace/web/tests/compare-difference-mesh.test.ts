import {
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Skeleton,
  SkinnedMesh,
  Vector3,
} from "three";
import { describe, expect, it, vi } from "vitest";
import {
  applyCompareDifference,
  clearCompareDifferences,
  createCompareDifference,
  isMeshCompareDifference,
  MESH_COMPARE_DIFFERENCE_KEY,
  MESH_COMPARE_DIFFERENCE_SOURCE_KEY,
} from "../src/features/compare/difference-mesh";
import { applyMeshDisplay } from "../src/features/viewer/mesh-display";

function box(): Mesh {
  return new Mesh(new BoxGeometry(), new MeshStandardMaterial());
}

function skinnedMesh(): SkinnedMesh {
  const geometry = new BoxGeometry();
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("skinIndex", new Float32BufferAttribute(count * 4, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(count * 4, 4));
  geometry.morphAttributes.position = [geometry.getAttribute("position").clone()];
  geometry.morphTargetsRelative = true;
  const bone = new Bone();
  const skeleton = new Skeleton([bone]);
  const result = new SkinnedMesh(geometry, new MeshStandardMaterial());
  result.morphTargetInfluences = [0.5];
  result.add(bone);
  result.bind(skeleton);
  return result;
}

function groups(mesh: Mesh): number[][] {
  return mesh.geometry.groups.map(({ start, count, materialIndex }) => [start, count, materialIndex ?? 0]);
}

const colors = { outside: 0xff0000, inside: 0x0000ff };
const d1 = new Float32Array(24).fill(1);

describe("compare difference mesh", () => {
  it("creates an unattached marked empty Mesh with disabled raycasting", () => {
    const source = box();
    const difference = createCompareDifference(source);
    expect(difference).toBeInstanceOf(Mesh);
    expect(difference).not.toBeInstanceOf(SkinnedMesh);
    expect(difference.geometry.getAttribute("position")).toBeUndefined();
    expect(difference.material).toHaveLength(2);
    expect(difference.raycast(new Raycaster(), [])).toBeUndefined();
    expect(difference.frustumCulled).toBe(false);
    expect(difference.userData[MESH_COMPARE_DIFFERENCE_KEY]).toBe(true);
    expect(difference.userData.viewerOverlay).toBe(true);
    expect(source.children).toHaveLength(0);
  });

  it("shares skinning state when the source is a SkinnedMesh", () => {
    const source = skinnedMesh();
    const difference = createCompareDifference(source) as SkinnedMesh;
    expect(difference).toBeInstanceOf(SkinnedMesh);
    expect(difference.skeleton).toBe(source.skeleton);
    expect(difference.bindMode).toBe(source.bindMode);
    expect(difference.bindMatrix.equals(source.bindMatrix)).toBe(true);
    expect(difference.morphTargetInfluences).toBe(source.morphTargetInfluences);
    expect(difference.morphTargetDictionary).toBe(source.morphTargetDictionary);
  });

  it("creates, reuses, recolors, hides, and rebuilds the difference geometry", () => {
    const source = box();
    const first = applyCompareDifference(source, d1, 0.5, colors);
    expect(source.children).toEqual([first]);
    expect(isMeshCompareDifference(first)).toBe(true);
    expect(first.geometry.getAttribute("position").count).toBe(36);
    expect(groups(first)).toEqual([[0, 36, 0], [36, 0, 1]]);
    expect((first.material as MeshStandardMaterial[])[0]!.color.getHex()).toBe(0xff0000);
    expect(first.visible).toBe(true);
    expect(first.userData[MESH_COMPARE_DIFFERENCE_SOURCE_KEY]).toMatchObject({ signedDistance: d1, threshold: 0.5 });
    expect((first.userData[MESH_COMPARE_DIFFERENCE_SOURCE_KEY] as { signedDistance: Float32Array }).signedDistance).toBe(d1);

    const same = applyCompareDifference(source, d1, 0.5, { outside: 1, inside: 2 });
    expect(same).toBe(first);
    expect(same.geometry).toBe(first.geometry);
    applyCompareDifference(source, d1, 0.5, colors, { visible: false });
    expect(first.visible).toBe(false);
    applyCompareDifference(source, d1, 0.5, colors);
    expect(first.visible).toBe(true);
    expect((first.material as MeshStandardMaterial[])[0]!.color.getHex()).toBe(0xff0000);
    expect((first.material as MeshStandardMaterial[])[1]!.color.getHex()).toBe(0x0000ff);

    const oldGeometry = first.geometry;
    const dispose = vi.spyOn(oldGeometry, "dispose");
    const rebuilt = applyCompareDifference(source, d1, 0.25, colors);
    expect(rebuilt).toBe(first);
    expect(rebuilt.geometry).not.toBe(oldGeometry);
    expect(dispose).toHaveBeenCalledOnce();
    const newDistance = new Float32Array(24).fill(1);
    const previousGeometry = rebuilt.geometry;
    const rebuiltAgain = applyCompareDifference(source, newDistance, 0.25, colors);
    expect(rebuiltAgain.geometry).not.toBe(previousGeometry);
  });

  it("keeps inside groups and skin/morph attributes", () => {
    const source = box();
    const inside = applyCompareDifference(source, new Float32Array(24).fill(-1), 0.5, colors);
    expect(groups(inside)).toEqual([[0, 0, 0], [0, 36, 1]]);
    expect((inside.material as MeshStandardMaterial[])[1]!.color.getHex()).toBe(0x0000ff);

    const skinned = applyCompareDifference(skinnedMesh(), d1, 0.5, colors) as SkinnedMesh;
    expect(skinned).toBeInstanceOf(SkinnedMesh);
    expect(skinned.geometry.getAttribute("skinIndex").itemSize).toBe(4);
    expect(skinned.geometry.getAttribute("skinWeight").itemSize).toBe(4);
    expect(skinned.geometry.morphAttributes.position).toHaveLength(1);
    expect(skinned.geometry.morphTargetsRelative).toBe(true);
  });

  it("does not add difference hits and coexists with mesh display", () => {
    const root = new Group();
    const source = box();
    root.add(source);
    const difference = applyCompareDifference(source, d1, 0.5, colors);
    root.updateMatrixWorld(true);
    const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
    const hits = raycaster.intersectObject(source, true);
    expect(hits.some((hit) => hit.object === difference)).toBe(false);
    expect(hits.some((hit) => hit.object === source)).toBe(true);

    applyMeshDisplay(root, "solid-wireframe");
    expect((difference.material as MeshStandardMaterial[])[0]!.wireframe).toBe(false);
    expect(source.children.filter(isMeshCompareDifference)).toHaveLength(1);
    applyMeshDisplay(root, "solid");
    expect(source.children).toContain(difference);
  });

  it("clears all differences while preserving source meshes", () => {
    const root = new Group();
    const first = box();
    const second = box();
    const firstDifference = applyCompareDifference(first, d1, 0.5, colors);
    const secondDifference = applyCompareDifference(second, d1, 0.5, colors);
    root.add(first, second);
    const disposals = [
      vi.spyOn(firstDifference.geometry, "dispose"),
      vi.spyOn(secondDifference.geometry, "dispose"),
      vi.spyOn((firstDifference.material as MeshStandardMaterial[])[0]!, "dispose"),
      vi.spyOn((firstDifference.material as MeshStandardMaterial[])[1]!, "dispose"),
      vi.spyOn((secondDifference.material as MeshStandardMaterial[])[0]!, "dispose"),
      vi.spyOn((secondDifference.material as MeshStandardMaterial[])[1]!, "dispose"),
    ];
    clearCompareDifferences(root);
    expect(firstDifference.parent).toBeNull();
    expect(secondDifference.parent).toBeNull();
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
    expect(root.children).toEqual([first, second]);
    expect(() => clearCompareDifferences(new Group())).not.toThrow();
  });
});
