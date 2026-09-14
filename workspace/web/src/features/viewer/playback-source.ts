import type { AnimationClip } from "three";
import type { ModelVersion } from "@shared/types";

export type ClipRegistry = Readonly<Record<string, readonly AnimationClip[]>>;

/** objects のうち、アニメーションを持つ版を number 昇順で返す。 */
export function animatedObjects(
  objects: readonly ModelVersion[],
  clips: ClipRegistry,
): ModelVersion[] {
  return objects
    .map((object, index) => ({ object, index }))
    .filter(({ object }) => (clips[object.id]?.length ?? 0) > 0)
    .sort((left, right) => left.object.number - right.object.number || left.index - right.index)
    .map(({ object }) => object);
}

/** ルーム指定を優先し、無ければ最小 number のアニメーション版を返す。 */
export function resolvePlaybackSource(
  objects: readonly ModelVersion[],
  clips: ClipRegistry,
  preferredId: string | null,
): string | null {
  const animated = animatedObjects(objects, clips);
  if (preferredId !== null && animated.some((object) => object.id === preferredId)) {
    return preferredId;
  }
  return animated[0]?.id ?? null;
}
