import { create } from 'zustand';
import { getTracksByCup, getTrackById } from '../data/tracks';
import type {
  AssetManifest,
  CharacterId,
  CupId,
  Difficulty,
  GameMode,
  GameSettings,
  KartId,
  SaveDataV1,
  ScreenId,
  TrackId,
} from '../game/core/types';
import {
  type ChampionshipState,
  createChampionship,
  recordChampionshipRace,
} from '../game/racing/championshipManager';
import type { StandingEntry } from '../game/racing/raceSimulation';
import {
  applyChampionshipCompletionToSave,
  applyRaceResultToSave,
  isCupUnlocked,
  loadSaveData,
  persistSaveData,
  resetSaveData,
} from '../game/save/saveManager';

export function sanitizeSelectionsForMode(
  mode: GameMode,
  saveData: SaveDataV1,
  current: {
    selectedCharacterId: CharacterId;
    selectedKartId: KartId;
    selectedCupId: CupId;
    selectedTrackId: TrackId;
  },
): {
  selectedCharacterId: CharacterId;
  selectedKartId: KartId;
  selectedCupId: CupId;
  selectedTrackId: TrackId;
} {
  if (mode === 'practice') {
    return current;
  }

  const selectedCharacterId = saveData.unlockedCharacters.includes(current.selectedCharacterId)
    ? current.selectedCharacterId
    : (saveData.unlockedCharacters[0] ?? 'nilo');

  const selectedKartId = saveData.unlockedKarts.includes(current.selectedKartId)
    ? current.selectedKartId
    : (saveData.unlockedKarts[0] ?? 'trilha-raposa');

  const selectedCupId: CupId = isCupUnlocked(saveData, current.selectedCupId, mode)
    ? current.selectedCupId
    : 'aurora';

  const cupTracks = getTracksByCup(selectedCupId);
  const currentTrackValid =
    saveData.unlockedTracks.includes(current.selectedTrackId) &&
    getTrackById(current.selectedTrackId).cupId === selectedCupId;

  const firstUnlockedInCup =
    cupTracks.find((tr) => saveData.unlockedTracks.includes(tr.id))?.id ??
    saveData.unlockedTracks[0] ??
    'porto-das-lanternas';

  const selectedTrackId = currentTrackValid ? current.selectedTrackId : firstUnlockedInCup;

  return {
    selectedCharacterId,
    selectedKartId,
    selectedCupId,
    selectedTrackId,
  };
}

export interface RaceCompletionSummary {
  mode: GameMode;
  cupId: CupId;
  trackId: TrackId;
  playerRank: number;
  totalRaceTimeMs: number;
  bestLapMs: number | null;
  lapTimesMs: number[];
  standings: StandingEntry[];
  newlyUnlocked: string[];
  isNewBestRace: boolean;
  isNewBestLap: boolean;
  championshipFinished: boolean;
  championshipTrophy: 'gold' | 'silver' | 'bronze' | null;
}

export interface GameStoreState {
  screen: ScreenId;
  previousScreen: ScreenId;
  mode: GameMode;
  difficulty: Difficulty;
  selectedCharacterId: CharacterId;
  selectedKartId: KartId;
  selectedCupId: CupId;
  selectedTrackId: TrackId;
  manifest: AssetManifest | null;
  manifestError: string | null;
  physicsStepsObserved: number;
  settings: GameSettings;
  saveData: SaveDataV1;
  saveRecoveredNotice: boolean;
  championship: ChampionshipState | null;
  lastRaceResult: RaceCompletionSummary | null;

  setScreen: (screen: ScreenId) => void;
  openSettings: () => void;
  closeSettings: () => void;
  dismissSaveRecoveredNotice: () => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setSelectedCharacterId: (id: CharacterId) => void;
  setSelectedKartId: (id: KartId) => void;
  setSelectedCupId: (id: CupId) => void;
  setSelectedTrackId: (id: TrackId) => void;
  setManifest: (manifest: AssetManifest) => void;
  setManifestError: (error: string | null) => void;
  incrementPhysicsSteps: (steps: number) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  startNewChampionship: () => void;
  advanceChampionshipRace: () => void;
  clearChampionship: () => void;
  commitRaceOutcome: (payload: {
    trackId: TrackId;
    playerRank: number;
    totalRaceTimeMs: number;
    bestLapMs: number | null;
    lapTimesMs: number[];
    standings: StandingEntry[];
    driftsCompleted: number;
    turbosTriggered: number;
    itemsUsed: number;
  }) => void;
  resetAllProgress: () => void;
}

