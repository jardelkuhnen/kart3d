import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { DRIFT_TIERS } from '../core/constants';
import { publicUrl } from '../core/publicUrl';
import type { QualityLevel, TrackId } from '../core/types';
import type { RaceSimulation } from '../racing/raceSimulation';
import { createParticleAtlasMaterial } from '../../shaders/particleAtlasShader';
import { createSpeedLinesMaterial } from '../../shaders/speedLinesShader';
import {
  BIOME_WEATHER_CONFIG,
  QUALITY_PRESETS,
  SURFACE_PARTICLE_STYLE,
} from './vfxConfig';

// 2x2 atlas offsets (PNG is Y-flipped by Three.js texture upload):
// 0 = soft puff (top-left), 1 = 4-point spark (top-right),
// 2 = diamond flake (bottom-left), 3 = energy halo ring (bottom-right)
const CELL_OFFSETS: readonly [number, number][] = [
  [0.0, 0.5],
  [0.5, 0.5],
  [0.0, 0.0],
  [0.5, 0.0],
];

type ParticleCell = 0 | 1 | 2 | 3;

interface ParticlePool {
  capacity: number;
  cursor: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  size: Float32Array;
  colorBuf: Float32Array;
  uvOffsets: Float32Array;
  dummy: THREE.Object3D;
  color: THREE.Color;
  emitAccum: number;
  ambientAccum: number;
  lastPlayerHit: number;
  lastPlayerBoost: number;
}

function createPool(capacity: number): ParticlePool {
  return {
    capacity,
    cursor: 0,
    px: new Float32Array(capacity),
    py: new Float32Array(capacity),
    pz: new Float32Array(capacity),
    vx: new Float32Array(capacity),
    vy: new Float32Array(capacity),
    vz: new Float32Array(capacity),
    life: new Float32Array(capacity),
    maxLife: new Float32Array(capacity),
    size: new Float32Array(capacity),
    colorBuf: new Float32Array(capacity * 3),
    uvOffsets: new Float32Array(capacity * 2),
    dummy: new THREE.Object3D(),
    color: new THREE.Color(),
    emitAccum: 0,
    ambientAccum: 0,
    lastPlayerHit: 0,
    lastPlayerBoost: 0,
  };
}

function spawnParticle(
  pool: ParticlePool,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  ttl: number,
  size: number,
  hex: string,
  cell: ParticleCell,
): void {
  const idx = pool.cursor;
  pool.cursor = (pool.cursor + 1) % pool.capacity;
  pool.px[idx] = x;
  pool.py[idx] = y;
  pool.pz[idx] = z;
  pool.vx[idx] = vx;
  pool.vy[idx] = vy;
  pool.vz[idx] = vz;
  pool.life[idx] = ttl;
  pool.maxLife[idx] = ttl;
  pool.size[idx] = size;

  pool.color.set(hex);
  const cBase = idx * 3;
  pool.colorBuf[cBase] = pool.color.r;
  pool.colorBuf[cBase + 1] = pool.color.g;
  pool.colorBuf[cBase + 2] = pool.color.b;

  const [uOff, vOff] = CELL_OFFSETS[cell];
  const uBase = idx * 2;
  pool.uvOffsets[uBase] = uOff;
  pool.uvOffsets[uBase + 1] = vOff;
}

