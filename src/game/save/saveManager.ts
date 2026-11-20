import { CHARACTERS, CHARACTERS_BY_ID } from '../../data/characters';
import { KARTS, KARTS_BY_ID } from '../../data/karts';
import { getTracksByCup } from '../../data/tracks';
import {
  DEFAULT_BINDINGS,
  DEFAULT_SETTINGS,
  createInitialSaveData,
} from '../core/constants';
import { detectMobileDevice } from '../core/mobile';
import type {
  CharacterId,
  ControlBindings,
  CupId,
  GameMode,
  GameSettings,
  KartId,
  QualityLevel,
  SaveDataV1,
  TouchControlsMode,
  TrackId,
} from '../core/types';

export const SAVE_STORAGE_KEY = 'kart-legends-3d:save:v1';

const VALID_CHARACTER_IDS = new Set<string>(Object.keys(CHARACTERS_BY_ID));
const VALID_KART_IDS = new Set<string>(Object.keys(KARTS_BY_ID));
const VALID_QUALITIES = new Set<QualityLevel>(['low', 'medium', 'high']);
const VALID_TOUCH_MODES = new Set<TouchControlsMode>(['auto', 'on', 'off']);

export interface LoadSaveResult {
  data: SaveDataV1;
  recoveredFromCorruption: boolean;
}

function getSafeStorage(explicitStorage?: Storage): Storage | null {
  if (explicitStorage) return explicitStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function clamp01(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(1, val));
}

function sanitizeBindings(raw: unknown): ControlBindings {
  const base = structuredClone(DEFAULT_BINDINGS);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  (Object.keys(base) as Array<keyof ControlBindings>).forEach((action) => {
    const val = obj[action];
    if (Array.isArray(val) && val.every((k) => typeof k === 'string' && k.length > 0)) {
      if (val.length > 0) {
        base[action] = [...val];
      }
    }
  });
  return base;
}

export function sanitizeSettings(raw: unknown): GameSettings {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const audio = (obj.audio && typeof obj.audio === 'object' ? obj.audio : {}) as Record<
    string,
    unknown
  >;
  const touch = (obj.touch && typeof obj.touch === 'object' ? obj.touch : {}) as Record<
    string,
    unknown
  >;

  return {
    quality: VALID_QUALITIES.has(obj.quality as QualityLevel)
      ? (obj.quality as QualityLevel)
      : base.quality,
    steeringSensitivity:
      typeof obj.steeringSensitivity === 'number' &&
      Number.isFinite(obj.steeringSensitivity) &&
      obj.steeringSensitivity >= 0.4 &&
      obj.steeringSensitivity <= 2.0
        ? obj.steeringSensitivity
        : base.steeringSensitivity,
    gamepadDeadzone:
      typeof obj.gamepadDeadzone === 'number' &&
      Number.isFinite(obj.gamepadDeadzone) &&
      obj.gamepadDeadzone >= 0.02 &&
      obj.gamepadDeadzone <= 0.45
        ? obj.gamepadDeadzone
        : base.gamepadDeadzone,
    audio: {
      musicVolume: clamp01(audio.musicVolume, base.audio.musicVolume),
      sfxVolume: clamp01(audio.sfxVolume, base.audio.sfxVolume),
      ambientVolume: clamp01(audio.ambientVolume, base.audio.ambientVolume),
      muted: typeof audio.muted === 'boolean' ? audio.muted : base.audio.muted,
    },
    bindings: sanitizeBindings(obj.bindings),
    touch: {
      mode: VALID_TOUCH_MODES.has(touch.mode as TouchControlsMode)
        ? (touch.mode as TouchControlsMode)
        : base.touch.mode,
      autoAccelerate:
        typeof touch.autoAccelerate === 'boolean'
          ? touch.autoAccelerate
          : base.touch.autoAccelerate,
    },
  };
}

function sanitizeTimeMap(raw: unknown): Partial<Record<TrackId, number>> {
  const result: Partial<Record<TrackId, number>> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      result[k as TrackId] = v;
    }
  }
  return result;
}

function nonNegInt(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
}

