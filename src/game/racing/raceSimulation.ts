import { CHARACTERS } from '../../data/characters';
import { KARTS, getKartById } from '../../data/karts';
import { CHAMPIONSHIP_POINTS, DEFAULT_LAPS } from '../core/constants';
import type { CharacterId, Difficulty, ItemId, KartId, SurfaceType } from '../core/types';
import {
  type AiDriverState,
  computeAiKartInput,
  createAiDriverState,
} from '../ai/aiController';
import {
  type ItemRacerAdapter,
  ItemWorldManager,
  type RacerItemSlotState,
  createRacerItemState,
} from '../items/itemSystem';
import {
  type KartInputState,
  type KartPhysicsProfile,
  type KartSimState,
  computeKartPhysicsProfile,
  createInitialKartState,
  stepKartSimulation,
} from '../physics/kartController';
import {
  type RacePhase,
  RaceProgressTracker,
  type RacerRaceState,
} from '../racing/raceManager';
import { type TrackLayoutDef, projectPointOntoTrack } from '../tracks/trackGeometry';

export interface RacerEntityState {
  id: string;
  isPlayer: boolean;
  name: string;
  characterId: CharacterId;
  kartId: KartId;
  primaryColor: string;
  accentColor: string;
  profile: KartPhysicsProfile;
  sim: KartSimState;
  race: RacerRaceState;
  item: RacerItemSlotState;
  ai: AiDriverState | null;
  rank: number;
  finishTimeMs: number | null;
}

export interface StandingEntry {
  id: string;
  isPlayer: boolean;
  name: string;
  characterId: CharacterId;
  kartId: KartId;
  kartName: string;
  rank: number;
  currentLap: number;
  totalLaps: number;
  finished: boolean;
  finishTimeMs: number | null;
  points: number;
  primaryColor: string;
}

export interface RaceAudioEvents {
  countdownNumber: number | null;
  raceStartedNow: boolean;
  playerDriftTierUp: number | null;
  playerTurboTriggered: boolean;
  playerCollision: boolean;
  playerJumped: boolean;
  playerLanded: boolean;
  playerItemPickup: boolean;
  playerItemUsed: ItemId | null;
  playerLapCompleted: boolean;
  playerFinishedNow: boolean;
}

export interface FullHudSnapshot {
  speedKmh: number;
  surface: SurfaceType;
  driftActive: boolean;
  driftTier: 0 | 1 | 2 | 3;
  driftChargeProgress: number;
  boostActive: boolean;
  boostLabel: string | null;
  currentLap: number;
  totalLaps: number;
  raceTimeMs: number;
  lapTimesMs: number[];
  bestLapMs: number | null;
  wrongWay: boolean;
  finished: boolean;
  recovering: boolean;
  onShortcut: boolean;
  rank: number;
  totalRacers: number;
  heldItem: ItemId | null;
  rouletteActive: boolean;
  rouletteDisplayItem: ItemId | null;
  shieldActive: boolean;
  hitActive: boolean;
  standings: StandingEntry[];
  minimapRacers: Array<{
    id: string;
    x: number;
    z: number;
    yaw: number;
    isPlayer: boolean;
    color: string;
  }>;
}

const KART_RADIUS = 1.05;

