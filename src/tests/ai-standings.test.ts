import { describe, expect, it } from 'vitest';
import { FIXED_TIMESTEP } from '../game/core/constants';
import { RaceSimulation, computeStandings } from '../game/racing/raceSimulation';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';

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
});
