import { DEFAULT_LAPS } from '../core/constants';
import type { TrackLayoutDef, TrackPointQuery } from '../tracks/trackGeometry';

export type RacePhase = 'intro' | 'countdown' | 'racing' | 'finished';

export interface RacerRaceState {
  currentLap: number; // 1..totalLaps
  totalLaps: number;
  nextCheckpointIndex: number;
  highestCheckpointInLap: number;
  checkpointsVisitedThisLap: number;
  lapStartTimeMs: number;
  lapTimesMs: number[];
  totalRaceTimeMs: number;
  bestLapMs: number | null;
  finished: boolean;
  wrongWay: boolean;
  raceProgressScore: number;
  lastValidCheckpointIndex: number;
}

export function createInitialRacerState(totalLaps = DEFAULT_LAPS): RacerRaceState {
  return {
    currentLap: 1,
    totalLaps,
    nextCheckpointIndex: 1,
    highestCheckpointInLap: 0,
    checkpointsVisitedThisLap: 1,
    lapStartTimeMs: 0,
    lapTimesMs: [],
    totalRaceTimeMs: 0,
    bestLapMs: null,
    finished: false,
    wrongWay: false,
    raceProgressScore: 0,
    lastValidCheckpointIndex: 0,
  };
}

export class RaceProgressTracker {
  public readonly layout: TrackLayoutDef;
  public readonly totalLaps: number;
  public phase: RacePhase;
  public countdownRemainingSec: number;
  public raceElapsedMs = 0;

  constructor(layout: TrackLayoutDef, totalLaps = DEFAULT_LAPS, skipIntro = false) {
    this.layout = layout;
    this.totalLaps = totalLaps;
    this.phase = skipIntro ? 'countdown' : 'intro';
    this.countdownRemainingSec = 3.2;
  }

  public createRacerState(): RacerRaceState {
    return {
      currentLap: 1,
      totalLaps: this.totalLaps,
      nextCheckpointIndex: 1,
      highestCheckpointInLap: 0,
      checkpointsVisitedThisLap: 1,
      lapStartTimeMs: 0,
      lapTimesMs: [],
      totalRaceTimeMs: 0,
      bestLapMs: null,
      finished: false,
      wrongWay: false,
      raceProgressScore: 0,
      lastValidCheckpointIndex: 0,
    };
  }

  public startCountdown(): void {
    this.phase = 'countdown';
    this.countdownRemainingSec = 3.2;
    this.raceElapsedMs = 0;
  }

  public stepClock(dt: number): void {
    if (this.phase === 'countdown') {
      this.countdownRemainingSec -= dt;
      if (this.countdownRemainingSec <= 0) {
        this.countdownRemainingSec = 0;
        this.phase = 'racing';
      }
    } else if (this.phase === 'racing') {
      this.raceElapsedMs += dt * 1000;
    }
  }

  public updateRacerProgress(
    racer: RacerRaceState,
    x: number,
    z: number,
    yaw: number,
    trackQuery: TrackPointQuery,
  ): { lapCompleted: boolean; raceFinishedNow: boolean } {
    if (racer.finished || this.phase !== 'racing') {
      return { lapCompleted: false, raceFinishedNow: false };
    }

    racer.totalRaceTimeMs = this.raceElapsedMs;

    // Wrong-way check: dot product between kart heading (-sin(yaw), -cos(yaw)) and track tangent
    const hx = -Math.sin(yaw);
    const hz = -Math.cos(yaw);
    const dot =
      hx * trackQuery.nearestSample.tangent.x + hz * trackQuery.nearestSample.tangent.z;
    racer.wrongWay = dot < -0.35;

    const cpCount = this.layout.checkpoints.length;
    const expectedCp = this.layout.checkpoints[racer.nextCheckpointIndex];
    const distToExpected = Math.hypot(x - expectedCp.position.x, z - expectedCp.position.z);

    // Also allow advancing 1 checkpoint ahead in case a racer takes a wide/shortcut line
    const lookAheadIndex = (racer.nextCheckpointIndex + 1) % cpCount;
    const lookAheadCp = this.layout.checkpoints[lookAheadIndex];
    const distToLookAhead = Math.hypot(x - lookAheadCp.position.x, z - lookAheadCp.position.z);

    const triggerRadius = expectedCp.width * 0.72;
    let lapCompleted = false;
    let raceFinishedNow = false;

    if (distToExpected <= triggerRadius) {
      if (racer.nextCheckpointIndex === 0) {
        // Crossed start/finish line: verify anti-cut (at least 75% of lap checkpoints crossed)
        if (racer.checkpointsVisitedThisLap >= Math.ceil(cpCount * 0.75)) {
          lapCompleted = true;
        }
      } else {
        racer.lastValidCheckpointIndex = racer.nextCheckpointIndex;
        racer.highestCheckpointInLap = Math.max(
          racer.highestCheckpointInLap,
          racer.nextCheckpointIndex,
        );
        racer.checkpointsVisitedThisLap += 1;
        racer.nextCheckpointIndex = (racer.nextCheckpointIndex + 1) % cpCount;
      }
    } else if (
      racer.nextCheckpointIndex !== 0 &&
      lookAheadIndex !== 0 &&
      distToLookAhead <= triggerRadius
    ) {
      racer.lastValidCheckpointIndex = lookAheadIndex;
      racer.highestCheckpointInLap = Math.max(racer.highestCheckpointInLap, lookAheadIndex);
      racer.checkpointsVisitedThisLap += 2;
      racer.nextCheckpointIndex = (lookAheadIndex + 1) % cpCount;
    }

    if (lapCompleted) {
      const lapDuration = this.raceElapsedMs - racer.lapStartTimeMs;
      racer.lapTimesMs.push(lapDuration);
      racer.bestLapMs =
        racer.bestLapMs === null ? lapDuration : Math.min(racer.bestLapMs, lapDuration);
      racer.lapStartTimeMs = this.raceElapsedMs;
      racer.lastValidCheckpointIndex = 0;

      if (racer.currentLap >= racer.totalLaps) {
        racer.finished = true;
        this.phase = 'finished';
        raceFinishedNow = true;
      } else {
        racer.currentLap += 1;
        racer.nextCheckpointIndex = 1;
        racer.highestCheckpointInLap = 0;
        racer.checkpointsVisitedThisLap = 1;
      }
    }

    // Monotonic progress metric combining lap, checkpoints visited, and spline distance
    const rawSplineFrac = trackQuery.distanceAlongTrack / Math.max(1, this.layout.totalLength);
    // Treat pre-start grid (s > 0.8*L before checkpoint 1) as 0 progress on current lap
    const normalizedSplineFrac =
      racer.highestCheckpointInLap === 0 && rawSplineFrac > 0.75 ? 0 : rawSplineFrac;
    const lapFraction =
      racer.finished
        ? 1
        : (racer.highestCheckpointInLap / cpCount) * 0.5 + normalizedSplineFrac * 0.5;
    racer.raceProgressScore =
      (racer.finished ? racer.totalLaps + 1 : racer.currentLap - 1) +
      racer.highestCheckpointInLap * 0.05 +
      lapFraction * 0.5;

    return { lapCompleted, raceFinishedNow };
  }
}

export function formatRaceTimeMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = safe % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
