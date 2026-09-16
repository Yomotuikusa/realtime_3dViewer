import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, SphereGeometry } from "three";
import { describe, expect, it, vi } from "vitest";
import { VIEWER_OVERLAY_KEY, isViewerOverlay } from "../src/features/viewer/mesh-display";
import { jointRadius } from "../src/features/joint/joint-display";
import {
  addSelectedJointMarker,
  removeSelectedJointMarker,
  SELECTED_JOINT_COLOR,
  SELECTED_JOINT_RADIUS_SCALE,
  SELECTED_JOINT_RENDER_ORDER,
  selectedJointMarkerOf,
  updateSelectedJointMarker,
} from "../src/features/joint/joint-highlight";

function scene(): { root: Group; first: Bone; second: Bone } {
  const root = new Group();
  const first = new Bone();
  const second = new Bone();
  root.add(first, second);
  return { root, first, second };
}

describe("joint highlight", () => {
  it("creates one marked, non-raycast orange marker with the scaled radius", () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    root.add(body);
    const bone = new Bone();
    root.add(bone);
    const radius = jointRadius(root, 2);
    const marker = addSelectedJointMarker(root, bone, SELECTED_JOINT_COLOR, 2);
    const material = marker.material as MeshBasicMaterial;

    expect(root.children).toContain(marker);
    expect(marker.userData.selectedJointMarker).toBe(true);
    expect(marker.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(isViewerOverlay(marker)).toBe(true);
    expect(marker.userData.bone).toBe(bone);
    expect(marker.renderOrder).toBe(SELECTED_JOINT_RENDER_ORDER);
    expect(material.color.getHex()).toBe(SELECTED_JOINT_COLOR);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect((marker.geometry as SphereGeometry).parameters.radius).toBe(radius * SELECTED_JOINT_RADIUS_SCALE);

    const intersections: never[] = [];
    marker.raycast(new Raycaster(), intersections);
    expect(intersections).toEqual([]);
  });

  it("is idempotent and replaces only the selected bone", () => {
    const { root, first, second } = scene();
    const marker = addSelectedJointMarker(root, first, SELECTED_JOINT_COLOR);
    expect(addSelectedJointMarker(root, second, 0xff0000)).toBe(marker);
    expect(root.children).toHaveLength(3);
    expect(selectedJointMarkerOf(root)).toBe(marker);
    expect(marker.userData.bone).toBe(second);
    expect((marker.material as MeshBasicMaterial).color.getHex()).toBe(0xff0000);
  });

  it("updates to root-local bone coordinates and disposes resources", () => {
    const root = new Group();
    const bone = new Bone();
    bone.position.set(1, 0, 0);
    root.add(bone);
    root.position.set(2, 3, 4);
    root.rotation.z = Math.PI / 2;
    root.updateMatrixWorld(true);
    bone.updateMatrixWorld(true);
    const marker = addSelectedJointMarker(root, bone, SELECTED_JOINT_COLOR);
    updateSelectedJointMarker(marker, root);
    expect(marker.position.x).toBeCloseTo(1);
    expect(marker.position.y).toBeCloseTo(0);
    expect(marker.position.z).toBeCloseTo(0);

    const geometry = vi.spyOn(marker.geometry, "dispose");
    const material = vi.spyOn(marker.material as MeshBasicMaterial, "dispose");
    removeSelectedJointMarker(root);
    expect(selectedJointMarkerOf(root)).toBeNull();
    expect(geometry).toHaveBeenCalledOnce();
    expect(material).toHaveBeenCalledOnce();
    expect(() => removeSelectedJointMarker(root)).not.toThrow();
  });
});
