import { type ComponentType, type ReactElement } from "react";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { AnimationClip, Loader, Object3D } from "three";
import { modelFormat, type ModelFormat } from "@shared/api";
import type { MeshDisplayMode } from "@shared/types";
import { createModelLoadingManager } from "./model-loading";
import { installFbxSkinCompat } from "./fbx-compat";
import { PlaybackRig } from "./PlaybackRig";
import { useModelScene, type ModelSceneOptions } from "./useModelScene";

/** アニメーションを持たない形式が渡す不変の空配列。毎回新しい配列を作らない */
const NO_ANIMATIONS: readonly AnimationClip[] = [];

/** 読み込み時の外部リソース取得を同一オリジンへ制限する */
function extendLoader(loader: Loader): void {
  installFbxSkinCompat();
  loader.manager = createModelLoadingManager(location.origin);
}

interface ModelSourceProps {
  src: string;
  versionId: string;
  visible: boolean;
  primary: boolean;
  meshDisplay: MeshDisplayMode;
}

/** 読み込み済みのシーンをビューアへ接続して描く。形式によらず共通 */
function ModelScene({ scene, animations, visible, ...options }: {
  scene: Object3D;
  animations: readonly AnimationClip[];
  visible: boolean;
} & ModelSceneOptions): ReactElement {
  useModelScene(scene, animations, options);
  return (
    <>
      <primitive object={scene} visible={visible} />
      {animations.length > 0 && <PlaybackRig root={scene} clips={animations} />}
    </>
  );
}

function GltfModel({ src, ...rest }: ModelSourceProps): ReactElement {
  const { scene, animations } = useGLTF(src, true, true, extendLoader);
  return <ModelScene scene={scene} animations={animations} {...rest} />;
}

function FbxModel({ src, ...rest }: ModelSourceProps): ReactElement {
  const group = useLoader(FBXLoader, src, extendLoader);
  return <ModelScene scene={group} animations={group.animations} {...rest} />;
}

function ObjModel({ src, ...rest }: ModelSourceProps): ReactElement {
  const group = useLoader(OBJLoader, src, extendLoader);
  return <ModelScene scene={group} animations={NO_ANIMATIONS} {...rest} />;
}

/** 形式ごとの読み込みコンポーネント。ModelFormat の全キーを必ず埋める */
export const MODEL_COMPONENTS: Readonly<Record<ModelFormat, ComponentType<ModelSourceProps>>> = {
  glb: GltfModel,
  gltf: GltfModel,
  fbx: FbxModel,
  obj: ObjModel,
};

export function ModelMesh({ fileName, ...props }: ModelSourceProps & { fileName: string }): ReactElement | null {
  const format = modelFormat(fileName);
  if (!format) return null;
  const Source = MODEL_COMPONENTS[format];
  return <Source {...props} />;
}
