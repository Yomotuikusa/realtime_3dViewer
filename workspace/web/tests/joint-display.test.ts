import {
  Bone,
  BoxGeometry,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";
import {
  addJointOverlay,
  collectJoints,
  JOINT_COLOR,
  JOINT_FALLBACK_RADIUS,
  JOINT_LINK_COLOR,
  JOINT_OVERLAY_KEY,
  JOINT_RADIUS_RATIO,
  JOINT_XRAY_RENDER_ORDER,
  jointLinks,
  jointOverlayOf,
  removeJointOverlay,
  setJointOverlayXray,
} from "../src/features/joint/joint-display";

function createScene() {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  const hip = new Bone();
  hip.name = "Hip";
  const spine = new Bone();
  spine.name = "Spine";
  const head = new Bone();
  head.name = "Head";
  const tail = new Bone();
  tail.name = "Tail";
  const ignored = new Group();
  ignored.userData[VIEWER_OVERLAY_KEY] = true;
  ignored.add(new Bone());
  hip.add(spine);
  spine.add(head);
  hip.add(tail);
  root.add(body, hip, ignored);
  return { root, body, hip, spine, head, tail };
}

describe("joint display", () => {
  it("collects bones in order and stops at viewer overlays", () => {
    const scene = createScene();
    expect(collectJoints(scene.root)).toEqual([scene.hip, scene.spine, scene.head, scene.tail]);
    expect(collectJoints(scene.hip)[0]).toBe(scene.hip);
    expect(collectJoints(new Group())).toEqual([]);
  });

  it("creates links only when a direct bone parent is included", () => {
    const scene = createScene();
    expect(jointLinks([scene.hip, scene.spine, scene.head, scene.tail])).toEqual([
      [scene.hip, scene.spine],
      [scene.spine, scene.head],
      [scene.hip, scene.tail],
    ]);
    expect(jointLinks([scene.spine, scene.head])).toEqual([[scene.spine, scene.head]]);
    expect(jointLinks([scene.hip])).toEqual([]);
  });

  it("creates an idempotent, marked two-child overlay", () => {
    const scene = createScene();
    scene.root.updateMatrixWorld(true);
    const overlay = addJointOverlay(scene.root)!;
    expect(scene.root.children).toHaveLength(4);
    expect(addJointOverlay(scene.root)).toBe(overlay);
    expect(scene.root.children).toHaveLength(4);
    expect(jointOverlayOf(scene.root)).toBe(overlay);
    expect(overlay.userData[JOINT_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData.joints).toEqual(collectJoints(scene.root));
    expect(overlay.userData.links).toEqual(jointLinks(overlay.userData.joints));
    expect(overlay.children).toHaveLength(2);
    expect(overlay.children[0]).toBeInstanceOf(InstancedMesh);
    expect(overlay.children[1]).toBeInstanceOf(LineSegments);
    expect(overlay.children.every((child) => child.userData[VIEWER_OVERLAY_KEY] === true)).toBe(true);
    const raycaster = new Raycaster();
    const intersections: never[] = [];
    for (const object of [overlay, ...overlay.children]) {
      object.raycast(raycaster, intersections);
      expect(intersections).toEqual([]);
    }

    const spheres = overlay.children[0] as InstancedMesh;
    const lines = overlay.children[1] as LineSegments;
    expect(spheres.count).toBe(4);
    expect(lines.geometry.getAttribute("position").count).toBe(6);
    expect(spheres.frustumCulled).toBe(false);
    expect(lines.frustumCulled).toBe(false);
    expect((spheres.material as MeshBasicMaterial).depthWrite).toBe(false);
    expect((spheres.material as MeshBasicMaterial).toneMapped).toBe(false);
    expect((spheres.material as MeshBasicMaterial).color.getHex()).toBe(JOINT_COLOR);
    expect((lines.material as MeshBasicMaterial).depthWrite).toBe(false);
    expect((lines.material as MeshBasicMaterial).toneMapped).toBe(false);
    expect((lines.material as MeshBasicMaterial).color.getHex()).toBe(JOINT_LINK_COLOR);
    expect((spheres.geometry as SphereGeometry).parameters.radius).toBe(2 * JOINT_RADIUS_RATIO);
  });

  it("uses the fallback radius for a zero-sized skeleton", () => {
    const root = new Group();
    const bone = new Bone();
    root.add(bone);
    const overlay = addJointOverlay(root)!;
    const spheres = overlay.children[0] as InstancedMesh;
    expect((spheres.geometry as SphereGeometry).parameters.radius).toBe(JOINT_FALLBACK_RADIUS);
  });

  it("starts in x-ray mode and switches depth testing and order", () => {
    const scene = createScene();
    const overlay = addJointOverlay(scene.root)!;
    const spheres = overlay.children[0] as InstancedMesh;
    const lines = overlay.children[1] as LineSegments;
    expect((spheres.material as MeshBasicMaterial).depthTest).toBe(false);
    expect((lines.material as MeshBasicMaterial).depthTest).toBe(false);
    expect(overlay.renderOrder).toBe(JOINT_XRAY_RENDER_ORDER);
    expect(spheres.renderOrder).toBe(JOINT_XRAY_RENDER_ORDER);
    const sphereMaterialVersion = (spheres.material as MeshBasicMaterial).version;
    setJointOverlayXray(overlay, false);
    expect((spheres.material as MeshBasicMaterial).depthTest).toBe(true);
    expect((lines.material as MeshBasicMaterial).depthTest).toBe(true);
    expect((spheres.material as MeshBasicMaterial).needsUpdate).toBe(true);
    expect((spheres.material as MeshBasicMaterial).version).toBeGreaterThan(sphereMaterialVersion);
    expect(overlay.renderOrder).toBe(0);
    expect(spheres.renderOrder).toBe(0);
    setJointOverlayXray(overlay, true);
    expect((spheres.material as MeshBasicMaterial).depthTest).toBe(false);
    expect(overlay.renderOrder).toBe(JOINT_XRAY_RENDER_ORDER);
  });

  it("does not add overlays without bones and disposes created resources", () => {
    const root = new Group();
    expect(addJointOverlay(root)).toBeNull();
    expect(root.children).toHaveLength(0);
    expect(jointOverlayOf(root)).toBeNull();

    const scene = createScene();
    const overlay = addJointOverlay(scene.root)!;
    const spheres = overlay.children[0] as InstancedMesh;
    const lines = overlay.children[1] as LineSegments;
    const sphereGeometry = vi.spyOn(spheres.geometry, "dispose");
    const sphereMaterial = vi.spyOn(spheres.material as MeshBasicMaterial, "dispose");
    const lineGeometry = vi.spyOn(lines.geometry, "dispose");
    const lineMaterial = vi.spyOn(lines.material as MeshBasicMaterial, "dispose");
    removeJointOverlay(scene.root);
    expect(jointOverlayOf(scene.root)).toBeNull();
    expect(sphereGeometry).toHaveBeenCalledOnce();
    expect(sphereMaterial).toHaveBeenCalledOnce();
    expect(lineGeometry).toHaveBeenCalledOnce();
    expect(lineMaterial).toHaveBeenCalledOnce();
    expect(() => removeJointOverlay(scene.root)).not.toThrow();
    expect(addJointOverlay(scene.root)).not.toBe(overlay);
  });
});
