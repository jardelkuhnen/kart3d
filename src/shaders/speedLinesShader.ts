import * as THREE from 'three';

export function createSpeedLinesMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uColorA: { value: new THREE.Color('#38bdf8') },
      uColorB: { value: new THREE.Color('#fde047') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vScreenUv;
      void main() {
        vScreenUv = uv * 2.0 - 1.0;
        gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vScreenUv;

      void main() {
        if (uIntensity <= 0.01) discard;
        float dist = length(vScreenUv);
        // Keep central racing field unobstructed
        float radialMask = smoothstep(0.48, 0.98, dist);
        if (radialMask <= 0.001) discard;

        float angle = atan(vScreenUv.y, vScreenUv.x);
        float streak1 = pow(max(0.0, sin(angle * 36.0 + floor(uTime * 18.0) * 1.37)), 10.0);
        float streak2 = pow(max(0.0, sin(angle * 52.0 - floor(uTime * 22.0) * 2.11)), 12.0);
        float streaks = max(streak1, streak2);

        float alpha = radialMask * streaks * clamp(uIntensity, 0.0, 1.0) * 0.42;
        if (alpha <= 0.005) discard;

        vec3 col = mix(uColorA, uColorB, streak2);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
