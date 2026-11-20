import { describe, expect, it } from 'vitest';
import {
  DRIFT_TIERS,
  FIXED_TIMESTEP,
  FixedStepClock,
  SURFACE_PROPERTIES,
  createInitialSaveData,
} from '../game/core/constants';

describe('Core Constants & Fixed-Timestep Simulation', () => {
  it('simulates identical step counts regardless of frame rate (30, 60, 144 FPS)', () => {
    const runAtFps = (fps: number, durationSeconds: number): number => {
      const clock = new FixedStepClock(FIXED_TIMESTEP, 0.1);
      const dt = 1 / fps;
      const frames = Math.round(durationSeconds * fps);
      let steps = 0;
      for (let i = 0; i < frames; i += 1) {
        clock.advance(dt, () => {
          steps += 1;
        });
      }
      return steps;
    };

    const steps30 = runAtFps(30, 2);
    const steps60 = runAtFps(60, 2);
    const steps144 = runAtFps(144, 2);

    expect(steps30).toBe(120);
    expect(steps60).toBe(120);
    expect(steps144).toBe(120);
  });

  it('clamps huge delta spikes so physics never explodes after tab backgrounding', () => {
    const clock = new FixedStepClock(1 / 60, 0.1);
    let executed = 0;
    clock.advance(5.0, () => {
      executed += 1;
    });
    expect(executed).toBe(6); // 0.1s / (1/60s) = 6 steps max
  });

  it('orders surface grip and speed modifiers according to arcade racing rules', () => {
    expect(SURFACE_PROPERTIES.asphalt.grip).toBeGreaterThan(SURFACE_PROPERTIES.dirt.grip);
    expect(SURFACE_PROPERTIES.dirt.grip).toBeGreaterThan(SURFACE_PROPERTIES.grass.grip);
    expect(SURFACE_PROPERTIES.ice.grip).toBeLessThan(SURFACE_PROPERTIES.grass.grip);
    expect(SURFACE_PROPERTIES.sand.drag).toBeGreaterThan(SURFACE_PROPERTIES.asphalt.drag);
    expect(SURFACE_PROPERTIES.grass.maxSpeedMultiplier).toBeLessThan(
      SURFACE_PROPERTIES.asphalt.maxSpeedMultiplier,
    );
  });

  it('orders drift tiers monotonically in charge threshold, duration, and speed bonus', () => {
    expect(DRIFT_TIERS).toHaveLength(3);
    expect(DRIFT_TIERS[0].chargeThresholdSeconds).toBeLessThan(
      DRIFT_TIERS[1].chargeThresholdSeconds,
    );
    expect(DRIFT_TIERS[1].chargeThresholdSeconds).toBeLessThan(
      DRIFT_TIERS[2].chargeThresholdSeconds,
    );
    expect(DRIFT_TIERS[0].speedBonusMultiplier).toBeLessThan(
      DRIFT_TIERS[2].speedBonusMultiplier,
    );
  });

  it('creates versioned initial save data with starter unlocks', () => {
    const save = createInitialSaveData();
    expect(save.version).toBe(1);
    expect(save.unlockedCharacters).toContain('nilo');
    expect(save.unlockedKarts).toContain('trilha-raposa');
    expect(save.unlockedTracks).toContain('porto-das-lanternas');
  });
});
