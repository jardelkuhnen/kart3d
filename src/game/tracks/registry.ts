import type { TrackId } from '../core/types';
import { BOSQUE_DE_CRISTAL_LAYOUT } from './bosqueDeCristal';
import { CANION_SOLAR_LAYOUT } from './canionSolar';
import { PORTO_DAS_LANTERNAS_LAYOUT } from './portoDasLanternas';
import type { TrackLayoutDef, TrackVisualTheme } from './trackGeometry';
import { VALE_DOS_MOINHOS_LAYOUT } from './valeDosMoinhos';

export const AURORA_TRACK_IDS: readonly TrackId[] = [
  'porto-das-lanternas',
  'bosque-de-cristal',
  'vale-dos-moinhos',
  'canion-solar',
] as const;

// In Slice 4 only Copa Aurora tracks exist as distinct circuits; Copa Eclipse will replace the fallback entries in Slice 5.
export const AVAILABLE_TRACK_IDS: readonly TrackId[] = AURORA_TRACK_IDS;

export const TRACK_LAYOUTS: Record<TrackId, TrackLayoutDef> = {
  'porto-das-lanternas': PORTO_DAS_LANTERNAS_LAYOUT,
  'bosque-de-cristal': BOSQUE_DE_CRISTAL_LAYOUT,
  'vale-dos-moinhos': VALE_DOS_MOINHOS_LAYOUT,
  'canion-solar': CANION_SOLAR_LAYOUT,
  'cidade-neon': PORTO_DAS_LANTERNAS_LAYOUT,
  'pico-boreal': PORTO_DAS_LANTERNAS_LAYOUT,
  'jardim-celeste': PORTO_DAS_LANTERNAS_LAYOUT,
  'fortaleza-tempestade': PORTO_DAS_LANTERNAS_LAYOUT,
};

export const FALLBACK_TRACK_GLB_PATHS: Record<TrackId, string> = {
  'porto-das-lanternas': '/assets/tracks/porto_das_lanternas.glb',
  'bosque-de-cristal': '/assets/tracks/bosque_de_cristal.glb',
  'vale-dos-moinhos': '/assets/tracks/vale_dos_moinhos.glb',
  'canion-solar': '/assets/tracks/canion_solar.glb',
  'cidade-neon': '/assets/tracks/porto_das_lanternas.glb',
  'pico-boreal': '/assets/tracks/porto_das_lanternas.glb',
  'jardim-celeste': '/assets/tracks/porto_das_lanternas.glb',
  'fortaleza-tempestade': '/assets/tracks/porto_das_lanternas.glb',
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

export const TRACK_VISUAL_THEMES: Record<TrackId, TrackVisualTheme> = {
  'porto-das-lanternas': PORTO_THEME,
  'bosque-de-cristal': BOSQUE_THEME,
  'vale-dos-moinhos': VALE_THEME,
  'canion-solar': CANION_THEME,
  'cidade-neon': PORTO_THEME,
  'pico-boreal': PORTO_THEME,
  'jardim-celeste': PORTO_THEME,
  'fortaleza-tempestade': PORTO_THEME,
};

export function getTrackLayout(trackId: TrackId): TrackLayoutDef {
  return TRACK_LAYOUTS[trackId] ?? PORTO_DAS_LANTERNAS_LAYOUT;
}

export function getTrackVisualTheme(trackId: TrackId): TrackVisualTheme {
  return TRACK_VISUAL_THEMES[trackId] ?? PORTO_THEME;
}