function SpeedLinesOverlay({
  intensityRef,
}: {
  intensityRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    const mat = createSpeedLinesMaterial();
    matRef.current = mat;
    const mesh = meshRef.current;
    if (mesh) {
      mesh.material = mat;
    }
    return () => {
      mat.dispose();
      matRef.current = null;
    };
  }, []);

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uIntensity.value = intensityRef.current;
  });

  return (
    <mesh ref={meshRef} renderOrder={999} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

export function RaceVfxSystem({
  trackId,
  quality,
  simRef,
  paused,
}: {
  trackId: TrackId;
  quality: QualityLevel;
  simRef: React.MutableRefObject<RaceSimulation>;
  paused: boolean;
}) {
  const preset = QUALITY_PRESETS[quality];
  const weather = BIOME_WEATHER_CONFIG[trackId];
  const atlasTex = useTexture(publicUrl('/assets/vfx/particles_atlas.png'));

  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const poolRef = useRef<ParticlePool | null>(null);
  const cellAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const colorAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const speedIntensityRef = useRef(0);

  useEffect(() => {
    const pool = createPool(preset.maxParticles);
    poolRef.current = pool;
    const mesh = meshRef.current;
    const mat = createParticleAtlasMaterial(atlasTex);

    if (mesh) {
      mesh.material = mat;
      pool.dummy.position.set(0, -999, 0);
      pool.dummy.scale.setScalar(0.0001);
      pool.dummy.updateMatrix();
      for (let i = 0; i < pool.capacity; i += 1) {
        mesh.setMatrixAt(i, pool.dummy.matrix);
        pool.colorBuf[i * 3] = 1;
        pool.colorBuf[i * 3 + 1] = 1;
        pool.colorBuf[i * 3 + 2] = 1;
      }
      mesh.instanceMatrix.needsUpdate = true;

      const cellAttr = new THREE.InstancedBufferAttribute(pool.uvOffsets, 2);
      const colorAttr = new THREE.InstancedBufferAttribute(pool.colorBuf, 3);
      mesh.geometry.setAttribute('aCellOffset', cellAttr);
      mesh.geometry.setAttribute('aColor', colorAttr);
      cellAttrRef.current = cellAttr;
      colorAttrRef.current = colorAttr;
    }

    return () => {
      if (mesh) {
        mesh.geometry.deleteAttribute('aCellOffset');
        mesh.geometry.deleteAttribute('aColor');
      }
      cellAttrRef.current = null;
      colorAttrRef.current = null;
      poolRef.current = null;
      mat.dispose();
    };
  }, [atlasTex, preset.maxParticles]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const pool = poolRef.current;
    const mesh = meshRef.current;
    const cellAttr = cellAttrRef.current;
    const colorAttr = colorAttrRef.current;
    const sim = simRef.current;
    const pSim = sim.player.sim;

    const speedNorm = Math.max(0, (Math.abs(pSim.forwardSpeed) - 24) / 18);
    const boostBonus = pSim.boostTimer > 0 ? 0.85 : 0;
    speedIntensityRef.current =
      preset.enableSpeedLines && !paused && sim.phase === 'racing'
        ? Math.min(1, Math.max(speedNorm * 0.65, boostBonus))
        : 0;

    if (!pool || !mesh || !cellAttr || !colorAttr || paused) return;

    const surfStyle = SURFACE_PARTICLE_STYLE[pSim.surface];
    const movingFast = Math.abs(pSim.forwardSpeed) > 10 && pSim.grounded;

    // 1. Tire dust/smoke/dirt/sand/ice & 3-tier drift sparks + boost flames
    if (movingFast) {
      pool.emitAccum += dt * (pSim.driftActive ? 34 : 14);
      while (pool.emitAccum >= 1) {
        pool.emitAccum -= 1;
        const jitterX = (Math.random() - 0.5) * 1.15;
        const jitterZ = (Math.random() - 0.5) * 1.15;
        spawnParticle(
          pool,
          pSim.x + jitterX,
          pSim.y + 0.16,
          pSim.z + jitterZ,
          (Math.random() - 0.5) * 2.2,
          surfStyle.upwardSpeed + Math.random() * 0.9,
          (Math.random() - 0.5) * 2.2,
          0.42 + Math.random() * 0.25,
          surfStyle.size,
          surfStyle.color,
          pSim.surface === 'ice' ? 2 : 0,
        );

        if (pSim.driftActive && pSim.driftTier > 0) {
          const tierColor = DRIFT_TIERS[pSim.driftTier - 1].sparkColor;
          spawnParticle(
            pool,
            pSim.x + (Math.random() > 0.5 ? 0.9 : -0.9),
            pSim.y + 0.24,
            pSim.z,
            (Math.random() - 0.5) * 5.2,
            2.4 + Math.random() * 1.8,
            (Math.random() - 0.5) * 5.2,
            0.28 + Math.random() * 0.18,
            0.3 + pSim.driftTier * 0.06,
            tierColor,
            1,
          );
        }

        if (pSim.boostTimer > 0) {
          spawnParticle(
            pool,
            pSim.x + (Math.random() - 0.5) * 0.65,
            pSim.y + 0.58,
            pSim.z + (Math.random() - 0.5) * 0.65,
            (Math.random() - 0.5) * 2.4,
            0.8 + Math.random() * 1.0,
            (Math.random() - 0.5) * 2.4,
            0.3,
            0.42,
            '#fb923c',
            1,
          );
        }
      }
    }

    // 2. Hit & boost burst transitions
    if (pSim.hitTimer > 0 && pool.lastPlayerHit <= 0) {
      for (let i = 0; i < 14; i += 1) {
        const ang = (i / 14) * Math.PI * 2;
        spawnParticle(
          pool,
          pSim.x,
          pSim.y + 0.85,
          pSim.z,
          Math.cos(ang) * 7.5,
          3.2 + Math.random() * 2.5,
          Math.sin(ang) * 7.5,
          0.55,
          0.48,
          '#fb7185',
          i % 2 === 0 ? 3 : 1,
        );
      }
    }
    pool.lastPlayerHit = pSim.hitTimer;

    if (pSim.boostTimer > 0 && pool.lastPlayerBoost <= 0) {
      for (let i = 0; i < 10; i += 1) {
        const ang = (i / 10) * Math.PI * 2;
        spawnParticle(
          pool,
          pSim.x,
          pSim.y + 0.6,
          pSim.z,
          Math.cos(ang) * 5.5,
          2.0,
          Math.sin(ang) * 5.5,
          0.4,
          0.46,
          '#fde047',
          3,
        );
      }
    }
    pool.lastPlayerBoost = pSim.boostTimer;

    // 3. Biome weather particles
    pool.ambientAccum += dt * preset.ambientParticlesPerSec;
    while (pool.ambientAccum >= 1) {
      pool.ambientAccum -= 1;
      spawnParticle(
        pool,
        pSim.x + (Math.random() - 0.5) * 44,
        pSim.y + 9 + Math.random() * 8,
        pSim.z + (Math.random() - 0.5) * 44,
        weather.driftX,
        -weather.fallSpeed,
        weather.driftZ,
        1.35,
        weather.size,
        weather.color,
        2,
      );
    }

    // 4. Advance active pooled particles in-place
    const { dummy } = pool;
    for (let i = 0; i < pool.capacity; i += 1) {
      if (pool.life[i] <= 0) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      pool.life[i] -= dt;
      pool.px[i] += pool.vx[i] * dt;
      pool.py[i] += pool.vy[i] * dt;
      pool.pz[i] += pool.vz[i] * dt;

      const tNorm = Math.max(0, pool.life[i] / pool.maxLife[i]);
      const sc = pool.size[i] * (0.45 + tNorm * 0.75);
      dummy.position.set(pool.px[i], pool.py[i], pool.pz[i]);
      dummy.scale.setScalar(sc);
      dummy.quaternion.copy(state.camera.quaternion);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    cellAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, preset.maxParticles]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {preset.enableSpeedLines && <SpeedLinesOverlay intensityRef={speedIntensityRef} />}
    </group>
  );
}
