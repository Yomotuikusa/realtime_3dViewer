import { useEffect } from "react";
import type { AnimationClip, Object3D } from "three";
import { Box3, Vector3 } from "three";
import type { MeshDisplayMode } from "@shared/types";
import { useCameraStore } from "../../store/camera";
import { useModelScenesStore } from "../compare/model-scenes";
import { useModelClipsStore } from "../trail/model-clips";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { applyMeshDisplay } from "./mesh-display";
import { hexToNumber } from "../theme/viewer-colors";

export interface ModelSceneOptions {
  versionId: string;
  primary: boolean;
  meshDisplay: MeshDisplayMode;
}

/**
 * 読み込み済みのシーンをビューアへ接続する共通副作用。
 * 形式(glTF / FBX / OBJ)によらず同じ処理を行う。
 */
export function useModelScene(
  scene: Object3D,
  animations: readonly AnimationClip[],
  options: ModelSceneOptions,
): void {
  const { versionId, primary, meshDisplay } = options;
  const wireframeColor = useThemeStore(selectViewerColor("wireframe"));

  useEffect(() => {
    if (!primary) return;
    const bounds = new Box3().setFromObject(scene);
    const dimensions = bounds.getSize(new Vector3());
    const modelSize = Math.max(dimensions.x, dimensions.y, dimensions.z);
    if (modelSize > 0) useCameraStore.getState().setModelSize(modelSize);
    useCameraStore.getState().requestFit();
  }, [primary, scene]);

  useEffect(() => {
    applyMeshDisplay(scene, meshDisplay, hexToNumber(wireframeColor));
  }, [meshDisplay, scene, wireframeColor]);

  useEffect(() => {
    useModelScenesStore.getState().register(versionId, scene);
    return () => useModelScenesStore.getState().unregister(versionId, scene);
  }, [scene, versionId]);

  useEffect(() => {
    useModelClipsStore.getState().register(versionId, animations);
    return () => useModelClipsStore.getState().unregister(versionId, animations);
  }, [animations, versionId]);

  useEffect(() => () => applyMeshDisplay(scene, "solid", hexToNumber(wireframeColor)), [scene, wireframeColor]);
}
