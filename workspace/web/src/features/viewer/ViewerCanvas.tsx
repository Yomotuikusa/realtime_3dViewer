import { Suspense, type ReactElement, type ReactNode } from "react";
import { Bounds } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { DEFAULT_CAMERA } from "@shared/camera";
import { CameraRig } from "./CameraRig";
import { ModelMesh } from "./ModelMesh";

export function ViewerCanvas({ modelSrc, children }: { modelSrc: string; children?: ReactNode }): ReactElement {
  return (
    <Canvas
      camera={{ fov: 50, position: DEFAULT_CAMERA.position }}
      style={{ width: "100%", height: "100%", minHeight: "36rem" }}
    >
      <color attach="background" args={["#f5f7fa"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 8, 5]} intensity={2} />
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
