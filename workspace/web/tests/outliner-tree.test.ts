import {
  Bone,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  Skeleton,
  SkinnedMesh,
} from "three";
import { describe, expect, it } from "vitest";
import { VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";
import { buildOutlinerTree, classifyObject, toggleId } from "../src/features/outliner/outliner-tree";

describe("outliner tree", () => {
  it("classifies supported three object kinds", () => {
    const geometry = new BoxGeometry();
    expect(classifyObject(new Mesh(geometry, new MeshStandardMaterial()))).toBe("mesh");
    const bone = new Bone();
    const skinned = new SkinnedMesh(geometry, new MeshStandardMaterial());
    skinned.bind(new Skeleton([bone]));
    expect(classifyObject(skinned)).toBe("mesh");
    expect(classifyObject(new InstancedMesh(geometry, new MeshStandardMaterial(), 2))).toBe("mesh");
    const lineGeometry = new BufferGeometry();
    expect(classifyObject(new Line(lineGeometry, new LineBasicMaterial()))).toBe("curve");
    expect(classifyObject(new LineSegments(lineGeometry, new LineBasicMaterial()))).toBe("curve");
    expect(classifyObject(new LineLoop(lineGeometry, new LineBasicMaterial()))).toBe("curve");
    expect(classifyObject(new Points(lineGeometry, new PointsMaterial()))).toBe("points");
    expect(classifyObject(new Bone())).toBe("bone");
    expect(classifyObject(new DirectionalLight())).toBe("light");
    expect(classifyObject(new PointLight())).toBe("light");
    expect(classifyObject(new PerspectiveCamera())).toBe("camera");
    expect(classifyObject(new OrthographicCamera())).toBe("camera");
    expect(classifyObject(new Group())).toBe("group");
    expect(classifyObject(new Object3D())).toBe("group");
    expect(classifyObject(new Scene())).toBe("group");
  });

  it("builds an ordered plain hierarchy and omits overlays", () => {
    const root = new Group();
    root.name = "Root";
    const body = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    body.name = "Body";
    const overlay = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    overlay.userData[VIEWER_OVERLAY_KEY] = true;
    overlay.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    body.add(overlay);
    const rig = new Group();
    rig.name = "Rig";
    const hip = new Bone();
    hip.name = "Hip";
    const spine = new Bone();
    spine.name = "Spine";
    hip.add(spine);
    rig.add(hip);
    const guide = new Line(new BufferGeometry(), new LineBasicMaterial());
    guide.name = "Guide";
    root.add(body, rig, guide);

    const tree = buildOutlinerTree(root);

    expect(tree).toEqual({
      id: root.uuid,
      name: "Root",
      kind: "group",
      children: [
        { id: body.uuid, name: "Body", kind: "mesh", children: [] },
        {
          id: rig.uuid,
          name: "Rig",
          kind: "group",
          children: [{ id: hip.uuid, name: "Hip", kind: "bone", children: [{ id: spine.uuid, name: "Spine", kind: "bone", children: [] }] }],
        },
        { id: guide.uuid, name: "Guide", kind: "curve", children: [] },
      ],
    });
    expect(JSON.stringify(tree)).toBeDefined();
    expect(Object.keys(tree)).toEqual(["id", "name", "kind", "children"]);
  });

  it("keeps empty names in the tree and toggles ids immutably", () => {
    const unnamed = new Object3D();
    expect(buildOutlinerTree(unnamed).name).toBe("");
    const ids = ["a", "b"];
    expect(toggleId(ids, "a")).toEqual(["b"]);
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId([], "a")).toEqual(["a"]);
    expect(ids).toEqual(["a", "b"]);
  });
});
