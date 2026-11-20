import type { QualityLevel, SurfaceType, TrackId } from '../core/types';

export interface QualityPresetConfig {
  dpr: [number, number];
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: 256 | 512 | 1024;
  maxParticles: number;
  ambientParticlesPerSec: number;
  enableSpeedLines: boolean;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPresetConfig> = {
  low: {
    dpr: [1, 1],
    antialias: false,
    shadowsEnabled: false,
    shadowMapSize: 256,
    maxParticles: 64,
    ambientParticlesPerSec: 6,
    enableSpeedLines: false,
  },
  medium: {
    dpr: [1, 1.25],
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 512,
    maxParticles: 140,
    ambientParticlesPerSec: 16,
    enableSpeedLines: true,
  },
  high: {
    dpr: [1, 1.5],
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    maxParticles: 240,
    ambientParticlesPerSec: 28,
    enableSpeedLines: true,
  },
};

export interface SurfaceParticleStyle {
  color: string;
  size: number;
  upwardSpeed: number;
}

export const SURFACE_PARTICLE_STYLE: Record<SurfaceType, SurfaceParticleStyle> = {
  asphalt: { color: '#e2e8f0', size: 0.34, upwardSpeed: 1.2 },
  dirt: { color: '#b45309', size: 0.44, upwardSpeed: 1.8 },
  grass: { color: '#4ade80', size: 0.4, upwardSpeed: 2.1 },
  sand: { color: '#fde047', size: 0.44, upwardSpeed: 1.9 },
  ice: { color: '#bae6fd', size: 0.38, upwardSpeed: 1.5 },
};

export interface BiomeWeatherStyle {
  color: string;
  size: number;
  fallSpeed: number;
  driftX: number;
  driftZ: number;
}

export const BIOME_WEATHER_CONFIG: Record<TrackId, BiomeWeatherStyle> = {
  'porto-das-lanternas': { color: '#fef3c7', size: 0.24, fallSpeed: 0.9, driftX: 1.6, driftZ: 0.8 },
  'bosque-de-cristal': { color: '#5eead4', size: 0.28, fallSpeed: 1.2, driftX: 1.1, driftZ: -0.9 },
  'vale-dos-moinhos': { color: '#fef08a', size: 0.22, fallSpeed: 0.8, driftX: 2.4, driftZ: 0.6 },
  'canion-solar': { color: '#fdba74', size: 0.3, fallSpeed: 0.7, driftX: 3.4, driftZ: 1.2 },
  'cidade-neon': { color: '#38bdf8', size: 0.22, fallSpeed: 1.8, driftX: 0.4, driftZ: 0.4 },
  'pico-boreal': { color: '#f0f9ff', size: 0.32, fallSpeed: 3.8, driftX: 1.9, driftZ: 1.1 },
  'jardim-celeste': { color: '#f5d0fe', size: 0.26, fallSpeed: 0.6, driftX: 1.2, driftZ: -1.1 },
  'fortaleza-tempestade': { color: '#a5b4fc', size: 0.28, fallSpeed: 11.5, driftX: 2.6, driftZ: 1.4 },
};