export function computeStandings(
  racers: readonly RacerEntityState[],
  layout: TrackLayoutDef,
): StandingEntry[] {
  const cpCount = layout.checkpoints.length;

  const sorted = [...racers].sort((a, b) => {
    if (a.race.finished && b.race.finished) {
      return (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0);
    }
    if (a.race.finished !== b.race.finished) {
      return a.race.finished ? -1 : 1;
    }

    if (a.race.currentLap !== b.race.currentLap) {
      return b.race.currentLap - a.race.currentLap;
    }

    if (a.race.highestCheckpointInLap !== b.race.highestCheckpointInLap) {
      return b.race.highestCheckpointInLap - a.race.highestCheckpointInLap;
    }

    // Compare spline progress within current checkpoint sector
    const normA =
      a.race.highestCheckpointInLap === 0 && a.sim.distanceAlongTrack > layout.totalLength * 0.75
        ? a.sim.distanceAlongTrack - layout.totalLength
        : a.sim.distanceAlongTrack;
    const normB =
      b.race.highestCheckpointInLap === 0 && b.sim.distanceAlongTrack > layout.totalLength * 0.75
        ? b.sim.distanceAlongTrack - layout.totalLength
        : b.sim.distanceAlongTrack;

    if (Math.abs(normA - normB) > 0.25) {
      return normB - normA;
    }

    // Tiebreaker: closest to next valid checkpoint
    const nextCpA = layout.checkpoints[a.race.nextCheckpointIndex % cpCount];
    const nextCpB = layout.checkpoints[b.race.nextCheckpointIndex % cpCount];
    const distA = Math.hypot(a.sim.x - nextCpA.position.x, a.sim.z - nextCpA.position.z);
    const distB = Math.hypot(b.sim.x - nextCpB.position.x, b.sim.z - nextCpB.position.z);
    return distA - distB;
  });

  return sorted.map((racer, idx) => {
    const rank = idx + 1;
    racer.rank = rank;
    return {
      id: racer.id,
      isPlayer: racer.isPlayer,
      name: racer.name,
      characterId: racer.characterId,
      kartId: racer.kartId,
      kartName: getKartById(racer.kartId).name,
      rank,
      currentLap: racer.race.currentLap,
      totalLaps: racer.race.totalLaps,
      finished: racer.race.finished,
      finishTimeMs: racer.finishTimeMs,
      points: CHAMPIONSHIP_POINTS[idx] ?? 1,
      primaryColor: racer.primaryColor,
    };
  });
}

export class RaceSimulation {
  public readonly layout: TrackLayoutDef;
  public readonly difficulty: Difficulty;
  public readonly tracker: RaceProgressTracker;
  public readonly items: ItemWorldManager;
  public readonly racers: RacerEntityState[];
  public readonly playerId = 'racer-player';
  private lastCountdownBeep = 4;

  constructor(
    layout: TrackLayoutDef,
    playerCharacterId: CharacterId,
    playerKartId: KartId,
    difficulty: Difficulty,
    totalLaps = DEFAULT_LAPS,
    skipIntro = false,
  ) {
    this.layout = layout;
    this.difficulty = difficulty;
    this.tracker = new RaceProgressTracker(layout, totalLaps, skipIntro);
    this.items = new ItemWorldManager(layout);

    const playerChar = CHARACTERS.find((c) => c.id === playerCharacterId) ?? CHARACTERS[0];
    const playerKart = KARTS.find((k) => k.id === playerKartId) ?? KARTS[0];
    const otherChars = CHARACTERS.filter((c) => c.id !== playerChar.id);

    const roster: Array<{
      id: string;
      isPlayer: boolean;
      char: (typeof CHARACTERS)[number];
      kart: (typeof KARTS)[number];
      slotIdx: number;
    }> = [
      {
        id: this.playerId,
        isPlayer: true,
        char: playerChar,
        kart: playerKart,
        slotIdx: 0,
      },
      ...otherChars.slice(0, 7).map((aiChar, idx) => ({
        id: `racer-ai-${idx + 1}`,
        isPlayer: false,
        char: aiChar,
        kart: getKartById(aiChar.defaultKartId),
        slotIdx: idx + 1,
      })),
    ];

    this.racers = roster.map((entry) => {
      const slot = layout.startGridSlots[entry.slotIdx];
      return {
        id: entry.id,
        isPlayer: entry.isPlayer,
        name: entry.char.name,
        characterId: entry.char.id,
        kartId: entry.kart.id,
        primaryColor: entry.char.primaryColor,
        accentColor: entry.char.accentColor,
        profile: computeKartPhysicsProfile(entry.kart, entry.char),
        sim: createInitialKartState(slot.position.x, slot.position.y, slot.position.z, slot.yaw),
        race: this.tracker.createRacerState(),
        item: createRacerItemState(),
        ai: entry.isPlayer ? null : createAiDriverState(entry.slotIdx),
        rank: entry.slotIdx + 1,
        finishTimeMs: null,
      };
    });

    computeStandings(this.racers, this.layout);
  }

  public get player(): RacerEntityState {
    return this.racers[0];
  }

  public get phase(): RacePhase {
    return this.tracker.phase;
  }

  public startCountdown(): void {
    this.tracker.startCountdown();
    this.lastCountdownBeep = 4;
  }

