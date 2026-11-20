import { DEFAULT_LAPS } from '../game/core/constants';
import type { CupDef, CupId, TrackDef, TrackId } from '../game/core/types';

export const CUPS: readonly CupDef[] = [
  {
    id: 'aurora',
    name: 'Copa Aurora',
    subtitle: 'Rotas litorâneas, bosques luminosos, vales e cânions dourados.',
    accentColor: '#f59e0b',
    trackIds: [
      'porto-das-lanternas',
      'bosque-de-cristal',
      'vale-dos-moinhos',
      'canion-solar',
    ],
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
  },
  {
    id: 'eclipse',
    name: 'Copa Eclipse',
    subtitle: 'Circuitos noturnos, picos glaciais, jardins suspensos e fortalezas.',
    accentColor: '#8b5cf6',
    trackIds: [
      'cidade-neon',
      'pico-boreal',
      'jardim-celeste',
      'fortaleza-tempestade',
    ],
    unlockedByDefault: false,
    unlockRequirementLabel: 'Alcance o pódio na Copa Aurora',
  },
] as const;

export const TRACKS: readonly TrackDef[] = [
  {
    id: 'porto-das-lanternas',
    name: 'Porto das Lanternas',
    cupId: 'aurora',
    cupOrder: 1,
    theme: 'Cidade costeira ao pôr do sol',
    description:
      'Ruas de pedra junto ao porto iluminado por lanternas, passando por mercado, ponte e túnel costeiro.',
    dominantSurface: 'asphalt',
    availableSurfaces: ['asphalt', 'dirt', 'grass'],
    laps: DEFAULT_LAPS,
    difficultyRating: 1,
    skyTopColor: '#2563eb',
    skyHorizonColor: '#fb923c',
    ambientLightColor: '#fde68a',
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'track-porto-das-lanternas',
  },
  {
    id: 'bosque-de-cristal',
    name: 'Bosque de Cristal',
    cupId: 'aurora',
    cupOrder: 2,
    theme: 'Floresta fantástica',
    description:
      'Trilha entre árvores gigantes, pontes de madeira sobre cachoeiras e cavernas de cristais emissivos.',
    dominantSurface: 'dirt',
    availableSurfaces: ['asphalt', 'dirt', 'grass'],
    laps: DEFAULT_LAPS,
    difficultyRating: 2,
    skyTopColor: '#0f766e',
    skyHorizonColor: '#a7f3d0',
    ambientLightColor: '#99f6e4',
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'track-bosque-de-cristal',
  },
  {
    id: 'vale-dos-moinhos',
    name: 'Vale dos Moinhos',
    cupId: 'aurora',
    cupOrder: 3,
    theme: 'Região montanhosa rural',
    description:
      'Aclives com moinhos giratórios, fazendas, rios cruzados por pontes e rampas velozes.',
    dominantSurface: 'asphalt',
    availableSurfaces: ['asphalt', 'dirt', 'grass'],
    laps: DEFAULT_LAPS,
    difficultyRating: 2,
    skyTopColor: '#0284c7',
    skyHorizonColor: '#bae6fd',
    ambientLightColor: '#fef9c3',
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'track-vale-dos-moinhos',
  },
  {
    id: 'canion-solar',
    name: 'Cânion Solar',
    cupId: 'aurora',
    cupOrder: 4,
    theme: 'Deserto rochoso',
    description:
      'Desfiladeiros avermelhados, ruínas antigas, pontes estreitas e atalhos em dunas de areia.',
    dominantSurface: 'sand',
    availableSurfaces: ['asphalt', 'dirt', 'sand'],
    laps: DEFAULT_LAPS,
    difficultyRating: 3,
    skyTopColor: '#c2410c',
    skyHorizonColor: '#fde047',
    ambientLightColor: '#fed7aa',
    unlockedByDefault: true,
    unlockRequirementLabel: 'Disponível desde o início',
    modelAssetId: 'track-canion-solar',
  },
  {
    id: 'cidade-neon',
    name: 'Cidade Neon',
    cupId: 'eclipse',
    cupOrder: 1,
    theme: 'Circuito urbano noturno',
    description:
      'Viadutos elevados, túneis luminosos, asfalto úmido com reflexos intensos e barreiras móveis.',
    dominantSurface: 'asphalt',
    availableSurfaces: ['asphalt'],
    laps: DEFAULT_LAPS,
    difficultyRating: 3,
    skyTopColor: '#090d1f',
    skyHorizonColor: '#312e81',
    ambientLightColor: '#818cf8',
    unlockedByDefault: false,
    unlockRequirementLabel: 'Desbloqueada ao liberar a Copa Eclipse',
    modelAssetId: 'track-cidade-neon',
  },
  {
    id: 'pico-boreal',
    name: 'Pico Boreal',
    cupId: 'eclipse',
    cupOrder: 2,
    theme: 'Montanhas congeladas',
    description:
      'Cavernas de gelo, pontes suspensas sob aurora boreal e trechos escorregadios que premiam controle de drift.',
    dominantSurface: 'ice',
    availableSurfaces: ['asphalt', 'ice', 'dirt'],
    laps: DEFAULT_LAPS,
    difficultyRating: 4,
    skyTopColor: '#0f172a',
    skyHorizonColor: '#2dd4bf',
    ambientLightColor: '#bae6fd',
    unlockedByDefault: false,
    unlockRequirementLabel: 'Desbloqueada ao liberar a Copa Eclipse',
    modelAssetId: 'track-pico-boreal',
  },
  {
    id: 'jardim-celeste',
    name: 'Jardim Celeste',
    cupId: 'eclipse',
    cupOrder: 3,
    theme: 'Ilhas suspensas',
    description:
      'Plataformas flutuantes interligadas por pontes aéreas, cachoeiras no vazio e grandes saltos.',
    dominantSurface: 'asphalt',
    availableSurfaces: ['asphalt', 'grass'],
    laps: DEFAULT_LAPS,
    difficultyRating: 4,
    skyTopColor: '#38bdf8',
    skyHorizonColor: '#fdf4ff',
    ambientLightColor: '#fef08a',
    unlockedByDefault: false,
    unlockRequirementLabel: 'Desbloqueada ao liberar a Copa Eclipse',
    modelAssetId: 'track-jardim-celeste',
  },
  {
    id: 'fortaleza-tempestade',
    name: 'Fortaleza Tempestade',
    cupId: 'eclipse',
    cupOrder: 4,
    theme: 'Castelo fantástico sob tempestade',
    description:
      'Salões de pedra, torres, portões móveis e curvas técnicas sob relâmpagos contínuos.',
    dominantSurface: 'asphalt',
    availableSurfaces: ['asphalt', 'dirt'],
    laps: DEFAULT_LAPS,
    difficultyRating: 5,
    skyTopColor: '#111827',
    skyHorizonColor: '#4c1d95',
    ambientLightColor: '#c4b5fd',
    unlockedByDefault: false,
    unlockRequirementLabel: 'Desbloqueada ao liberar a Copa Eclipse',
    modelAssetId: 'track-fortaleza-tempestade',
  },
] as const;

export const CUPS_BY_ID: Record<CupId, CupDef> = Object.fromEntries(
  CUPS.map((cup) => [cup.id, cup]),
) as Record<CupId, CupDef>;

export const TRACKS_BY_ID: Record<TrackId, TrackDef> = Object.fromEntries(
  TRACKS.map((track) => [track.id, track]),
) as Record<TrackId, TrackDef>;

export function getTrackById(id: TrackId): TrackDef {
  return TRACKS_BY_ID[id];
}

export function getTracksByCup(cupId: CupId): TrackDef[] {
  return TRACKS.filter((track) => track.cupId === cupId).sort((a, b) => a.cupOrder - b.cupOrder);
}
