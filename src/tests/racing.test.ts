import { describe, expect, it } from 'vitest';
import { FIXED_TIMESTEP } from '../game/core/constants';
import { RaceProgressTracker, formatRaceTimeMs } from '../game/racing/raceManager';
import { RaceSimulation } from '../game/racing/raceSimulation';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { projectPointOntoTrack, yawFromTangent } from '../game/tracks/trackGeometry';

describe('Race Progress, Checkpoints & Anti-Cut Validation', () => {
  it('blocks lap completion when crossing finish line without completing lap checkpoints', () => {
    const tracker = new RaceProgressTracker(PORTO_DAS_LANTERNAS_LAYOUT, 3, true);
    tracker.phase = 'racing';
    const racer = tracker.createRacerState();

    // Try crossing checkpoint 0 repeatedly without visiting checkpoints 1..11
    const cp0 = PORTO_DAS_LANTERNAS_LAYOUT.checkpoints[0];
    const query = projectPointOntoTrack(PORTO_DAS_LANTERNAS_LAYOUT, cp0.position.x, cp0.position.z);
    const res = tracker.updateRacerProgress(racer, cp0.position.x, cp0.position.z, cp0.yaw, query);

    expect(res.lapCompleted).toBe(false);
    expect(racer.currentLap).toBe(1);
    expect(racer.finished).toBe(false);
  });

  it('completes 3 laps sequentially and records valid lap splits', () => {
    const tracker = new RaceProgressTracker(PORTO_DAS_LANTERNAS_LAYOUT, 3, true);
    tracker.phase = 'racing';
    const racer = tracker.createRacerState();

    const cps = PORTO_DAS_LANTERNAS_LAYOUT.checkpoints;
    for (let lap = 1; lap <= 3; lap += 1) {
      for (let i = 1; i < cps.length; i += 1) {
        tracker.stepClock(2.1);
        const cp = cps[i];
        const query = projectPointOntoTrack(
          PORTO_DAS_LANTERNAS_LAYOUT,
          cp.position.x,
          cp.position.z,
          cp.position.y,
        );
        tracker.updateRacerProgress(racer, cp.position.x, cp.position.z, cp.yaw, query);
      }
      tracker.stepClock(2.1);
      const cp0 = cps[0];
      const q0 = projectPointOntoTrack(
        PORTO_DAS_LANTERNAS_LAYOUT,
        cp0.position.x,
        cp0.position.z,
        cp0.position.y,
      );
      const result = tracker.updateRacerProgress(racer, cp0.position.x, cp0.position.z, cp0.yaw, q0);
      expect(result.lapCompleted).toBe(true);
      expect(result.raceFinishedNow).toBe(lap === 3);
    }

    expect(racer.finished).toBe(true);
    expect(tracker.phase).toBe('finished');
    expect(racer.lapTimesMs).toHaveLength(3);
    expect(racer.bestLapMs).toBeGreaterThan(0);
    expect(formatRaceTimeMs(65_432)).toBe('01:05.432');
  });

  it('detects wrong-way driving accurately', () => {
    const tracker = new RaceProgressTracker(PORTO_DAS_LANTERNAS_LAYOUT, 3, true);
    tracker.phase = 'racing';
    const racer = tracker.createRacerState();
    const cp2 = PORTO_DAS_LANTERNAS_LAYOUT.checkpoints[2];
    const query = projectPointOntoTrack(PORTO_DAS_LANTERNAS_LAYOUT, cp2.position.x, cp2.position.z);

    // Facing forward -> wrongWay false
    tracker.updateRacerProgress(
      racer,
      cp2.position.x,
      cp2.position.z,
      yawFromTangent(cp2.tangent),
      query,
    );
    expect(racer.wrongWay).toBe(false);

    // Facing backward -> wrongWay true
    tracker.updateRacerProgress(
      racer,
      cp2.position.x,
      cp2.position.z,
      yawFromTangent(cp2.tangent) + Math.PI,
      query,
    );
    expect(racer.wrongWay).toBe(true);
  });

  it('keeps race active and lets human player continue driving and finish after AI finishes first (CRÍTICO-01)', () => {
    const sim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'hard',
      1,
      true,
      'quick-race',
    );
    sim.tracker.phase = 'racing';

    const idleInput = {
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
      useItem: false,
      recover: false,
    };

    // Simulate until at least one AI racer finishes the 1-lap race while player waits
    let aiFinished = false;
    for (let step = 0; step < 3000; step += 1) {
      sim.step(FIXED_TIMESTEP, idleInput);
      if (sim.racers.some((r) => !r.isPlayer && r.race.finished)) {
        aiFinished = true;
        break;
      }
    }

    expect(aiFinished).toBe(true);
    expect(sim.player.race.finished).toBe(false);
    expect(sim.phase).toBe('racing');

    // Player must still be able to accelerate normally (no softlock)
    const gasInput = { ...idleInput, throttle: 1 };
    for (let step = 0; step < 90; step += 1) {
      sim.step(FIXED_TIMESTEP, gasInput);
    }
    expect(sim.player.sim.forwardSpeed).toBeGreaterThan(15);
    expect(sim.phase).toBe('racing');

    // Now guide player through all checkpoints + finish line
    const cps = PORTO_DAS_LANTERNAS_LAYOUT.checkpoints;
    for (let i = 1; i < cps.length; i += 1) {
      const cp = cps[i];
      sim.player.sim.x = cp.position.x;
      sim.player.sim.y = cp.position.y;
      sim.player.sim.z = cp.position.z;
      sim.player.sim.yaw = cp.yaw;
      sim.step(FIXED_TIMESTEP, gasInput);
    }
    const cp0 = cps[0];
    sim.player.sim.x = cp0.position.x;
    sim.player.sim.y = cp0.position.y;
    sim.player.sim.z = cp0.position.z;
    sim.player.sim.yaw = cp0.yaw;
    const finishEvents = sim.step(FIXED_TIMESTEP, gasInput);

    expect(sim.player.race.finished).toBe(true);
    expect(finishEvents.playerFinishedNow).toBe(true);
    expect(sim.phase).toBe('finished');
    expect(sim.player.rank).toBeGreaterThanOrEqual(2);
  });
});
