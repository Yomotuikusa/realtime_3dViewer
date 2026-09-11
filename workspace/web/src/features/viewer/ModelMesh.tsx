import { useEffect, type ReactElement } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { useCameraStore } from "../../store/camera";
import { usePlaybackStore } from "../../store/playback";
import { createModelLoadingManager } from "./model-loading";
import { clipSummaries } from "./playback";
import { detectFps } from "./playback-frames";
import { PlaybackRig } from "./PlaybackRig";

export function ModelMesh({ src, visible, primary }: { src: string; visible: boolean; primary: boolean }): ReactElement {
  const { scene, animations } = useGLTF(src, true, true, (loader) => {
    loader.manager = createModelLoadingManager(location.origin);
  });

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

  return (
    <>
      <primitive object={scene} visible={visible} />
      {animations.length > 0 && <PlaybackRig root={scene} clips={animations} />}
    </>
  );
}
