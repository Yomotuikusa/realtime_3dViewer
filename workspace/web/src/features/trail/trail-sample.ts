import {
  AnimationMixer,
  LoopOnce,
  Matrix4,
  Vector3,
  type AnimationClip,
  type Object3D,
} from "three";
import { lastFrameOf, timeOfFrame } from "../viewer/playback-frames";

/** 1 本の軌跡としてサンプリングする最大フレーム数 */
export const MAX_TRAIL_FRAMES = 2000;

export interface TrailSample {
  /** フレーム i の root ローカル座標が [i*3, i*3+1, i*3+2]。長さは frameCount * 3 */
  positions: Float32Array;
  /** サンプリングしたフレーム数。1 以上 MAX_TRAIL_FRAMES 以下 */
  frameCount: number;
}

function sampleFrameCount(duration: number, fps: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0) return 1;
  return Math.min(MAX_TRAIL_FRAMES, Math.max(1, lastFrameOf(duration, fps) + 1));
}

/** clip の各フレームにおける object の位置を root ローカル座標で集める。 */
export function sampleTrail(
  root: Object3D,
  object: Object3D,
  clip: AnimationClip,
  fps: number,
  currentTime: number,
): TrailSample {
  const frameCount = sampleFrameCount(clip.duration, fps);
  const positions = new Float32Array(frameCount * 3);
  const mixer = new AnimationMixer(root);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  const inverseRoot = new Matrix4();
  const localPosition = new Vector3();

  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      mixer.setTime(timeOfFrame(frame, fps));
      root.updateMatrixWorld(true);
      inverseRoot.copy(root.matrixWorld).invert();
      localPosition.setFromMatrixPosition(object.matrixWorld).applyMatrix4(inverseRoot);
      const offset = frame * 3;
      positions[offset] = localPosition.x;
      positions[offset + 1] = localPosition.y;
      positions[offset + 2] = localPosition.z;
    }

    action.reset().play();
    mixer.setTime(currentTime);
    root.updateMatrixWorld(true);
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }

  return { positions, frameCount };
}