  public step(dt: number, playerInput: KartInputState): RaceAudioEvents {
    const audioEvents: RaceAudioEvents = {
      countdownNumber: null,
      raceStartedNow: false,
      playerDriftTierUp: null,
      playerTurboTriggered: false,
      playerCollision: false,
      playerJumped: false,
      playerLanded: false,
      playerItemPickup: false,
      playerItemUsed: null,
      playerLapCompleted: false,
      playerFinishedNow: false,
    };

    const prevPhase = this.tracker.phase;
    this.tracker.stepClock(dt);

    if (this.tracker.phase === 'countdown') {
      const ceilSec = Math.ceil(this.tracker.countdownRemainingSec);
      if (ceilSec >= 1 && ceilSec <= 3 && ceilSec < this.lastCountdownBeep) {
        this.lastCountdownBeep = ceilSec;
        audioEvents.countdownNumber = ceilSec;
      }
    } else if (prevPhase === 'countdown' && this.tracker.phase === 'racing') {
      audioEvents.raceStartedNow = true;
    }

    const canDrive = this.tracker.phase === 'racing';
    const playerPrevDriftTier = this.player.sim.driftTier;
    const playerPrevTurbos = this.player.sim.totalTurbosTriggered;
    const playerPrevGrounded = this.player.sim.grounded;

    const itemAdapters: ItemRacerAdapter[] = this.racers.map((r) => ({
      id: r.id,
      rank: r.rank,
      sim: r.sim,
      itemState: r.item,
    }));

    // 1. Step every kart through the exact same arcade physics simulation
    for (let i = 0; i < this.racers.length; i += 1) {
      const racer = this.racers[i];
      const trackQuery = projectPointOntoTrack(
        this.layout,
        racer.sim.x,
        racer.sim.z,
        racer.sim.y,
      );

      let input: KartInputState;
      if (racer.isPlayer) {
        input = racer.race.finished
          ? { throttle: 0.45, brake: 0, steer: 0, drift: false, useItem: false, recover: false }
          : playerInput;
      } else {
        input = computeAiKartInput(racer.ai!, {
          layout: this.layout,
          difficulty: this.difficulty,
          selfId: racer.id,
          selfSim: racer.sim,
          selfTrackQuery: trackQuery,
          selfItem: racer.item,
          selfRank: racer.rank,
          otherKarts: this.racers,
          hazards: this.items.hazards,
          incomingProjectiles: this.items.projectiles,
          dt,
        });
      }

      if (canDrive && input.useItem) {
        const adapter = itemAdapters[i];
        const fakeEvents = {
          pickedUpByPlayer: false,
          usedByPlayer: null as ItemId | null,
          playerHit: false,
          playerShieldBlocked: false,
        };
        if (this.items.activateItem(adapter, itemAdapters, this.playerId, fakeEvents)) {
          if (fakeEvents.usedByPlayer) audioEvents.playerItemUsed = fakeEvents.usedByPlayer;
          if (fakeEvents.playerHit) audioEvents.playerCollision = true;
        }
      }

      racer.sim.lastSafeCheckpointIndex = racer.race.lastValidCheckpointIndex;

      stepKartSimulation(
        racer.sim,
        input,
        trackQuery,
        racer.profile,
        this.layout,
        dt,
        canDrive,
      );

      if (racer.item.hazardSlowTimer > 0 && racer.sim.boostTimer <= 0) {
        racer.sim.forwardSpeed = Math.min(racer.sim.forwardSpeed, racer.profile.topSpeedMs * 0.56);
      }

      if (canDrive) {
        const updated = this.tracker.updateRacerProgress(
          racer.race,
          racer.sim.x,
          racer.sim.z,
          racer.sim.yaw,
          trackQuery,
        );
        if (racer.race.finished && racer.finishTimeMs === null) {
          racer.finishTimeMs = this.tracker.raceElapsedMs;
        }
        if (racer.isPlayer) {
          if (updated.lapCompleted && !updated.raceFinishedNow) {
            audioEvents.playerLapCompleted = true;
          }
          if (updated.raceFinishedNow) {
            audioEvents.playerFinishedNow = true;
          }
        }
      }
    }

    // Keep race phase in finished once human player finishes (remaining AI finish times simulated/estimated)
    if (this.player.race.finished) {
      this.tracker.phase = 'finished';
    }

    // 2. Resolve kart-to-kart physical collisions (mass-weighted impulse separation)
    for (let i = 0; i < this.racers.length; i += 1) {
      for (let j = i + 1; j < this.racers.length; j += 1) {
        const a = this.racers[i];
        const b = this.racers[j];
        if (Math.abs(a.sim.y - b.sim.y) > 1.8) continue;

        const dx = b.sim.x - a.sim.x;
        const dz = b.sim.z - a.sim.z;
        const dist = Math.hypot(dx, dz);
        const minDist = KART_RADIUS * 2;
        if (dist < minDist && dist > 1e-4) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const totalMass = a.profile.massKg + b.profile.massKg;
          const shareA = b.profile.massKg / totalMass;
          const shareB = a.profile.massKg / totalMass;

          a.sim.x -= nx * overlap * shareA;
          a.sim.z -= nz * overlap * shareA;
          b.sim.x += nx * overlap * shareB;
          b.sim.z += nz * overlap * shareB;

          const bounce = 5.5;
          a.sim.vx -= nx * bounce * shareA;
          a.sim.vz -= nz * bounce * shareA;
          b.sim.vx += nx * bounce * shareB;
          b.sim.vz += nz * bounce * shareB;

          if (overlap > 0.14) {
            if (a.isPlayer || b.isPlayer) {
              audioEvents.playerCollision = true;
            }
            if (a.item.shieldTimer <= 0 && shareA > 0.52) {
              a.sim.forwardSpeed *= 0.94;
            }
            if (b.item.shieldTimer <= 0 && shareB > 0.52) {
              b.sim.forwardSpeed *= 0.94;
            }
          }
        }
      }
    }

