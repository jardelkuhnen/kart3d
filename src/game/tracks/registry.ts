import { publicUrl } from '../core/publicUrl';
import type { TrackId } from '../core/types';
import { BOSQUE_DE_CRISTAL_LAYOUT } from './bosqueDeCristal';
import { CANION_SOLAR_LAYOUT } from './canionSolar';
import { CIDADE_NEON_LAYOUT } from './cidadeNeon';
import { FORTALEZA_TEMPESTADE_LAYOUT } from './fortalezaTempestade';
import { JARDIM_CELESTE_LAYOUT } from './jardimCeleste';
import { PICO_BOREAL_LAYOUT } from './picoBoreal';
import { PORTO_DAS_LANTERNAS_LAYOUT } from './portoDasLanternas';
import type { TrackLayoutDef, TrackVisualTheme } from './trackGeometry';
import { VALE_DOS_MOINHOS_LAYOUT } from './valeDosMoinhos';

export const AURORA_TRACK_IDS: readonly TrackId[] = [
  'porto-das-lanternas',
  'bosque-de-cristal',
  'vale-dos-moinhos',
  'canion-solar',
] as const;

export const ECLIPSE_TRACK_IDS: readonly TrackId[] = [
  'cidade-neon',
  'pico-boreal',
  'jardim-celeste',
  'fortaleza-tempestade',
] as const;

export const AVAILABLE_TRACK_IDS: readonly TrackId[] = [
  ...AURORA_TRACK_IDS,
  ...ECLIPSE_TRACK_IDS,
] as const;

export const TRACK_LAYOUTS: Record<TrackId, TrackLayoutDef> = {
  'porto-das-lanternas': PORTO_DAS_LANTERNAS_LAYOUT,
  'bosque-de-cristal': BOSQUE_DE_CRISTAL_LAYOUT,
  'vale-dos-moinhos': VALE_DOS_MOINHOS_LAYOUT,
  'canion-solar': CANION_SOLAR_LAYOUT,
  'cidade-neon': CIDADE_NEON_LAYOUT,
  'pico-boreal': PICO_BOREAL_LAYOUT,
  'jardim-celeste': JARDIM_CELESTE_LAYOUT,
  'fortaleza-tempestade': FORTALEZA_TEMPESTADE_LAYOUT,
};

export const FALLBACK_TRACK_GLB_PATHS: Record<TrackId, string> = {
  'porto-das-lanternas': publicUrl('/assets/tracks/porto_das_lanternas.glb'),
  'bosque-de-cristal': publicUrl('/assets/tracks/bosque_de_cristal.glb'),
  'vale-dos-moinhos': publicUrl('/assets/tracks/vale_dos_moinhos.glb'),
  'canion-solar': publicUrl('/assets/tracks/canion_solar.glb'),
  'cidade-neon': publicUrl('/assets/tracks/cidade_neon.glb'),
  'pico-boreal': publicUrl('/assets/tracks/pico_boreal.glb'),
  'jardim-celeste': publicUrl('/assets/tracks/jardim_celeste.glb'),
  'fortaleza-tempestade': publicUrl('/assets/tracks/fortaleza_tempestade.glb'),
};

const PORTO_THEME: TrackVisualTheme = {
  skyTopColor: '#2563eb',
  skyHorizonColor: '#f6ad55',
  fogColor: '#f6ad55',
  fogNear: 110,
  fogFar: 320,
  sunColor: '#fde68a',
  sunPosition: [-240, 64, -180],
  sunIntensity: 2.35,
  hemiSkyColor: '#bae6fd',
  hemiGroundColor: '#ea580c',
  hemiIntensity: 1.05,
  envPrimaryColor: '#fed7aa',
  envSecondaryColor: '#60a5fa',
  musicAssetId: 'music-race-aurora',
  ambienceAssetId: 'sfx-ambience-coastal',
  shortcutBannerLabel: 'ATALHO DO PORTO',
};

const BOSQUE_THEME: TrackVisualTheme = {
  skyTopColor: '#0f766e',
  skyHorizonColor: '#99f6e4',
  fogColor: '#6ee7b7',
  fogNear: 95,
  fogFar: 300,
  sunColor: '#d9f99d',
  sunPosition: [180, 78, -190],
  sunIntensity: 2.1,
  hemiSkyColor: '#a7f3d0',
  hemiGroundColor: '#065f46',
  hemiIntensity: 1.15,
  envPrimaryColor: '#99f6e4',
  envSecondaryColor: '#67e8f9',
  musicAssetId: 'music-race-aurora',
  ambienceAssetId: 'sfx-ambience-forest',
  shortcutBannerLabel: 'ATALHO DOS COGUMELOS',
};

const VALE_THEME: TrackVisualTheme = {
  skyTopColor: '#0284c7',
  skyHorizonColor: '#bae6fd',
  fogColor: '#bae6fd',
  fogNear: 120,
  fogFar: 340,
  sunColor: '#fef08a',
  sunPosition: [-190, 96, -160],
  sunIntensity: 2.4,
  hemiSkyColor: '#e0f2fe',
  hemiGroundColor: '#4d7c0f',
  hemiIntensity: 1.1,
  envPrimaryColor: '#fef08a',
  envSecondaryColor: '#38bdf8',
  musicAssetId: 'music-race-aurora',
  ambienceAssetId: 'sfx-ambience-valley',
  shortcutBannerLabel: 'ATALHO DA COLINA',
};