export function loadSaveData(
  explicitStorage?: Storage,
  isMobileOverride?: boolean,
): LoadSaveResult {
  const defaults = createInitialSaveData({
    isMobile: isMobileOverride ?? detectMobileDevice(),
  });
  const storage = getSafeStorage(explicitStorage);
  if (!storage) {
    return { data: defaults, recoveredFromCorruption: false };
  }

  let rawText: string | null;
  try {
    rawText = storage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return { data: defaults, recoveredFromCorruption: false };
  }

  if (rawText === null) {
    return { data: defaults, recoveredFromCorruption: false };
  }

  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Save payload is not an object');
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1) {
      throw new Error('Unsupported save schema version');
    }

    const chars = Array.isArray(obj.unlockedCharacters)
      ? obj.unlockedCharacters.filter(
          (id): id is CharacterId => typeof id === 'string' && VALID_CHARACTER_IDS.has(id),
        )
      : [];
    const karts = Array.isArray(obj.unlockedKarts)
      ? obj.unlockedKarts.filter(
          (id): id is KartId => typeof id === 'string' && VALID_KART_IDS.has(id),
        )
      : [];
    const tracks = Array.isArray(obj.unlockedTracks)
      ? (obj.unlockedTracks.filter((id): id is TrackId => typeof id === 'string') as TrackId[])
      : [];

    const trophies: Partial<Record<CupId, 'gold' | 'silver' | 'bronze'>> = {};
    if (obj.cupTrophies && typeof obj.cupTrophies === 'object') {
      for (const [cup, tier] of Object.entries(obj.cupTrophies as Record<string, unknown>)) {
        if (
          (cup === 'aurora' || cup === 'eclipse') &&
          (tier === 'gold' || tier === 'silver' || tier === 'bronze')
        ) {
          trophies[cup] = tier;
        }
      }
    }

    const statsObj = (obj.stats && typeof obj.stats === 'object' ? obj.stats : {}) as Record<
      string,
      unknown
    >;

    const merged: SaveDataV1 = {
      version: 1,
      updatedAt:
        typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
      unlockedCharacters: Array.from(
        new Set<CharacterId>([...defaults.unlockedCharacters, ...chars]),
      ),
      unlockedKarts: Array.from(new Set<KartId>([...defaults.unlockedKarts, ...karts])),
      unlockedTracks: Array.from(new Set<TrackId>([...defaults.unlockedTracks, ...tracks])),
      cupTrophies: trophies,
      bestLapTimesMs: sanitizeTimeMap(obj.bestLapTimesMs),
      bestRaceTimesMs: sanitizeTimeMap(obj.bestRaceTimesMs),
      stats: {
        racesCompleted: nonNegInt(statsObj.racesCompleted),
        racesWon: nonNegInt(statsObj.racesWon),
        championshipsWon: nonNegInt(statsObj.championshipsWon),
        totalDriftsCompleted: nonNegInt(statsObj.totalDriftsCompleted),
        totalTurbosTriggered: nonNegInt(statsObj.totalTurbosTriggered),
        totalItemsUsed: nonNegInt(statsObj.totalItemsUsed),
      },
      settings: sanitizeSettings(obj.settings),
    };

    return { data: merged, recoveredFromCorruption: false };
  } catch {
    const fresh = {
      ...defaults,
      updatedAt: new Date().toISOString(),
    };
    persistSaveData(fresh, storage);
    return { data: fresh, recoveredFromCorruption: true };
  }
}