const initialLoad = loadSaveData();

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'loading',
  previousScreen: 'main-menu',
  mode: 'quick-race',
  difficulty: 'normal',
  selectedCharacterId: 'nilo',
  selectedKartId: 'trilha-raposa',
  selectedCupId: 'aurora',
  selectedTrackId: 'porto-das-lanternas',
  manifest: null,
  manifestError: null,
  physicsStepsObserved: 0,
  settings: structuredClone(initialLoad.data.settings),
  saveData: initialLoad.data,
  saveRecoveredNotice: initialLoad.recoveredFromCorruption,
  championship: null,
  lastRaceResult: null,

  setScreen: (screen) => set({ screen }),
  openSettings: () =>
    set((state) => ({
      previousScreen: state.screen === 'settings' ? state.previousScreen : state.screen,
      screen: 'settings',
    })),
  closeSettings: () =>
    set((state) => ({
      screen: state.previousScreen === 'settings' ? 'main-menu' : state.previousScreen,
    })),
  dismissSaveRecoveredNotice: () => set({ saveRecoveredNotice: false }),
  setMode: (mode) =>
    set((state) => ({
      mode,
      ...sanitizeSelectionsForMode(mode, state.saveData, state),
    })),
  setDifficulty: (difficulty) => set({ difficulty }),
  setSelectedCharacterId: (selectedCharacterId) => set({ selectedCharacterId }),
  setSelectedKartId: (selectedKartId) => set({ selectedKartId }),
  setSelectedCupId: (selectedCupId) => set({ selectedCupId }),
  setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId }),
  setManifest: (manifest) => set({ manifest, manifestError: null }),
  setManifestError: (manifestError) => set({ manifestError }),
  incrementPhysicsSteps: (steps) =>
    set((state) => ({ physicsStepsObserved: state.physicsStepsObserved + steps })),
  updateSettings: (partial) =>
    set((state) => {
      const nextSettings: GameSettings = {
        ...state.settings,
        ...partial,
      };
      const nextSave: SaveDataV1 = {
        ...state.saveData,
        settings: nextSettings,
      };
      persistSaveData(nextSave);
      return {
        settings: nextSettings,
        saveData: nextSave,
      };
    }),
  startNewChampionship: () => {
    const state = get();
    const champ = createChampionship(
      state.selectedCupId,
      state.difficulty,
      state.selectedCharacterId,
      state.selectedKartId,
    );
    const cupTracks = getTracksByCup(state.selectedCupId);
    set({
      championship: champ,
      selectedTrackId: cupTracks[0]?.id ?? state.selectedTrackId,
      lastRaceResult: null,
    });
  },
  advanceChampionshipRace: () => {
    const state = get();
    if (!state.championship) return;
    const nextTrackId = state.championship.trackIds[state.championship.currentRaceIndex];
    if (nextTrackId) {
      set({ selectedTrackId: nextTrackId });
    }
  },
  clearChampionship: () => set({ championship: null }),
  commitRaceOutcome: (payload) => {
    const state = get();
    const { nextSave: postRaceSave, newlyUnlocked, isNewBestRace, isNewBestLap } =
      applyRaceResultToSave(state.saveData, {
        mode: state.mode,
        cupId: state.selectedCupId,
        trackId: payload.trackId,
        playerRank: payload.playerRank,
        totalRaceTimeMs: state.mode === 'practice' ? null : payload.totalRaceTimeMs,
        bestLapMs: state.mode === 'practice' ? null : payload.bestLapMs,
        driftsCompleted: payload.driftsCompleted,
        turbosTriggered: payload.turbosTriggered,
        itemsUsed: payload.itemsUsed,
      });

    let finalSave = postRaceSave;
    const allUnlocked = [...newlyUnlocked];
    let nextChamp = state.championship;
    let championshipFinished = false;
    let championshipTrophy: 'gold' | 'silver' | 'bronze' | null = null;

    if (state.mode === 'championship' && state.championship) {
      nextChamp = recordChampionshipRace(state.championship, payload.standings);
      if (nextChamp.finished) {
        championshipFinished = true;
        const playerStanding = nextChamp.standings.find((s) => s.isPlayer);
        const champRank = playerStanding?.rank ?? 8;
        const champResult = applyChampionshipCompletionToSave(
          finalSave,
          nextChamp.cupId,
          champRank,
        );
        finalSave = champResult.nextSave;
        championshipTrophy = champResult.trophy;
        allUnlocked.push(...champResult.newlyUnlocked);
      }
    }

    persistSaveData(finalSave);

    set({
      saveData: finalSave,
      championship: nextChamp,
      lastRaceResult: {
        mode: state.mode,
        cupId: state.selectedCupId,
        trackId: payload.trackId,
        playerRank: payload.playerRank,
        totalRaceTimeMs: payload.totalRaceTimeMs,
        bestLapMs: payload.bestLapMs,
        lapTimesMs: payload.lapTimesMs,
        standings: payload.standings,
        newlyUnlocked: Array.from(new Set(allUnlocked)),
        isNewBestRace,
        isNewBestLap,
        championshipFinished,
        championshipTrophy,
      },
    });
  },
  resetAllProgress: () => {
    const currentSettings = get().settings;
    const fresh = resetSaveData();
    const preserved: SaveDataV1 = {
      ...fresh,
      settings: currentSettings,
    };
    persistSaveData(preserved);
    set({
      saveData: preserved,
      selectedCharacterId: 'nilo',
      selectedKartId: 'trilha-raposa',
      selectedCupId: 'aurora',
      selectedTrackId: 'porto-das-lanternas',
      championship: null,
      lastRaceResult: null,
    });
  },
}));
