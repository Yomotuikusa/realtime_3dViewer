import { useEffect, type ReactElement } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { useCameraStore } from "../../store/camera";

export function ModelMesh({ src }: { src: string }): ReactElement {
  const { scene } = useGLTF(src);

  useEffect(() => {
    const bounds = new Box3().setFromObject(scene);
    const dimensions = bounds.getSize(new Vector3());
    const modelSize = Math.max(dimensions.x, dimensions.y, dimensions.z);
    if (modelSize > 0) {
      useCameraStore.getState().setModelSize(modelSize);
    }
    useCameraStore.getState().requestFit();
  }, [scene]);

  return <primitive object={scene} />;
}