    // 3. Step world item boxes, hazards & projectiles
    if (canDrive) {
      const itemEvents = this.items.step(dt, itemAdapters, this.playerId);
      if (itemEvents.pickedUpByPlayer) audioEvents.playerItemPickup = true;
      if (itemEvents.playerHit) audioEvents.playerCollision = true;
    }

    // 4. Recompute 1st..8th standings
    computeStandings(this.racers, this.layout);

    // 5. Player audio transition cues
    if (this.player.sim.driftTier > playerPrevDriftTier && this.player.sim.driftTier > 0) {
      audioEvents.playerDriftTierUp = this.player.sim.driftTier;
    }
    if (this.player.sim.totalTurbosTriggered > playerPrevTurbos) {
      audioEvents.playerTurboTriggered = true;
    }
    if (playerPrevGrounded && !this.player.sim.grounded && this.player.sim.vy > 3) {
      audioEvents.playerJumped = true;
    }
    if (!playerPrevGrounded && this.player.sim.grounded) {
      audioEvents.playerLanded = true;
    }

    return audioEvents;
  }

  public buildHudSnapshot(): FullHudSnapshot {
    const p = this.player;
    const standings = computeStandings(this.racers, this.layout);

    return {
      speedKmh: Math.round(Math.abs(p.sim.forwardSpeed) * 3.6),
      surface: p.sim.surface,
      driftActive: p.sim.driftActive,
      driftTier: p.sim.driftTier,
      driftChargeProgress: Math.min(1, p.sim.driftChargeSeconds / 2.45),
      boostActive: p.sim.boostTimer > 0,
      boostLabel: p.sim.boostLabel,
      currentLap: p.race.currentLap,
      totalLaps: p.race.totalLaps,
      raceTimeMs: p.race.totalRaceTimeMs,
      lapTimesMs: [...p.race.lapTimesMs],
      bestLapMs: p.race.bestLapMs,
      wrongWay: p.race.wrongWay,
      finished: p.race.finished,
      recovering: p.sim.recoverTimer > 0,
      onShortcut: p.sim.onShortcut,
      rank: p.rank,
      totalRacers: this.racers.length,
      heldItem: p.item.heldItem,
      rouletteActive: p.item.rouletteTimer > 0,
      rouletteDisplayItem: p.item.rouletteDisplayItem,
      shieldActive: p.item.shieldTimer > 0,
      hitActive: p.sim.hitTimer > 0,
      standings,
      minimapRacers: this.racers.map((r) => ({
        id: r.id,
        x: r.sim.x,
        z: r.sim.z,
        yaw: r.sim.yaw,
        isPlayer: r.isPlayer,
        color: r.primaryColor,
      })),
    };
  }
}
