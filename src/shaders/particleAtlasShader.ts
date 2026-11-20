import * as THREE from 'three';

export function createParticleAtlasMaterial(atlasMap: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: atlasMap },
      uOpacity: { value: 0.88 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aCellOffset;
      attribute vec3 aColor;
      varying vec2 vUv;
      varying vec3 vColor;

      void main() {
        // 1% inner margin avoids bilinear filtering bleeding across 2x2 quadrants
        vUv = aCellOffset + vec2(0.01) + uv * 0.48;
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vColor;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float alpha = tex.a * uOpacity;
        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(tex.rgb * vColor, alpha);
      }
    `,
  });
}
