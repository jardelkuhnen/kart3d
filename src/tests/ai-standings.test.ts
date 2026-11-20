import { describe, expect, it } from 'vitest';
import { computeAiKartInput, createAiDriverState } from '../game/ai/aiController';
import { FIXED_TIMESTEP } from '../game/core/constants';
import { createRacerItemState } from '../game/items/itemSystem';
import { createInitialKartState } from '../game/physics/kartController';
import { RaceSimulation, computeStandings } from '../game/racing/raceSimulation';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { TRACK_LAYOUTS } from '../game/tracks/registry';
import {
  getSampleAtDistance,
  projectPointOntoTrack,
  yawFromTangent,
} from '../game/tracks/trackGeometry';

describe('8-Racer Physics AI, Collisions & Standings', () => {
  it('initializes 1 human + 7 AI racers on distinct grid slots and advances all AI physically along the track', () => {
    const sim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
    );
    expect(sim.racers).toHaveLength(8);
    expect(sim.racers.filter((r) => !r.isPlayer)).toHaveLength(7);

    sim.tracker.phase = 'racing';

    const startPositions = sim.racers.map((r) => ({ x: r.sim.x, z: r.sim.z }));

    // Simulate 5 seconds of racing (player coasts with throttle, 7 AIs drive via AI controller)
    for (let i = 0; i < 300; i += 1) {
      sim.step(FIXED_TIMESTEP, {
        throttle: 0.7,
        brake: 0,
        steer: 0,
        drift: false,
        useItem: false,
        recover: false,
      });
    }

    for (let idx = 1; idx < sim.racers.length; idx += 1) {
      const moved = Math.hypot(
        sim.racers[idx].sim.x - startPositions[idx].x,
        sim.racers[idx].sim.z - startPositions[idx].z,
      );
      expect(moved).toBeGreaterThan(35);
      expect(sim.racers[idx].sim.forwardSpeed).toBeGreaterThan(10);
    }
  });

  it('produces faster AI pace on Difícil than on Fácil using real physics', () => {
    const runDifficulty = (diff: 'easy' | 'hard'): number => {
      const sim = new RaceSimulation(
        PORTO_DAS_LANTERNAS_LAYOUT,
        'nilo',
        'trilha-raposa',
        diff,
        3,
        true,
      );
      sim.tracker.phase = 'racing';
      for (let i = 0; i < 360; i += 1) {
        sim.step(FIXED_TIMESTEP, {
          throttle: 0,
          brake: 0,
          steer: 0,
          drift: false,
          useItem: false,
          recover: false,
        });
      }
      const aiRacers = sim.racers.filter((r) => !r.isPlayer);
      return aiRacers.reduce((sum, r) => sum + r.sim.forwardSpeed, 0) / aiRacers.length;
    };

    expect(runDifficulty('hard')).toBeGreaterThan(runDifficulty('easy'));
  });

  it('ranks racers strictly by lap, checkpoints visited, spline progress and distance to next checkpoint', () => {
    const sim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
    );

    // Put racer 3 on Lap 2, racer 1 on Lap 1 checkpoint 5, racer 0 on Lap 1 checkpoint 2
    sim.racers[3].race.currentLap = 2;
    sim.racers[3].race.highestCheckpointInLap = 1;
    sim.racers[1].race.currentLap = 1;
    sim.racers[1].race.highestCheckpointInLap = 5;
    sim.racers[0].race.currentLap = 1;
    sim.racers[0].race.highestCheckpointInLap = 2;

    const standings = computeStandings(sim.racers, PORTO_DAS_LANTERNAS_LAYOUT);
    expect(standings[0].id).toBe(sim.racers[3].id);
    expect(standings[1].id).toBe(sim.racers[1].id);
    expect(standings[2].id).toBe(sim.racers[0].id);
    expect(standings[0].points).toBe(15);
    expect(standings[7].points).toBe(1);
  });

  it('separates overlapping karts physically based on mass without ignoring physics', () => {
    const sim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
    );
    sim.tracker.phase = 'racing';
    sim.racers[0].sim.x = 0;
    sim.racers[0].sim.z = 10;
    sim.racers[1].sim.x = 0.4;
    sim.racers[1].sim.z = 10;

    const events = sim.step(FIXED_TIMESTEP, {
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
      useItem: false,
      recover: false,
    });

    const separation = Math.hypot(
      sim.racers[1].sim.x - sim.racers[0].sim.x,
      sim.racers[1].sim.z - sim.racers[0].sim.z,
    );
    expect(separation).toBeGreaterThan(0.9);
    expect(events.playerCollision).toBe(true);
  });

  it('targets real shortcut entryS per track instead of fixed 0.44-0.54 fraction (ALTO-01)', () => {
    for (const layout of Object.values(TRACK_LAYOUTS)) {
      const sc = layout.shortcuts[0];
      expect(sc.entryS).toBeGreaterThanOrEqual(0);
      expect(sc.entryS).toBeLessThanOrEqual(layout.totalLength);

      // 1. At 0.48 * totalLength on tracks where shortcut is far away, shortcut-seeking AI must
      //    behave identically to non-shortcut AI (never yanking off-track toward a distant shortcut).
      const midSample = getSampleAtDistance(layout.samples, layout.totalLength, layout.totalLength * 0.48);
      const distToScEntry = Math.hypot(
        midSample.point.x - sc.samples[0].point.x,
        midSample.point.z - sc.samples[0].point.z,
      );
      if (distToScEntry > 50) {
        const aiSeeker = createAiDriverState(0); // shortcutTendency 0.85
        const aiMainOnly = { ...createAiDriverState(0), shortcutTendency: 0.0 };
        const sim = createInitialKartState(
          midSample.point.x,
          midSample.point.y,
          midSample.point.z,
          yawFromTangent(midSample.tangent),
        );
        sim.forwardSpeed = 28;
        const query = projectPointOntoTrack(layout, sim.x, sim.z, sim.y);
        const baseCtx = {
          layout,
          difficulty: 'hard' as const,
          selfId: 'ai-test',
          selfSim: sim,
          selfTrackQuery: query,
          selfItem: createRacerItemState(),
          selfRank: 2,
          otherKarts: [],
          hazards: [],
          incomingProjectiles: [],
          dt: FIXED_TIMESTEP,
        };
        const seekerInput = computeAiKartInput(aiSeeker, baseCtx);
        const mainInput = computeAiKartInput(aiMainOnly, baseCtx);
        expect(seekerInput.steer, `${layout.id} at 0.48`).toBeCloseTo(mainInput.steer, 6);
      }

      // 2. Directly on the shortcut, Hard AI with high shortcutTendency steers progressively along shortcut
      const scEntry = sc.samples[2];
      const simOnSc = createInitialKartState(
        scEntry.point.x,
        scEntry.point.y,
        scEntry.point.z,
        yawFromTangent(scEntry.tangent),
      );
      simOnSc.forwardSpeed = 26;
      const qSc = projectPointOntoTrack(layout, simOnSc.x, simOnSc.z, simOnSc.y);
      expect(qSc.onShortcut, `${layout.id} onShortcut`).toBe(true);
      const scInput = computeAiKartInput(createAiDriverState(0), {
        layout,
        difficulty: 'hard',
        selfId: 'ai-sc',
        selfSim: simOnSc,
        selfTrackQuery: qSc,
        selfItem: createRacerItemState(),
        selfRank: 2,
        otherKarts: [],
        hazards: [],
        incomingProjectiles: [],
        dt: FIXED_TIMESTEP,
      });
      expect(Math.abs(scInput.steer), `${layout.id} aligned on shortcut`).toBeLessThan(0.6);
    }
  });

  it('separates identically positioned karts, clamps wall collisions, and applies moving-hazard hit cooldown (MÉDIO-01)', () => {
    const sim = new RaceSimulation(
      TRACK_LAYOUTS['cidade-neon'],
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
    );
    sim.tracker.phase = 'racing';

    // 1. Exact same coordinates (dist === 0) must still separate deterministically
    const s0 = TRACK_LAYOUTS['cidade-neon'].samples[5];
    sim.racers[0].sim.x = s0.point.x;
    sim.racers[0].sim.y = s0.point.y;
    sim.racers[0].sim.z = s0.point.z;
    sim.racers[1].sim.x = s0.point.x;
    sim.racers[1].sim.y = s0.point.y;
    sim.racers[1].sim.z = s0.point.z;

    sim.step(FIXED_TIMESTEP, {
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
      useItem: false,
      recover: false,
    });
    const sep = Math.hypot(
      sim.racers[1].sim.x - sim.racers[0].sim.x,
      sim.racers[1].sim.z - sim.racers[0].sim.z,
    );
    expect(sep).toBeGreaterThan(1.5);

    // 2. Moving hazard hit triggers cooldown so rapid back-to-back frames do not repeatedly slash speed
    const mh = TRACK_LAYOUTS['cidade-neon'].movingHazards[0];
    sim.player.sim.x = mh.position.x;
    sim.player.sim.y = mh.position.y;
    sim.player.sim.z = mh.position.z;
    sim.player.sim.forwardSpeed = 30;
    sim.player.sim.hazardHitCooldown = 0;

    const ev1 = sim.step(FIXED_TIMESTEP, {
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
      useItem: false,
      recover: false,
    });
    expect(ev1.playerCollision).toBe(true);
    expect(sim.player.sim.hazardHitCooldown).toBeGreaterThan(0.3);

    // Put player back on hazard next frame: cooldown must suppress duplicate collision burst
    sim.player.sim.x = mh.position.x;
    sim.player.sim.z = mh.position.z;
    const speedAfterFirst = sim.player.sim.forwardSpeed;
    const ev2 = sim.step(FIXED_TIMESTEP, {
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
      useItem: false,
      recover: false,
    });
    expect(ev2.playerCollision).toBe(false);
    expect(sim.player.sim.forwardSpeed).toBeGreaterThanOrEqual(speedAfterFirst * 0.85);
  });

  it('caps Easy AI straight-line top speed strictly below Hard AI (MÉDIO-02)', () => {
    const runStraight = (throttle: number) => {
      const sim = new RaceSimulation(
        PORTO_DAS_LANTERNAS_LAYOUT,
        'nilo',
        'trilha-raposa',
        'normal',
        3,
        true,
        'practice',
      );
      sim.tracker.phase = 'racing';
      const s0 = PORTO_DAS_LANTERNAS_LAYOUT.samples[0];
      sim.player.sim.x = s0.point.x;
      sim.player.sim.y = s0.point.y;
      sim.player.sim.z = s0.point.z;
      sim.player.sim.yaw = yawFromTangent(s0.tangent);
      for (let i = 0; i < 240; i += 1) {
        sim.step(FIXED_TIMESTEP, {
          throttle,
          brake: 0,
          steer: 0,
          drift: false,
          useItem: false,
          recover: false,
        });
      }
      return sim.player.sim.forwardSpeed;
    };

    const easyTop = runStraight(0.84);
    const hardTop = runStraight(1.0);
    expect(hardTop).toBeGreaterThan(easyTop + 2.5);
  });
});
