import { useEffect } from "react";
import type { AnimationClip, Object3D } from "three";
import { Box3, Vector3 } from "three";
import type { MeshDisplayMode } from "@shared/types";
import { useCameraStore } from "../../store/camera";
import { usePlaybackStore } from "../../store/playback";
import { useModelScenesStore } from "../compare/model-scenes";
import { applyMeshDisplay } from "./mesh-display";
import { clipSummaries } from "./playback";
import { detectFps } from "./playback-frames";

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

  useEffect(() => {
    if (!primary) return;
    const bounds = new Box3().setFromObject(scene);
    const dimensions = bounds.getSize(new Vector3());
    const modelSize = Math.max(dimensions.x, dimensions.y, dimensions.z);
    if (modelSize > 0) useCameraStore.getState().setModelSize(modelSize);
    useCameraStore.getState().requestFit();
  }, [primary, scene]);

  useEffect(() => {
    if (!primary) return;
    usePlaybackStore.getState().setClips(clipSummaries(animations), detectFps(animations));
    return () => usePlaybackStore.getState().setClips([]);
  }, [animations, primary]);

  useEffect(() => {
    applyMeshDisplay(scene, meshDisplay);
  }, [meshDisplay, scene]);

  useEffect(() => {
    useModelScenesStore.getState().register(versionId, scene);
    return () => useModelScenesStore.getState().unregister(versionId, scene);
  }, [scene, versionId]);

  useEffect(() => () => applyMeshDisplay(scene, "solid"), [scene]);
}
