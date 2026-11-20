import { create } from 'zustand';
import { DEFAULT_SETTINGS, createInitialSaveData } from '../game/core/constants';
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

export interface GameStoreState {
  screen: ScreenId;
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

  setScreen: (screen: ScreenId) => void;
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
}

export const useGameStore = create<GameStoreState>((set) => ({
  screen: 'loading',
  mode: 'quick-race',
  difficulty: 'normal',
  selectedCharacterId: 'nilo',
  selectedKartId: 'trilha-raposa',
  selectedCupId: 'aurora',
  selectedTrackId: 'porto-das-lanternas',
  manifest: null,
  manifestError: null,
  physicsStepsObserved: 0,
  settings: structuredClone(DEFAULT_SETTINGS),
  saveData: createInitialSaveData(),

  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
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
    set((state) => ({
      settings: {
        ...state.settings,
        ...partial,
      },
    })),
}));
