import { Bone, Group, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { addJointOverlay, JOINT_COLOR, JOINT_LINK_COLOR } from "../src/features/joint/joint-display";
import {
  JOINT_PICK_RADIUS_PX,
  jointSelectionOf,
  pickJoint,
} from "../src/features/joint/joint-pick";

function camera(): PerspectiveCamera {
  const result = new PerspectiveCamera(90, 1, 0.1, 10);
  result.updateMatrixWorld(true);
  return result;
}

function sceneAt(x: number, z = -1): { root: Group; bone: Bone } {
  const root = new Group();
  const bone = new Bone();
  bone.position.set(x, 0, z);
  root.add(bone);
  root.updateMatrixWorld(true);
  addJointOverlay(root, DEFAULT_JOINT_COLORS);
  return { root, bone };
}

const viewport = { width: 100, height: 100 };
const DEFAULT_JOINT_COLORS = { joint: JOINT_COLOR, link: JOINT_LINK_COLOR };

describe("joint pick", () => {
  it("requires a visible overlay and ignores points outside the camera depth", () => {
    const empty = new Group();
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, { empty })).toBeNull();

    const hidden = sceneAt(0);
    hidden.root.children[1]!.visible = false;
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, { hidden: hidden.root })).toBeNull();

    const behind = sceneAt(0, 1);
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, { behind: behind.root })).toBeNull();
  });

  it("picks the nearest bone within the pixel radius", () => {
    const near = sceneAt(0.06);
    const far = sceneAt(0.16);
    const hit = pickJoint(camera(), { x: 0, y: 0 }, viewport, { near: near.root, far: far.root });
    expect(hit).toEqual({ versionId: "near", bone: near.bone });
    expect(JOINT_PICK_RADIUS_PX).toBe(12);

    const outside = sceneAt(0.4);
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, { outside: outside.root })).toBeNull();
  });

  it("uses the requested pixel radius while keeping the default", () => {
    const thirteenPixelsAway = sceneAt(0.27);
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, {
      defaultRadius: thirteenPixelsAway.root,
    })).toBeNull();
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, {
      customRadius: thirteenPixelsAway.root,
    }, 20)).toEqual({ versionId: "customRadius", bone: thirteenPixelsAway.bone });

    const fivePixelsAway = sceneAt(0.11);
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, {
      customRadius: fivePixelsAway.root,
    }, 4)).toBeNull();
  });

  it("keeps the first scene when distances are equal and follows matrixWorld", () => {
    const first = sceneAt(0.1);
    const second = sceneAt(0.1);
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, {
      first: first.root,
      second: second.root,
    })?.versionId).toBe("first");

    first.bone.position.x = 0.2;
    first.root.updateMatrixWorld(true);
    expect(pickJoint(camera(), { x: 0, y: 0 }, viewport, { first: first.root })?.bone).toBe(first.bone);
  });

  it("converts a hit into an outliner selection", () => {
    const scene = sceneAt(0);
    const hit = pickJoint(camera(), { x: 0, y: 0 }, viewport, { version: scene.root });
    expect(jointSelectionOf(null)).toBeNull();
    expect(jointSelectionOf(hit)).toEqual({ versionId: "version", objectId: scene.bone.uuid });
  });
});
