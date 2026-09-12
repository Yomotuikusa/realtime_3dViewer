import type { Object3D } from "three";
import { isViewerOverlay } from "../viewer/mesh-display";
import { childPath, plainChildren } from "./outliner-tree";

/** scene 配下の重ね描きでないオブジェクトへ、共有された部位の表示状態を適用する。 */
export function applyPartVisibility(scene: Object3D, hiddenPaths: readonly string[]): void {
  const hidden = new Set(hiddenPaths);

  function applyChildren(parent: Object3D, parentPath: string): void {
    plainChildren(parent).forEach((child, index) => {
      const path = childPath(parentPath, index);
      if (!isViewerOverlay(child)) child.visible = !hidden.has(path);
      applyChildren(child, path);
    });
  }

  applyChildren(scene, "");
}
