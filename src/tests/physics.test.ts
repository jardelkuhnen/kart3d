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
import { TRACK_LAYOUTS } from '../game/tracks/registry';
import {
  type TrackPointQuery,
  offsetPointOnTrack,
  projectPointOntoTrack,
  yawFromTangent,
} from '../game/tracks/trackGeometry';

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

    // Explicit braking without throttle cancels active boost and decelerates cleanly
    const speedBeforeBrake = state.forwardSpeed;
    stepKartSimulation(
      state,
      { ...NO_INPUT, brake: 1 },
      query,
      profile,
      PORTO_DAS_LANTERNAS_LAYOUT,
      FIXED_TIMESTEP,
    );
    expect(state.boostTimer).toBe(0);
    expect(state.forwardSpeed).toBeLessThan(speedBeforeBrake);
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

  it('slides smoothly along track wall on angled collision without getting stuck', () => {
    const profile = computeKartPhysicsProfile(getKartById('trilha-raposa'));
    const startSample = PORTO_DAS_LANTERNAS_LAYOUT.samples[12];
    const trackYaw = yawFromTangent(startSample.tangent);
    const startPos = offsetPointOnTrack(startSample, PORTO_DAS_LANTERNAS_LAYOUT.wallMargin - 1.5, 0);
    // Point ~35 deg into the right wall while cruising fast
    const state = createInitialKartState(startPos.x, startPos.y, startPos.z, trackYaw - 0.62);
    state.forwardSpeed = 28;
    state.vx = -Math.sin(state.yaw) * state.forwardSpeed;
    state.vz = -Math.cos(state.yaw) * state.forwardSpeed;

    const initialS = startSample.s;
    let sawWallSlide = false;
    let maxObservedLateral = 0;

    for (let i = 0; i < 90; i += 1) {
      const q = projectPointOntoTrack(PORTO_DAS_LANTERNAS_LAYOUT, state.x, state.z, state.y);
      stepKartSimulation(
        state,
        { ...NO_INPUT, throttle: 1 },
        q,
        profile,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
      if (state.wallCollisionThisStep) {
        sawWallSlide = true;
      }
      maxObservedLateral = Math.max(maxObservedLateral, Math.abs(state.lateralOffset));
    }

    const finalQ = projectPointOntoTrack(PORTO_DAS_LANTERNAS_LAYOUT, state.x, state.z, state.y);
    const maxLateral = PORTO_DAS_LANTERNAS_LAYOUT.wallMargin - 0.95;
    expect(sawWallSlide).toBe(true);
    expect(maxObservedLateral).toBeLessThanOrEqual(maxLateral + 0.25);
    expect(finalQ.distanceAlongTrack - initialS).toBeGreaterThan(15);
    expect(state.forwardSpeed).toBeGreaterThan(14);
  });

  it('allows steering at zero speed and auto-unsticks a kart wedged 90 degrees into a wall', () => {
    const profile = computeKartPhysicsProfile(getKartById('trilha-raposa'));

    // 1. Steering authority at zero speed
    const idleState = createInitialKartState(0, 0, 36, 0);
    const qIdle = makeQuery('asphalt');
    for (let i = 0; i < 15; i += 1) {
      stepKartSimulation(
        idleState,
        { ...NO_INPUT, steer: 1, throttle: 0 },
        qIdle,
        profile,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
    }
    expect(Math.abs(idleState.yaw)).toBeGreaterThan(0.05);

    // 2. Wedged 90 degrees straight into right wall with low tangential speed -> auto-unsticks within 1.5s
    const sSample = PORTO_DAS_LANTERNAS_LAYOUT.samples[10];
    const trackYaw = yawFromTangent(sSample.tangent);
    const wallEdge = offsetPointOnTrack(sSample, PORTO_DAS_LANTERNAS_LAYOUT.wallMargin - 0.9, 0);
    const wedged = createInitialKartState(
      wallEdge.x,
      wallEdge.y,
      wallEdge.z,
      trackYaw - Math.PI * 0.5,
    );
    wedged.forwardSpeed = 2;

    for (let i = 0; i < 95; i += 1) {
      const q = projectPointOntoTrack(PORTO_DAS_LANTERNAS_LAYOUT, wedged.x, wedged.z, wedged.y);
      stepKartSimulation(
        wedged,
        { ...NO_INPUT, throttle: 1 },
        q,
        profile,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
    }

    expect(wedged.forwardSpeed).toBeGreaterThan(5);
    expect(wedged.wallStuckTimer).toBe(0);
  });

  it('detects every boost pad along its rotated heading and enforces ascending slopes on all ramps across all 8 tracks (CRÍTICO-04)', () => {
    for (const layout of Object.values(TRACK_LAYOUTS)) {
      for (const pad of layout.boostPads) {
        const fx = -Math.sin(pad.yaw);
        const fz = -Math.cos(pad.yaw);
        for (const frac of [-0.35, 0, 0.35]) {
          const px = pad.position.x + fx * (pad.length * frac);
          const pz = pad.position.z + fz * (pad.length * frac);
          const q = projectPointOntoTrack(layout, px, pz, pad.position.y);
          expect(q.activeBoostPad?.id, `${layout.id}/${pad.id} at frac ${frac}`).toBe(pad.id);
        }
        // Vertically separated overpass/underpass must not trigger the pad
        const farAbove = projectPointOntoTrack(layout, pad.position.x, pad.position.z, pad.position.y + 6.0);
        expect(farAbove.activeBoostPad).toBeNull();
      }

      for (const ramp of layout.ramps) {
        const fx = -Math.sin(ramp.yaw);
        const fz = -Math.cos(ramp.yaw);
        const entryX = ramp.position.x - fx * (ramp.length * 0.4);
        const entryZ = ramp.position.z - fz * (ramp.length * 0.4);
        const exitX = ramp.position.x + fx * (ramp.length * 0.4);
        const exitZ = ramp.position.z + fz * (ramp.length * 0.4);

        const entryQ = projectPointOntoTrack(layout, entryX, entryZ, ramp.position.y);
        const exitQ = projectPointOntoTrack(layout, exitX, exitZ, ramp.position.y + ramp.height);

        expect(entryQ.activeRamp?.id, `${layout.id}/${ramp.id} entry`).toBe(ramp.id);
        expect(exitQ.activeRamp?.id, `${layout.id}/${ramp.id} exit`).toBe(ramp.id);
        expect(exitQ.groundHeight, `${layout.id}/${ramp.id} ascending`).toBeGreaterThan(
          entryQ.groundHeight + ramp.height * 0.4,
        );
      }
    }
  });
});
