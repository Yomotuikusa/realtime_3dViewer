import { Color, MeshBasicMaterial, ShaderLib, UniformsUtils } from "three";
import { describe, expect, it } from "vitest";
import {
  COMPARE_INSIDE_COLOR,
  COMPARE_OUTSIDE_COLOR,
  COMPARE_OVERLAY_OPACITY,
  COMPARE_OVERLAY_UNIFORMS_KEY,
  COMPARE_PROGRAM_CACHE_KEY,
  compareOverlayUniforms,
  createCompareOverlayMaterial,
  setCompareOverlayUniforms,
} from "../src/features/compare/overlay";

describe("compare overlay shader", () => {
  it("creates the transparent basic material and default uniforms", () => {
    const material = createCompareOverlayMaterial();
    const uniforms = compareOverlayUniforms(material)!;
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.vertexColors).toBe(false);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(COMPARE_OVERLAY_OPACITY);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(material.customProgramCacheKey()).toBe(COMPARE_PROGRAM_CACHE_KEY);
    expect(material.userData[COMPARE_OVERLAY_UNIFORMS_KEY]).toBe(uniforms);
    expect(uniforms.compareThreshold.value).toBe(0);
    expect(uniforms.compareOutside.value.getHex()).toBe(COMPARE_OUTSIDE_COLOR);
    expect(uniforms.compareInside.value.getHex()).toBe(COMPARE_INSIDE_COLOR);
    expect(compareOverlayUniforms(new MeshBasicMaterial())).toBeNull();
  });

  it("injects interpolated-distance declarations and three-way fragment decision", () => {
    const material = createCompareOverlayMaterial();
    const shader = {
      vertexShader: ShaderLib.basic.vertexShader,
      fragmentShader: ShaderLib.basic.fragmentShader,
      uniforms: UniformsUtils.clone(ShaderLib.basic.uniforms),
    };
    material.onBeforeCompile(shader as never, {} as never);
    expect(shader.vertexShader).toContain("attribute float compareDistance;");
    expect(shader.vertexShader).toContain("varying float vCompareDistance;");
    expect(shader.vertexShader).toContain("vCompareDistance = compareDistance;");
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.vertexShader).toContain("#include <skinning_vertex>");
    expect(shader.fragmentShader).toContain("uniform float compareThreshold;");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = compareOutside;");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = compareInside;");
    expect(shader.fragmentShader).toContain("discard;");
    expect(shader.fragmentShader).not.toContain("#include <color_fragment>");
    expect(shader.fragmentShader).toContain("vec4 diffuseColor = vec4( diffuse, opacity );");
    const uniforms = compareOverlayUniforms(material)!;
    expect(shader.uniforms.compareThreshold).toBe(uniforms.compareThreshold);
    expect(shader.uniforms.compareOutside).toBe(uniforms.compareOutside);
    expect(shader.uniforms.compareInside).toBe(uniforms.compareInside);
    expect(shader.uniforms.diffuse).toBeDefined();
    expect(shader.uniforms.opacity).toBeDefined();
  });

  it("uses linear Color values without replacing them", () => {
    const material = createCompareOverlayMaterial();
    const uniforms = compareOverlayUniforms(material)!;
    const outside = uniforms.compareOutside.value;
    setCompareOverlayUniforms(material, 0.5, { outside: 0xff0000, inside: 0x00ff00 });
    expect(outside).toBe(uniforms.compareOutside.value);
    expect(outside).toBeInstanceOf(Color);
  });
});
