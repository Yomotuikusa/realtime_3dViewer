/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  Bone,
  Box3,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { invalidateSkinnedBounds, pickModel } from "../src/features/viewer/pick";
import { pickSelection } from "../src/features/outliner/pick-selection";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function createSkinnedScene(): { sceneRoot: Group; mesh: SkinnedMesh; bone: Bone } {
  // 1x1 の板の全頂点を 1 本のボーンへ重み 1 で結ぶ。
  const geometry = new PlaneGeometry(1, 1);
  const count = geometry.attributes.position!.count;
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(
    Float32Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
    4,
  ));
  const bone = new Bone();
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
  mesh.add(bone);
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton([bone]));

  const nested = new Group();
  const sceneRoot = new Group();
  nested.add(mesh);
  sceneRoot.add(nested);
  sceneRoot.updateMatrixWorld(true);
  return { sceneRoot, mesh, bone };
}

function moveBone(bone: Bone, mesh: SkinnedMesh): void {
  bone.position.set(2, 0, 0);
  mesh.updateMatrixWorld(true);
}

describe("skinned mesh picking bounds", () => {
  it("does nothing for null and leaves a normal mesh geometry sphere unchanged", () => {
    invalidateSkinnedBounds(null);

    const geometry = new PlaneGeometry(1, 1);
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    const root = new Group();
    root.add(new Mesh(geometry, new MeshBasicMaterial()));

    invalidateSkinnedBounds(root);

    expect(geometry.boundingSphere).toBe(sphere);
  });

  it("invalidates boxes and spheres for nested skinned meshes only", () => {
    const { sceneRoot, mesh } = createSkinnedScene();
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    expect(mesh.boundingBox).not.toBeNull();
    expect(mesh.boundingSphere).not.toBeNull();

    invalidateSkinnedBounds(sceneRoot);

    expect(mesh.boundingBox).toBeNull();
    expect(mesh.boundingSphere).toBeNull();
  });

  it("picks the current pose after a bone moves", () => {
    const { sceneRoot, mesh, bone } = createSkinnedScene();
    const camera = createCamera();
    const raycaster = new Raycaster();

    const initial = pickModel(raycaster, camera, { x: 0, y: 0 }, sceneRoot);
    expect(initial).not.toBeNull();
    expect(initial!.point[0]).toBeCloseTo(0, 3);

    moveBone(bone, mesh);
    // fov 50°・距離 5・aspect 1 の画面半幅は 5 * tan(25°) = 2.3315。
    // x = 2 の点は 2 / 2.3315 = 0.858。
    const moved = pickModel(raycaster, camera, { x: 0.858, y: 0 }, sceneRoot);
    expect(moved).not.toBeNull();
    expect(moved!.point[0]).toBeCloseTo(2, 2);
    expect(moved!.normal).toEqual([
      expect.closeTo(0, 3),
      expect.closeTo(0, 3),
      expect.closeTo(1, 3),
    ]);

    expect(pickModel(raycaster, camera, { x: 0, y: 0 }, sceneRoot)).toBeNull();
  });

  it("ignores a stale manually assigned bounding box", () => {
    const { sceneRoot, mesh, bone } = createSkinnedScene();
    const camera = createCamera();
    const raycaster = new Raycaster();
    pickModel(raycaster, camera, { x: 0, y: 0 }, sceneRoot);
    moveBone(bone, mesh);
    mesh.boundingBox = new Box3(new Vector3(-0.5, -0.5, -0.01), new Vector3(0.5, 0.5, 0.01));

    expect(pickModel(raycaster, camera, { x: 0.858, y: 0 }, sceneRoot)).not.toBeNull();
  });

  it("keeps selection picking working after a bone moves", () => {
    const { sceneRoot, mesh, bone } = createSkinnedScene();
    const camera = createCamera();
    const raycaster = new Raycaster();
    const scenes = { v1: sceneRoot };

    expect(pickSelection(raycaster, camera, { x: 0, y: 0 }, sceneRoot, scenes)).not.toBeNull();
    moveBone(bone, mesh);

    expect(pickSelection(raycaster, camera, { x: 0.858, y: 0 }, sceneRoot, scenes)).toEqual({
      versionId: "v1",
      objectId: sceneRoot.uuid,
    });
  });

  it("invalidates skinned bounds before fit refresh", () => {
    const source = readSource("features/viewer/CameraRig.tsx");
    expect(source).toContain("invalidateSkinnedBounds(");
    expect(source.indexOf("invalidateSkinnedBounds(")).toBeLessThan(source.indexOf("bounds.refresh("));
  });
});
