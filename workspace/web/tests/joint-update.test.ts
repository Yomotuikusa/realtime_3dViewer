import {
  Bone,
  BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import {
  addJointOverlay,
  updateJointOverlay,
} from "../src/features/joint/joint-display";

function skeleton() {
  const root = new Group();
  const hip = new Bone();
  const spine = new Bone();
  hip.add(spine);
  root.add(hip);
  return { root, hip, spine };
}

function positions(overlay: ReturnType<typeof addJointOverlay>): number[] {
  const lines = overlay!.children[1] as LineSegments;
  return Array.from(lines.geometry.getAttribute("position").array as Float32Array);
}

describe("joint display updates", () => {
  it("updates sphere and link positions in root-local coordinates", () => {
    const scene = skeleton();
    scene.hip.position.set(0, 1, 0);
    scene.spine.position.set(0, 2, 0);
    const overlay = addJointOverlay(scene.root)!;
    scene.root.updateMatrixWorld(true);
    updateJointOverlay(overlay, scene.root);

    const spheres = overlay.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    spheres.getMatrixAt(0, matrix);
    matrix.decompose(position, new Quaternion(), new Vector3());
    expect(position.toArray()).toEqual([0, 1, 0]);
    spheres.getMatrixAt(1, matrix);
    matrix.decompose(position, new Quaternion(), new Vector3());
    expect(position.toArray()).toEqual([0, 3, 0]);
    expect(positions(overlay)).toEqual([0, 1, 0, 0, 3, 0]);
    expect(spheres.instanceMatrix.needsUpdate).toBe(true);
    expect(((overlay.children[1] as LineSegments).geometry.getAttribute("position") as BufferAttribute).needsUpdate)
      .toBe(true);
  });

  it("cancels the root transform and uses translation-only sphere matrices", () => {
    const scene = skeleton();
    scene.hip.position.set(0, 1, 0);
    scene.spine.position.set(0, 2, 0);
    scene.root.position.set(10, 0, 0);
    scene.root.scale.setScalar(2);
    const overlay = addJointOverlay(scene.root)!;
    scene.root.updateMatrixWorld(true);
    updateJointOverlay(overlay, scene.root);
    const spheres = overlay.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    spheres.getMatrixAt(0, matrix);
    matrix.decompose(position, quaternion, scale);
    expect(position.toArray()).toEqual([0, 1, 0]);
    expect(scale.toArray()).toEqual([1, 1, 1]);
    expect(quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(positions(overlay)).toEqual([0, 1, 0, 0, 3, 0]);
  });

  it("updates moved bones repeatedly and supports a single bone", () => {
    const scene = skeleton();
    const overlay = addJointOverlay(scene.root)!;
    scene.hip.position.set(1, 0, 0);
    scene.spine.position.set(0, 1, 0);
    scene.root.updateMatrixWorld(true);
    updateJointOverlay(overlay, scene.root);
    scene.hip.position.set(2, 0, 0);
    scene.root.updateMatrixWorld(true);
    updateJointOverlay(overlay, scene.root);
    const spheres = overlay.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    spheres.getMatrixAt(0, matrix);
    matrix.decompose(position, new Quaternion(), new Vector3());
    expect(position.toArray()).toEqual([2, 0, 0]);
    const before = positions(overlay);
    updateJointOverlay(overlay, scene.root);
    expect(positions(overlay)).toEqual(before);

    const singleRoot = new Group();
    singleRoot.add(new Bone());
    const singleOverlay = addJointOverlay(singleRoot)!;
    singleRoot.updateMatrixWorld(true);
    expect(() => updateJointOverlay(singleOverlay, singleRoot)).not.toThrow();
    expect((singleOverlay.children[0] as InstancedMesh).count).toBe(1);
  });
});
