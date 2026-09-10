import { Suspense, type ReactElement, type ReactNode } from "react";
import { Bounds } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { DEFAULT_CAMERA } from "@shared/camera";
import { CameraRig } from "./CameraRig";
import { DEFAULT_FOV } from "./focal-length";
import { FocalLengthRig } from "./FocalLengthRig";
import { ModelMesh } from "./ModelMesh";
import { SceneLights } from "./SceneLights";

export function ViewerCanvas({ modelSrc, children }: { modelSrc: string; children?: ReactNode }): ReactElement {
  return (
    <Canvas
      camera={{ fov: DEFAULT_FOV, position: DEFAULT_CAMERA.position }}
      style={{ width: "100%", height: "100%", minHeight: "36rem" }}
    >
      <color attach="background" args={["#f5f7fa"]} />
      <SceneLights />
      <FocalLengthRig />
      <Suspense fallback={null}>
        <Bounds fit={false} clip>
          <CameraRig />
          <ModelMesh src={modelSrc} />
          {children}
        </Bounds>
      </Suspense>
    </Canvas>
  );
}
