import { Bone, Group, Matrix4, Skeleton, SkinnedMesh } from "three";
import { describe, expect, it } from "vitest";
import { installFbxSkinCompat } from "../src/features/viewer/fbx-compat";

function bindOf(prototype: object): unknown {
  return (prototype as { bind?: unknown }).bind;
}

function bindable(node: object): (skeleton: Skeleton, matrix: Matrix4) => void {
  return (node as { bind: (skeleton: Skeleton, matrix: Matrix4) => void }).bind.bind(node);
}

describe("FBX skin compatibility", () => {
  it("ignores skin binding for unsupported Group models", () => {
    installFbxSkinCompat();

    expect(() => bindable(new Group())(new Skeleton([]), new Matrix4())).not.toThrow();
  });

  it("ignores skin binding for bone nodes", () => {
    installFbxSkinCompat();

    expect(() => bindable(new Bone())(new Skeleton([]), new Matrix4())).not.toThrow();
  });

  it("keeps SkinnedMesh binding separate from the compatibility shim", () => {
    installFbxSkinCompat();

    expect(bindOf(SkinnedMesh.prototype)).not.toBe(bindOf(Group.prototype));
  });

  it("keeps native SkinnedMesh binding usable", () => {
    installFbxSkinCompat();

    expect(() => bindable(new SkinnedMesh())(new Skeleton([]), new Matrix4())).not.toThrow();
  });

  it("does not replace the compatibility binding on repeated installation", () => {
    installFbxSkinCompat();
    const firstBinding = bindOf(Group.prototype);

    installFbxSkinCompat();

    expect(bindOf(Group.prototype)).toBe(firstBinding);
  });
});
