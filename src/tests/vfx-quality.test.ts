import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { validateManifestSchema } from '../game/core/assetLoader';
import { AVAILABLE_TRACK_IDS } from '../game/tracks/registry';
import {
  BIOME_WEATHER_CONFIG,
  QUALITY_PRESETS,
  SURFACE_PARTICLE_STYLE,
} from '../game/vfx/vfxConfig';
import { createParticleAtlasMaterial } from '../shaders/particleAtlasShader';
import { createSpeedLinesMaterial } from '../shaders/speedLinesShader';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'assets/manifest.json');

describe('Slice 7 — VFX Pool Config, Quality Presets & Speed Lines Shader', () => {
  it('scales GPU & particle budgets monotonically from low -> medium -> high', () => {
    const low = QUALITY_PRESETS.low;
    const med = QUALITY_PRESETS.medium;
    const high = QUALITY_PRESETS.high;

    expect(low.maxParticles).toBeLessThan(med.maxParticles);
    expect(med.maxParticles).toBeLessThan(high.maxParticles);

    expect(low.ambientParticlesPerSec).toBeLessThan(med.ambientParticlesPerSec);
    expect(med.ambientParticlesPerSec).toBeLessThan(high.ambientParticlesPerSec);

    expect(low.shadowMapSize).toBeLessThan(med.shadowMapSize);
    expect(med.shadowMapSize).toBeLessThan(high.shadowMapSize);

    expect(low.dpr[1]).toBeLessThanOrEqual(med.dpr[1]);
    expect(med.dpr[1]).toBeLessThanOrEqual(high.dpr[1]);

    expect(low.shadowsEnabled).toBe(false);
    expect(low.antialias).toBe(false);
    expect(low.enableSpeedLines).toBe(false);

    expect(med.shadowsEnabled).toBe(true);
    expect(med.enableSpeedLines).toBe(true);
    expect(high.shadowsEnabled).toBe(true);
    expect(high.antialias).toBe(true);
    expect(high.enableSpeedLines).toBe(true);
  });

  it('defines particle visual styles for all 5 surface types and all 8 track biomes', () => {
    const surfaces = ['asphalt', 'dirt', 'grass', 'sand', 'ice'] as const;
    for (const surface of surfaces) {
      const style = SURFACE_PARTICLE_STYLE[surface];
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.size).toBeGreaterThan(0);
      expect(style.upwardSpeed).toBeGreaterThan(0);
    }

    for (const trackId of AVAILABLE_TRACK_IDS) {
      const weather = BIOME_WEATHER_CONFIG[trackId];
      expect(weather).toBeDefined();
      expect(weather.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(weather.size).toBeGreaterThan(0);
      expect(weather.fallSpeed).toBeGreaterThan(0);
      expect(Number.isFinite(weather.driftX)).toBe(true);
      expect(Number.isFinite(weather.driftZ)).toBe(true);
    }
  });

  it('builds a valid additive speed-lines ShaderMaterial with expected uniforms and GLSL', () => {
    const mat = createSpeedLinesMaterial();
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(false);
    expect(mat.blending).toBe(THREE.AdditiveBlending);

    expect(mat.uniforms.uTime).toBeDefined();
    expect(mat.uniforms.uIntensity).toBeDefined();
    expect(mat.uniforms.uColorA).toBeDefined();
    expect(mat.uniforms.uColorB).toBeDefined();
    expect(mat.vertexShader).toContain('vScreenUv');
    expect(mat.fragmentShader).toContain('uIntensity');
    expect(mat.fragmentShader).toContain('uTime');

    mat.dispose();

    const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const atlasMat = createParticleAtlasMaterial(dummyTex);
    expect(atlasMat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(atlasMat.transparent).toBe(true);
    expect(atlasMat.depthWrite).toBe(false);
    expect(atlasMat.uniforms.uMap.value).toBe(dummyTex);
    expect(atlasMat.vertexShader).toContain('aCellOffset');
    expect(atlasMat.vertexShader).toContain('aColor');
    atlasMat.dispose();
    dummyTex.dispose();
  });

  it('registers validated 2x2 VFX sprite atlas in public/assets/manifest.json with valid PNG bytes', async () => {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const manifest = validateManifestSchema(JSON.parse(raw));

    const entry = manifest.assets.find((item) => item.id === 'vfx-particles-atlas');
    expect(entry).toBeDefined();
    expect(entry?.type).toBe('vfx');
    expect(entry?.path).toBe('/assets/vfx/particles_atlas.png');
    expect(entry?.validationStatus).toBe('validated');

    const atlasPath = path.join(PUBLIC_DIR, 'assets/vfx/particles_atlas.png');
    const bytes = await fs.readFile(atlasPath);
    // Standard 8-byte PNG signature
    expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.length).toBeGreaterThan(1024);
  });
});
