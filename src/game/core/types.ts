export type SurfaceType = 'asphalt' | 'dirt' | 'grass' | 'sand' | 'ice';

export type GameMode = 'quick-race' | 'championship' | 'time-trial' | 'practice';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type QualityLevel = 'low' | 'medium' | 'high';

export type CupId = 'aurora' | 'eclipse';

export type ScreenId =
  | 'loading'
  | 'main-menu'
  | 'character-select'
  | 'kart-select'
  | 'mode-select'
  | 'cup-select'
  | 'track-select'
  | 'difficulty-select'
  | 'race'
  | 'pause'
  | 'settings'
  | 'results'
  | 'podium'
  | 'progression';

export type CharacterId =
  | 'nilo'
  | 'boro'
  | 'lumi'
  | 'kora'
  | 'tiko'
  | 'mavi'
  | 'runi'
  | 'zera';

export type CharacterAnimState =
  | 'idle'
  | 'drive'
  | 'turnLeft'
  | 'turnRight'
  | 'drift'
  | 'hit'
  | 'victory'
  | 'defeat'
  | 'podium';

export type KartId =
  | 'trilha-raposa'
  | 'engrenagem-turbo'
  | 'cometa-estelar'
  | 'raiz-veloz'
  | 'chave-mestra-gt'
  | 'brisa-corsaria'
  | 'escorpiao-dourado'
  | 'lamina-glacial';

export type TrackId =
  | 'porto-das-lanternas'
  | 'bosque-de-cristal'
  | 'vale-dos-moinhos'
  | 'canion-solar'
  | 'cidade-neon'
  | 'pico-boreal'
  | 'jardim-celeste'
  | 'fortaleza-tempestade';

export type ItemId =
  | 'pulso-solar'
  | 'bolha-guardia'
  | 'nevoa-prisma'
  | 'faisca-rastreadora'
  | 'onda-de-vento'
  | 'cristal-de-salto';

export interface KartAttributes {
  topSpeed: number;
  acceleration: number;
  braking: number;
  handling: number;
  grip: number;
  mass: number;
  driftEfficiency: number;
  recovery: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  speciesOrArchetype: string;
  bio: string;
  primaryColor: string;
  accentColor: string;
  defaultKartId: KartId;
  statBonuses: Partial<KartAttributes>;
  unlockedByDefault: boolean;
  unlockRequirementLabel: string;
  modelAssetId: string;
  portraitAssetId: string;
  iconAssetId: string;
}

export interface KartDef {
  id: KartId;
  name: string;
  archetype: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  trimColor: string;
  attributes: KartAttributes;
  unlockedByDefault: boolean;
  unlockRequirementLabel: string;
  modelAssetId: string;
}

export interface CupDef {
  id: CupId;
  name: string;
  subtitle: string;
  accentColor: string;
  trackIds: readonly TrackId[];
  unlockedByDefault: boolean;
  unlockRequirementLabel: string;
}

export interface TrackDef {
  id: TrackId;
  name: string;
  cupId: CupId;
  cupOrder: number;
  theme: string;
  description: string;
  dominantSurface: SurfaceType;
  availableSurfaces: readonly SurfaceType[];
  laps: number;
  difficultyRating: number;
  skyTopColor: string;
  skyHorizonColor: string;
  ambientLightColor: string;
  unlockedByDefault: boolean;
  unlockRequirementLabel: string;
  modelAssetId: string;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  category: 'boost' | 'defense' | 'trap' | 'projectile' | 'disrupt' | 'utility';
  durationSeconds: number;
  cooldownSeconds: number;
  /** Drop weights indexed from rank 1 (index 0) to rank 8 (index 7). */
  positionWeights: readonly [number, number, number, number, number, number, number, number];
  accentColor: string;
  iconAssetId: string;
  modelAssetId: string;
}

export type AssetType =
  | 'character'
  | 'kart'
  | 'track'
  | 'prop'
  | 'item'
  | 'texture'
  | 'animation'
  | 'vfx'
  | 'ui'
  | 'audio-music'
  | 'audio-sfx'
  | 'font';

export type AssetFormat = 'glb' | 'gltf' | 'png' | 'webp' | 'ktx2' | 'ogg' | 'mp3' | 'wav' | 'json';

export type AssetValidationStatus = 'validated' | 'pending' | 'failed';

export interface AssetManifestEntry {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  format: AssetFormat;
  origin: string;
  author: string;
  license: string;
  sizeBytes: number;
  validationStatus: AssetValidationStatus;
  usedIn: string[];
  requiredAnimations?: string[];
  requiredNodes?: string[];
}

export interface AssetManifest {
  version: number;
  generatedAt: string;
  project: string;
  assets: AssetManifestEntry[];
}

export interface ControlBindings {
  accelerate: string[];
  brake: string[];
  steerLeft: string[];
  steerRight: string[];
  drift: string[];
  useItem: string[];
  pause: string[];
  recover: string[];
}

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  muted: boolean;
}

export type TouchControlsMode = 'auto' | 'on' | 'off';

export interface TouchSettings {
  mode: TouchControlsMode;
  autoAccelerate: boolean;
}

export interface GameSettings {
  quality: QualityLevel;
  steeringSensitivity: number;
  gamepadDeadzone: number;
  audio: AudioSettings;
  bindings: ControlBindings;
  touch: TouchSettings;
}

export interface SaveDataV1 {
  version: 1;
  updatedAt: string;
  unlockedCharacters: CharacterId[];
  unlockedKarts: KartId[];
  unlockedTracks: TrackId[];
  cupTrophies: Partial<Record<CupId, 'gold' | 'silver' | 'bronze'>>;
  bestLapTimesMs: Partial<Record<TrackId, number>>;
  bestRaceTimesMs: Partial<Record<TrackId, number>>;
  stats: {
    racesCompleted: number;
    racesWon: number;
    championshipsWon: number;
    totalDriftsCompleted: number;
    totalTurbosTriggered: number;
    totalItemsUsed: number;
  };
  settings: GameSettings;
}

export interface LiveKartPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  visualSlipYaw: number;
  forwardSpeed: number;
  boostActive: boolean;
  driftActive: boolean;
  steerAngle: number;
  groundHeight: number;
}
