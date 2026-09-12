import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";
import { objectPartRefOf, resolveTrailTarget } from "../src/features/trail/trail-target";

function hierarchy(): { root: Group; body: Group; target: Mesh; overlay: Mesh } {
  const root = new Group();
  const body = new Group();
  const target = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const overlay = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  body.add(overlay, target);
  root.add(body);
  return { root, body, target, overlay };
}

describe("trail targets", () => {
  it("creates paths while ignoring viewer overlays", () => {
    const { root, body, target, overlay } = hierarchy();
    const scenes = { v1: root };
    const grandchild = new Group();
    const leaf = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    target.add(grandchild);
    grandchild.add(leaf);

    expect(objectPartRefOf(scenes, root)).toBeNull();
    expect(objectPartRefOf(scenes, target)).toEqual({ versionId: "v1", objectPath: "0/0" });
    expect(objectPartRefOf(scenes, leaf)).toEqual({ versionId: "v1", objectPath: "0/0/0/0" });
    expect(objectPartRefOf(scenes, overlay)).toBeNull();
    expect(objectPartRefOf(scenes, body)).toEqual({ versionId: "v1", objectPath: "0" });
    expect(objectPartRefOf(scenes, new Group())).toBeNull();
  });

  it("resolves valid paths and rejects missing versions or paths", () => {
    const { root, target } = hierarchy();
    const scenes = { v1: root };
    const ref = { versionId: "v1", objectPath: "0/0" };

    expect(resolveTrailTarget(scenes, null)).toBeNull();
    expect(resolveTrailTarget(scenes, { versionId: "v2", objectPath: "0" })).toBeNull();
    expect(resolveTrailTarget(scenes, { versionId: "v1", objectPath: "9" })).toBeNull();
    expect(resolveTrailTarget(scenes, ref)).toEqual({ versionId: "v1", root, object: target });
    expect(resolveTrailTarget(scenes, objectPartRefOf(scenes, target))).toEqual({
      versionId: "v1",
      root,
      object: target,
    });
  });
});
