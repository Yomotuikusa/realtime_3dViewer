import { Color, MeshBasicMaterial, type Material } from "three";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 飛び出し(正の距離)の既定色。 */
export const COMPARE_OUTSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside);
/** へこみ(負の距離)の既定色。 */
export const COMPARE_INSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside);
/** 着色部分の不透明度 */
export const COMPARE_OVERLAY_OPACITY = 0.85;
/** uniform 群を置く material.userData のキー */
export const COMPARE_OVERLAY_UNIFORMS_KEY = "meshCompareUniforms";
/** customProgramCacheKey が返す固定文字列 */
export const COMPARE_PROGRAM_CACHE_KEY = "meshCompare";

/** 比較の色。値は 0xrrggbb */
export interface CompareColors {
  outside: number;
  inside: number;
}

/** 比較重ね描きの shader に渡す uniform 群。 */
export interface CompareOverlayUniforms {
  compareThreshold: { value: number };
  compareOutside: { value: Color };
  compareInside: { value: Color };
}

const vertexDeclarations = `
attribute float compareDistance;
varying float vCompareDistance;`;

const fragmentDeclarations = `
uniform float compareThreshold;
uniform vec3 compareOutside;
uniform vec3 compareInside;
varying float vCompareDistance;`;

const fragmentDecision = `
if (vCompareDistance >= compareThreshold) {
  diffuseColor.rgb = compareOutside;
} else if (vCompareDistance <= -compareThreshold) {
  diffuseColor.rgb = compareInside;
} else {
  discard;
}`;

/** 符号付き距離をフラグメント単位で判定する MeshBasicMaterial を作る。 */
export function createCompareOverlayMaterial(): MeshBasicMaterial {
  const uniforms: CompareOverlayUniforms = {
    compareThreshold: { value: 0 },
    compareOutside: { value: new Color(COMPARE_OUTSIDE_COLOR) },
    compareInside: { value: new Color(COMPARE_INSIDE_COLOR) },
  };
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: false,
    transparent: true,
    opacity: COMPARE_OVERLAY_OPACITY,
    depthWrite: false,
    toneMapped: false,
  });
  material.userData[COMPARE_OVERLAY_UNIFORMS_KEY] = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>${vertexDeclarations}`,
    ).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vCompareDistance = compareDistance;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>${fragmentDeclarations}`,
    ).replace("#include <color_fragment>", fragmentDecision);
    shader.uniforms.compareThreshold = uniforms.compareThreshold;
    shader.uniforms.compareOutside = uniforms.compareOutside;
    shader.uniforms.compareInside = uniforms.compareInside;
  };
  material.customProgramCacheKey = () => COMPARE_PROGRAM_CACHE_KEY;
  return material;
}

/** material.userData に保存した比較 uniform 群を返す。 */
export function compareOverlayUniforms(material: Material): CompareOverlayUniforms | null {
  return material.userData[COMPARE_OVERLAY_UNIFORMS_KEY] ?? null;
}

/** 比較重ね描きのしきい値と色を uniform へ書く。 */
export function setCompareOverlayUniforms(
  material: Material,
  threshold: number,
  colors: CompareColors,
): boolean {
  const uniforms = compareOverlayUniforms(material);
  if (!uniforms) return false;
  uniforms.compareThreshold.value = threshold;
  uniforms.compareOutside.value.setHex(colors.outside);
  uniforms.compareInside.value.setHex(colors.inside);
  return true;
}
