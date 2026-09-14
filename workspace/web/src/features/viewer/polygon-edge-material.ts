import { DoubleSide, MeshBasicMaterial, type Material } from "three";

/** 線の太さ(px)。GLSL の define POLYGON_EDGE_LINE_WIDTH に "1.0" として渡す */
export const POLYGON_EDGE_LINE_WIDTH = 1;
/** userData のキー。値は true */
export const POLYGON_EDGE_MATERIAL_KEY = "polygonEdgeMaterial";

const polygonEdgeVertexDeclarations = `
attribute vec3 polygonEdgeBarycentric;
attribute vec3 polygonEdgeMask;
varying vec3 vPolygonEdgeBarycentric;
varying vec3 vPolygonEdgeMask;`;

const polygonEdgeFragmentDeclarations = `
varying vec3 vPolygonEdgeBarycentric;
varying vec3 vPolygonEdgeMask;`;

export function isPolygonEdgeMaterial(material: Material): boolean {
  return material.userData[POLYGON_EDGE_MATERIAL_KEY] === true;
}

/** 多角形の輪郭辺だけを描く MeshBasicMaterial を作る。 */
export function createPolygonEdgeMaterial(color: number, opacity: number): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color,
    side: DoubleSide,
    toneMapped: false,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });

  material.defines = { POLYGON_EDGE_LINE_WIDTH: POLYGON_EDGE_LINE_WIDTH.toFixed(1) };
  material.userData[POLYGON_EDGE_MATERIAL_KEY] = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>${polygonEdgeVertexDeclarations}`,
    ).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vPolygonEdgeBarycentric = polygonEdgeBarycentric;
vPolygonEdgeMask = polygonEdgeMask;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>${polygonEdgeFragmentDeclarations}`,
    ).replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
vec3 edgeDistance = vPolygonEdgeBarycentric / fwidth(vPolygonEdgeBarycentric);
vec3 onEdge = step(edgeDistance, vec3(POLYGON_EDGE_LINE_WIDTH)) * step(0.5, vPolygonEdgeMask);
if (max(onEdge.x, max(onEdge.y, onEdge.z)) < 0.5) discard;`,
    );
  };
  material.customProgramCacheKey = () => "polygonEdge";
  return material;
}