export function persistSaveData(data: SaveDataV1, explicitStorage?: Storage): boolean {
  const storage = getSafeStorage(explicitStorage);
  if (!storage) return false;
  try {
    const payload: SaveDataV1 = {
      ...data,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function resetSaveData(explicitStorage?: Storage): SaveDataV1 {
  const fresh: SaveDataV1 = {
    ...createInitialSaveData(),
    updatedAt: new Date().toISOString(),
  };
  persistSaveData(fresh, explicitStorage);
  return fresh;
}

export interface RaceSaveOutcome {
  mode: GameMode;
  cupId: CupId;
  trackId: TrackId;
  playerRank: number;
  totalRaceTimeMs: number | null;
  bestLapMs: number | null;
  driftsCompleted: number;
  turbosTriggered: number;
  itemsUsed: number;
}

function addUnlockCharacter(
  list: CharacterId[],
  id: CharacterId,
  labels: string[],
): CharacterId[] {
  if (list.includes(id)) return list;
  const def = CHARACTERS.find((c) => c.id === id);
  if (def) labels.push(`Piloto: ${def.name}`);
  return [...list, id];
}

function addUnlockKart(list: KartId[], id: KartId, labels: string[]): KartId[] {
  if (list.includes(id)) return list;
  const def = KARTS.find((k) => k.id === id);
  if (def) labels.push(`Kart: ${def.name}`);
  return [...list, id];
}

export function applyRaceResultToSave(
  save: SaveDataV1,
  outcome: RaceSaveOutcome,
): { nextSave: SaveDataV1; newlyUnlocked: string[]; isNewBestRace: boolean; isNewBestLap: boolean } {
  if (outcome.mode === 'practice') {
    return { nextSave: save, newlyUnlocked: [], isNewBestRace: false, isNewBestLap: false };
  }

  const newlyUnlocked: string[] = [];
  let unlockedCharacters = [...save.unlockedCharacters];
  let unlockedKarts = [...save.unlockedKarts];

  const nextStats = {
    racesCompleted: save.stats.racesCompleted + 1,
    racesWon: save.stats.racesWon + (outcome.playerRank === 1 && outcome.mode !== 'time-trial' ? 1 : 0),
    championshipsWon: save.stats.championshipsWon,
    totalDriftsCompleted: save.stats.totalDriftsCompleted + Math.max(0, outcome.driftsCompleted),
    totalTurbosTriggered: save.stats.totalTurbosTriggered + Math.max(0, outcome.turbosTriggered),
    totalItemsUsed: save.stats.totalItemsUsed + Math.max(0, outcome.itemsUsed),
  };

  const bestLapTimesMs = { ...save.bestLapTimesMs };
  const bestRaceTimesMs = { ...save.bestRaceTimesMs };

  let isNewBestLap = false;
  if (outcome.bestLapMs !== null && outcome.bestLapMs > 0) {
    const prev = bestLapTimesMs[outcome.trackId];
    if (prev === undefined || outcome.bestLapMs < prev) {
      bestLapTimesMs[outcome.trackId] = outcome.bestLapMs;
      isNewBestLap = true;
    }
  }

  let isNewBestRace = false;
  if (outcome.totalRaceTimeMs !== null && outcome.totalRaceTimeMs > 0) {
    const prev = bestRaceTimesMs[outcome.trackId];
    if (prev === undefined || outcome.totalRaceTimeMs < prev) {
      bestRaceTimesMs[outcome.trackId] = outcome.totalRaceTimeMs;
      isNewBestRace = true;
    }
  }

  // Evaluate race-triggered unlock rules matching catalog descriptions
  if (outcome.cupId === 'aurora' && outcome.playerRank === 1 && outcome.mode !== 'time-trial') {
    unlockedCharacters = addUnlockCharacter(unlockedCharacters, 'tiko', newlyUnlocked);
  }
  if (nextStats.racesCompleted >= 3) {
    unlockedCharacters = addUnlockCharacter(unlockedCharacters, 'runi', newlyUnlocked);
  }
  if (outcome.mode === 'quick-race' && outcome.playerRank === 1) {
    unlockedKarts = addUnlockKart(unlockedKarts, 'chave-mestra-gt', newlyUnlocked);
  }
  if (nextStats.totalDriftsCompleted >= 20) {
    unlockedKarts = addUnlockKart(unlockedKarts, 'brisa-corsaria', newlyUnlocked);
  }
  if (outcome.mode === 'time-trial') {
    unlockedKarts = addUnlockKart(unlockedKarts, 'lamina-glacial', newlyUnlocked);
  }

  const nextSave: SaveDataV1 = {
    ...save,
    updatedAt: new Date().toISOString(),
    unlockedCharacters,
    unlockedKarts,
    bestLapTimesMs,
    bestRaceTimesMs,
    stats: nextStats,
  };

  return { nextSave, newlyUnlocked, isNewBestRace, isNewBestLap };
}

function trophyRankValue(trophy: 'gold' | 'silver' | 'bronze' | undefined): number {
  if (trophy === 'gold') return 3;
  if (trophy === 'silver') return 2;
  if (trophy === 'bronze') return 1;
  return 0;
}

export function applyChampionshipCompletionToSave(
  save: SaveDataV1,
  cupId: CupId,
  playerRank: number,
): { nextSave: SaveDataV1; newlyUnlocked: string[]; trophy: 'gold' | 'silver' | 'bronze' | null } {
  const newlyUnlocked: string[] = [];
  let unlockedCharacters = [...save.unlockedCharacters];
  let unlockedKarts = [...save.unlockedKarts];
  let unlockedTracks = [...save.unlockedTracks];
  const cupTrophies = { ...save.cupTrophies };

  const trophy: 'gold' | 'silver' | 'bronze' | null =
    playerRank === 1 ? 'gold' : playerRank === 2 ? 'silver' : playerRank === 3 ? 'bronze' : null;

  if (trophy && trophyRankValue(trophy) > trophyRankValue(cupTrophies[cupId])) {
    cupTrophies[cupId] = trophy;
  }

  if (cupId === 'aurora') {
    unlockedKarts = addUnlockKart(unlockedKarts, 'escorpiao-dourado', newlyUnlocked);
    if (playerRank <= 3) {
      unlockedCharacters = addUnlockCharacter(unlockedCharacters, 'mavi', newlyUnlocked);
      const eclipseTracks = getTracksByCup('eclipse').map((t) => t.id);
      if (eclipseTracks.some((tid) => !unlockedTracks.includes(tid))) {
        unlockedTracks = Array.from(new Set([...unlockedTracks, ...eclipseTracks]));
        newlyUnlocked.push('Copa Eclipse (4 Pistas)');
      }
    }
  }

  if (cupId === 'eclipse' && playerRank <= 3) {
    unlockedCharacters = addUnlockCharacter(unlockedCharacters, 'zera', newlyUnlocked);
  }

  const nextSave: SaveDataV1 = {
    ...save,
    updatedAt: new Date().toISOString(),
    unlockedCharacters,
    unlockedKarts,
    unlockedTracks,
    cupTrophies,
    stats: {
      ...save.stats,
      championshipsWon: save.stats.championshipsWon + (playerRank === 1 ? 1 : 0),
    },
  };

  return { nextSave, newlyUnlocked, trophy };
}

export function isCupUnlocked(save: SaveDataV1, cupId: CupId, mode: GameMode): boolean {
  if (mode === 'practice' || cupId === 'aurora') return true;
  const eclipseTracks = getTracksByCup('eclipse');
  return eclipseTracks.every((t) => save.unlockedTracks.includes(t.id));
}