const CANION_THEME: TrackVisualTheme = {
  skyTopColor: '#c2410c',
  skyHorizonColor: '#fde047',
  fogColor: '#fdba74',
  fogNear: 105,
  fogFar: 320,
  sunColor: '#fef08a',
  sunPosition: [210, 82, -140],
  sunIntensity: 2.6,
  hemiSkyColor: '#fed7aa',
  hemiGroundColor: '#9a3412',
  hemiIntensity: 1.05,
  envPrimaryColor: '#fde047',
  envSecondaryColor: '#fb923c',
  musicAssetId: 'music-race-aurora',
  ambienceAssetId: 'sfx-ambience-canyon',
  shortcutBannerLabel: 'ATALHO DAS DUNAS',
};

const NEON_THEME: TrackVisualTheme = {
  skyTopColor: '#090d1f',
  skyHorizonColor: '#312e81',
  fogColor: '#1e1b4b',
  fogNear: 90,
  fogFar: 290,
  sunColor: '#a855f7',
  sunPosition: [-160, 72, -180],
  sunIntensity: 1.9,
  hemiSkyColor: '#38bdf8',
  hemiGroundColor: '#312e81',
  hemiIntensity: 1.25,
  envPrimaryColor: '#38bdf8',
  envSecondaryColor: '#ec4899',
  musicAssetId: 'music-race-eclipse',
  ambienceAssetId: 'sfx-ambience-neon',
  shortcutBannerLabel: 'ATALHO DO VIADUTO',
  hasStarfield: true,
};

const BOREAL_THEME: TrackVisualTheme = {
  skyTopColor: '#0f172a',
  skyHorizonColor: '#2dd4bf',
  fogColor: '#5eead4',
  fogNear: 95,
  fogFar: 310,
  sunColor: '#e0f2fe',
  sunPosition: [170, 68, -190],
  sunIntensity: 2.15,
  hemiSkyColor: '#bae6fd',
  hemiGroundColor: '#1e3a8a',
  hemiIntensity: 1.25,
  envPrimaryColor: '#5eead4',
  envSecondaryColor: '#93c5fd',
  musicAssetId: 'music-race-eclipse',
  ambienceAssetId: 'sfx-ambience-boreal',
  shortcutBannerLabel: 'ATALHO DO GLACIAR',
  hasStarfield: true,
};

const CELESTE_THEME: TrackVisualTheme = {
  skyTopColor: '#0284c7',
  skyHorizonColor: '#fdf4ff',
  fogColor: '#e0f2fe',
  fogNear: 120,
  fogFar: 350,
  sunColor: '#fef08a',
  sunPosition: [-150, 105, -160],
  sunIntensity: 2.45,
  hemiSkyColor: '#f0abfc',
  hemiGroundColor: '#38bdf8',
  hemiIntensity: 1.3,
  envPrimaryColor: '#fef08a',
  envSecondaryColor: '#f0abfc',
  musicAssetId: 'music-race-eclipse',
  ambienceAssetId: 'sfx-ambience-sky',
  shortcutBannerLabel: 'ATALHO DAS NUVENS',
};

const FORTALEZA_THEME: TrackVisualTheme = {
  skyTopColor: '#111827',
  skyHorizonColor: '#4c1d95',
  fogColor: '#3b0764',
  fogNear: 85,
  fogFar: 280,
  sunColor: '#c4b5fd',
  sunPosition: [185, 86, -155],
  sunIntensity: 1.95,
  hemiSkyColor: '#a78bfa',
  hemiGroundColor: '#1f2937',
  hemiIntensity: 1.2,
  envPrimaryColor: '#a78bfa',
  envSecondaryColor: '#38bdf8',
  musicAssetId: 'music-race-eclipse',
  ambienceAssetId: 'sfx-ambience-storm',
  shortcutBannerLabel: 'ATALHO DA MURALHA',
  hasLightning: true,
  hasStarfield: true,
};

export const TRACK_VISUAL_THEMES: Record<TrackId, TrackVisualTheme> = {
  'porto-das-lanternas': PORTO_THEME,
  'bosque-de-cristal': BOSQUE_THEME,
  'vale-dos-moinhos': VALE_THEME,
  'canion-solar': CANION_THEME,
  'cidade-neon': NEON_THEME,
  'pico-boreal': BOREAL_THEME,
  'jardim-celeste': CELESTE_THEME,
  'fortaleza-tempestade': FORTALEZA_THEME,
};

export function getTrackLayout(trackId: TrackId): TrackLayoutDef {
  return TRACK_LAYOUTS[trackId] ?? PORTO_DAS_LANTERNAS_LAYOUT;
}

export function getTrackVisualTheme(trackId: TrackId): TrackVisualTheme {
  return TRACK_VISUAL_THEMES[trackId] ?? PORTO_THEME;
}
