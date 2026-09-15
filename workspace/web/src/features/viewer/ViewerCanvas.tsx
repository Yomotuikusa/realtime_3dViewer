import { Suspense, useCallback, type ReactElement, type ReactNode } from "react";
import { Bounds } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { DEFAULT_CAMERA } from "@shared/camera";
import type { Group } from "three";
import { modelUrl } from "../../api/client";
import { isObjectVisible, primaryObjectId, useObjectsStore } from "../../store/objects";
import { useDisplayStore } from "../../store/display";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { CameraRig } from "./CameraRig";
import { DEFAULT_FOV } from "./focal-length";
import { FocalLengthRig } from "./FocalLengthRig";
import { ModelMesh } from "./ModelMesh";
import { isHiddenByCompare } from "../compare/compare-visibility";
import { MeshCompareRig } from "../compare/MeshCompareRig";
import { PlaybackClock } from "./PlaybackClock";
import { PlaybackSourceSync } from "./PlaybackSourceSync";
import { setModelTarget } from "./model-target";
import { SceneLights } from "./SceneLights";

export function ViewerCanvas({ children }: { children?: ReactNode }): ReactElement {
  const objects = useObjectsStore((state) => state.objects);
  const hiddenIds = useObjectsStore((state) => state.hiddenIds);
  const meshDisplay = useDisplayStore((state) => state.meshDisplay);
  const meshCompare = useDisplayStore((state) => state.meshCompare);
  const background = useThemeStore(selectViewerColor("background"));
  const primaryId = primaryObjectId(objects);
  const registerModelTarget = useCallback((group: Group | null) => {
    setModelTarget(group);
  }, []);

  return (
    <Canvas
      camera={{ fov: DEFAULT_FOV, position: DEFAULT_CAMERA.position }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={[background]} />
      <SceneLights />
      <FocalLengthRig />
      <Bounds fit={false} clip>
        <CameraRig />
        <group ref={registerModelTarget}>
          {objects.map((version) => (
            <Suspense key={version.id} fallback={null}>
              <ModelMesh
                src={modelUrl(version.projectId, version.id)}
                fileName={version.fileName}
                versionId={version.id}
                visible={isObjectVisible(hiddenIds, version.id) && !isHiddenByCompare(meshCompare, hiddenIds, version.id)}
                primary={version.id === primaryId}
                meshDisplay={meshDisplay}
              />
            </Suspense>
          ))}
        </group>
        <PlaybackClock />
        <PlaybackSourceSync />
        <MeshCompareRig />
        {children}
      </Bounds>
    </Canvas>
  );
}
