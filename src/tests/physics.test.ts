import { describe, expect, it } from 'vitest';
import { getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { FIXED_TIMESTEP } from '../game/core/constants';
import {
  type KartInputState,
  computeKartPhysicsProfile,
  createInitialKartState,
  stepKartSimulation,
  triggerKartBoost,
} from '../game/physics/kartController';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { type TrackPointQuery, projectPointOntoTrack } from '../game/tracks/trackGeometry';

const NO_INPUT: KartInputState = {
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
  useItem: false,
  recover: false,
};

function makeQuery(
  surface: TrackPointQuery['surface'],
  overrides?: Partial<TrackPointQuery>,
): TrackPointQuery {
  const sample = PORTO_DAS_LANTERNAS_LAYOUT.samples[0];
  return {
    nearestSample: sample,
    lateralOffset: 0,
    distanceAlongTrack: 0,
    groundHeight: 0,
    slopeY: 0,
    surface,
    wallDistance: PORTO_DAS_LANTERNAS_LAYOUT.wallMargin,
    outOfBounds: false,
    onShortcut: false,
    activeBoostPad: null,
    activeRamp: null,
    ...overrides,
  };
}

describe('Kart Arcade Physics & 3-Tier Drift System', () => {
  it('accelerates progressively, caps at top speed, brakes and drives in reverse', () => {
    const profile = computeKartPhysicsProfile(
      getKartById('trilha-raposa'),
      getCharacterById('nilo'),
    );
    const state = createInitialKartState(0, 0, 36, 0);
    const query = makeQuery('asphalt');

    for (let i = 0; i < 240; i += 1) {
      stepKartSimulation(
        state,
        { ...NO_INPUT, throttle: 1 },
        query,
        profile,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
    }

    expect(state.forwardSpeed).toBeGreaterThan(profile.topSpeedMs * 0.92);
    expect(state.forwardSpeed).toBeLessThanOrEqual(profile.topSpeedMs + 0.1);

    // Brake to zero and then reverse
    for (let i = 0; i < 180; i += 1) {
      stepKartSimulation(
        state,
        { ...NO_INPUT, brake: 1 },
        query,
        profile,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
    }
    expect(state.forwardSpeed).toBeLessThan(0);
    expect(state.forwardSpeed).toBeGreaterThanOrEqual(-profile.reverseMaxMs - 0.1);
  });

  it('produces distinct top-speed vs grip characteristics across different karts', () => {
    const fastProfile = computeKartPhysicsProfile(
      getKartById('cometa-estelar'),
      getCharacterById('lumi'),
    );
    const allTerrainProfile = computeKartPhysicsProfile(
      getKartById('raiz-veloz'),
      getCharacterById('kora'),
    );

    expect(fastProfile.topSpeedMs).toBeGreaterThan(allTerrainProfile.topSpeedMs);
    expect(allTerrainProfile.gripFactor).toBeGreaterThan(fastProfile.gripFactor);
  });

  it('reduces max speed on grass & sand and lowers lateral grip on ice', () => {
    const profile = computeKartPhysicsProfile(getKartById('trilha-raposa'));

    const runSurface = (surface: TrackPointQuery['surface']) => {
      const state = createInitialKartState(0, 0, 36, 0);
      const query = makeQuery(surface);
      for (let i = 0; i < 240; i += 1) {
        stepKartSimulation(
          state,
          { ...NO_INPUT, throttle: 1 },
          query,
          profile,
          PORTO_DAS_LANTERNAS_LAYOUT,
          FIXED_TIMESTEP,
        );
      }
      return state.forwardSpeed;
    };

    const asphaltSpeed = runSurface('asphalt');
    const dirtSpeed = runSurface('dirt');
    const grassSpeed = runSurface('grass');
    const sandSpeed = runSurface('sand');

    expect(asphaltSpeed).toBeGreaterThan(dirtSpeed);
    expect(dirtSpeed).toBeGreaterThan(sandSpeed);
    expect(asphaltSpeed).toBeGreaterThan(grassSpeed);

    // Ice lateral slip test: heading changes rapidly while velocity lags behind
    const iceState = createInitialKartState(0, 0, 36, 0);
    iceState.forwardSpeed = 28;
    iceState.vx = 0;
    iceState.vz = -28;
    stepKartSimulation(
      iceState,
      { ...NO_INPUT, throttle: 1, steer: 1 },
      makeQuery('ice'),
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );
    const asphaltTurnState = createInitialKartState(0, 0, 36, 0);
    asphaltTurnState.forwardSpeed = 28;
    asphaltTurnState.vx = 0;
    asphaltTurnState.vz = -28;
    stepKartSimulation(
      asphaltTurnState,
      { ...NO_INPUT, throttle: 1, steer: 1 },
      makeQuery('asphalt'),
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );
    expect(Math.abs(asphaltTurnState.vx)).toBeGreaterThan(Math.abs(iceState.vx));
  });

  it('charges drift through tiers 1, 2, 3 and fires proportional mini-turbo on release', () => {
    const profile = computeKartPhysicsProfile(getKartById('trilha-raposa'));
    const state = createInitialKartState(0, 0, 36, 0);
    state.forwardSpeed = 26;
    const query = makeQuery('asphalt');

    // Enter drift turning left
    stepKartSimulation(
      state,
      { ...NO_INPUT, throttle: 1, steer: -1, drift: true },
      query,
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );
    expect(state.driftActive).toBe(true);
    expect(state.driftDir).toBe(1);

    // Hold inward drift long enough to reach Tier 3
    let sawTier1 = false;
    let sawTier2 = false;
    for (let i = 0; i < 160; i += 1) {
      stepKartSimulation(
        state,
        { ...NO_INPUT, throttle: 1, steer: -1, drift: true },
        query,
        profile,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
      if (state.driftTier === 1) sawTier1 = true;
      if (state.driftTier === 2) sawTier2 = true;
    }

    expect(sawTier1).toBe(true);
    expect(sawTier2).toBe(true);
    expect(state.driftTier).toBe(3);

    // Release drift -> trigger Tier 3 Mini-Turbo
    stepKartSimulation(
      state,
      { ...NO_INPUT, throttle: 1, steer: 0, drift: false },
      query,
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );

    expect(state.driftActive).toBe(false);
    expect(state.boostTimer).toBeGreaterThan(1.5);
    expect(state.boostMultiplier).toBeGreaterThan(1.3);
    expect(state.totalDriftsCompleted).toBe(1);
    expect(state.totalTurbosTriggered).toBe(1);
  });

  it('launches on jump ramps, lands with gravity, and safely recovers to last checkpoint without gaining distance', () => {
    const profile = computeKartPhysicsProfile(getKartById('trilha-raposa'));
    const ramp = PORTO_DAS_LANTERNAS_LAYOUT.ramps[0];
    const state = createInitialKartState(ramp.position.x, ramp.position.y, ramp.position.z, ramp.yaw);
    state.forwardSpeed = 30;
    const rampQuery = projectPointOntoTrack(
      PORTO_DAS_LANTERNAS_LAYOUT,
      ramp.position.x,
      ramp.position.z,
      ramp.position.y,
    );

    stepKartSimulation(
      state,
      { ...NO_INPUT, throttle: 1 },
      rampQuery,
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );
    expect(state.grounded).toBe(false);
    expect(state.vy).toBeGreaterThan(8);

    // Trigger manual recovery and ensure position snaps back to safe checkpoint 0 (not ahead!)
    state.lastSafeCheckpointIndex = 0;
    triggerKartBoost(state, 1.0, 1.3, 'Teste');
    stepKartSimulation(
      state,
      { ...NO_INPUT, recover: true },
      rampQuery,
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );

    const cp0 = PORTO_DAS_LANTERNAS_LAYOUT.checkpoints[0];
    expect(state.recoverTimer).toBeGreaterThan(0);
    expect(state.forwardSpeed).toBe(0);
    expect(state.boostTimer).toBe(0);
    expect(Math.hypot(state.x - cp0.position.x, state.z - cp0.position.z)).toBeLessThan(0.5);
  });
});
