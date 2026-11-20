import { getRecommendedInitialQuality } from './mobile';
import type {
  ControlBindings,
  Difficulty,
  GameSettings,
  SaveDataV1,
  SurfaceType,
} from './types';

export const FIXED_TIMESTEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.1;
export const TOTAL_RACERS = 8;
export const DEFAULT_LAPS = 3;

export interface SurfacePhysicsConfig {
  grip: number;
  drag: number;
  maxSpeedMultiplier: number;
  driftChargeMultiplier: number;
  label: string;
}

export const SURFACE_PROPERTIES: Record<SurfaceType, SurfacePhysicsConfig> = {
  asphalt: {
    grip: 1.0,
    drag: 0.018,
    maxSpeedMultiplier: 1.0,
    driftChargeMultiplier: 1.0,
    label: 'Asfalto',
  },
  dirt: {
    grip: 0.82,
    drag: 0.032,
    maxSpeedMultiplier: 0.92,
    driftChargeMultiplier: 1.08,
    label: 'Terra',
  },
  grass: {
    grip: 0.68,
    drag: 0.065,
    maxSpeedMultiplier: 0.72,
    driftChargeMultiplier: 0.7,
    label: 'Grama',
  },
  sand: {
    grip: 0.72,
    drag: 0.078,
    maxSpeedMultiplier: 0.76,
    driftChargeMultiplier: 0.85,
    label: 'Areia',
  },
  ice: {
    grip: 0.42,
    drag: 0.012,
    maxSpeedMultiplier: 0.96,
    driftChargeMultiplier: 1.18,
    label: 'Gelo',
  },
};

export interface DriftTierConfig {
  level: 1 | 2 | 3;
  label: string;
  chargeThresholdSeconds: number;
  boostDurationSeconds: number;
  speedBonusMultiplier: number;
  sparkColor: string;
}

export const DRIFT_TIERS: readonly [DriftTierConfig, DriftTierConfig, DriftTierConfig] = [
  {
    level: 1,
    label: 'Miniturbo Nível 1',
    chargeThresholdSeconds: 0.75,
    boostDurationSeconds: 0.85,
    speedBonusMultiplier: 1.16,
    sparkColor: '#38bdf8',
  },
  {
    level: 2,
    label: 'Miniturbo Nível 2',
    chargeThresholdSeconds: 1.55,
    boostDurationSeconds: 1.35,
    speedBonusMultiplier: 1.24,
    sparkColor: '#ff9f1c',
  },
  {
    level: 3,
    label: 'Miniturbo Nível 3',
    chargeThresholdSeconds: 2.45,
    boostDurationSeconds: 1.95,
    speedBonusMultiplier: 1.34,
    sparkColor: '#e879f9',
  },
];

export const CHAMPIONSHIP_POINTS: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] = [15, 12, 10, 8, 6, 4, 2, 1];

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    label: string;
    description: string;
    aiSpeedFactor: number;
    aiLinePrecision: number;
    aiDriftSkill: number;
    aiItemAggression: number;
  }
> = {
  easy: {
    label: 'Fácil',
    description: 'Adversários mais tolerantes, ideais para aprender curvas e drifts.',
    aiSpeedFactor: 0.84,
    aiLinePrecision: 0.72,
    aiDriftSkill: 0.45,
    aiItemAggression: 0.5,
  },
  normal: {
    label: 'Normal',
    description: 'Disputa equilibrada com ultrapassagens e uso tático de itens.',
    aiSpeedFactor: 0.94,
    aiLinePrecision: 0.88,
    aiDriftSkill: 0.78,
    aiItemAggression: 0.8,
  },
  hard: {
    label: 'Difícil',
    description: 'Pilotos competitivos explorando atalhos, drifts de nível alto e defesa.',
    aiSpeedFactor: 1.0,
    aiLinePrecision: 0.97,
    aiDriftSkill: 0.95,
    aiItemAggression: 0.96,
  },
};

export const ALLOWED_ASSET_LICENSES = [
  'Original-Project-License',
  'CC0-1.0',
  'MIT',
  'CC-BY-4.0',
] as const;

export const DEFAULT_BINDINGS: ControlBindings = {
  accelerate: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  drift: ['Space'],
  useItem: ['ShiftLeft', 'ShiftRight'],
  pause: ['Escape'],
  recover: ['KeyR'],
};

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  steeringSensitivity: 1.0,
  gamepadDeadzone: 0.14,
  audio: {
    musicVolume: 0.75,
    sfxVolume: 0.85,
    ambientVolume: 0.65,
    muted: false,
  },
  bindings: DEFAULT_BINDINGS,
  touch: {
    mode: 'auto',
    autoAccelerate: true,
  },
};

export function createInitialSaveData(options?: { isMobile?: boolean }): SaveDataV1 {
  const settings = structuredClone(DEFAULT_SETTINGS);
  if (options?.isMobile !== undefined) {
    settings.quality = getRecommendedInitialQuality(options.isMobile);
  }
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    unlockedCharacters: ['nilo', 'boro', 'lumi', 'kora'],
    unlockedKarts: ['trilha-raposa', 'engrenagem-turbo', 'cometa-estelar', 'raiz-veloz'],
    unlockedTracks: [
      'porto-das-lanternas',
      'bosque-de-cristal',
      'vale-dos-moinhos',
      'canion-solar',
    ],
    cupTrophies: {},
    bestLapTimesMs: {},
    bestRaceTimesMs: {},
    stats: {
      racesCompleted: 0,
      racesWon: 0,
      championshipsWon: 0,
      totalDriftsCompleted: 0,
      totalTurbosTriggered: 0,
      totalItemsUsed: 0,
    },
    settings,
  };
}

/**
 * Deterministic fixed-timestep accumulator used to decouple physics simulation
 * from display refresh rate (30Hz, 60Hz, 120Hz, 144Hz).
 */
export class FixedStepClock {
  private accumulator = 0;
  private totalSteps = 0;
  public readonly fixedDt: number;
  public readonly maxFrameDelta: number;

  constructor(fixedDt = FIXED_TIMESTEP, maxFrameDelta = MAX_FRAME_DELTA) {
    this.fixedDt = fixedDt;
    this.maxFrameDelta = maxFrameDelta;
  }

  public advance(frameDeltaSeconds: number, onStep: (dt: number, stepIndex: number) => void): number {
    const safeDelta = Math.max(0, Math.min(frameDeltaSeconds, this.maxFrameDelta));
    this.accumulator += safeDelta;
    let stepsExecuted = 0;

    while (this.accumulator + 1e-9 >= this.fixedDt) {
      this.totalSteps += 1;
      stepsExecuted += 1;
      onStep(this.fixedDt, this.totalSteps);
      this.accumulator = Math.max(0, this.accumulator - this.fixedDt);
    }

    return stepsExecuted;
  }

  public get alpha(): number {
    return this.accumulator / this.fixedDt;
  }

  public get stepCount(): number {
    return this.totalSteps;
  }

  public reset(): void {
    this.accumulator = 0;
    this.totalSteps = 0;
  }
}
