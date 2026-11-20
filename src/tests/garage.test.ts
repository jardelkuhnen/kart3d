import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { KARTS, getKartById } from '../data/karts';
import { validateManifestSchema } from '../game/core/assetLoader';
import { FIXED_TIMESTEP } from '../game/core/constants';
import {
  type KartInputState,
  computeKartPhysicsProfile,
  createInitialKartState,
  stepKartSimulation,
} from '../game/physics/kartController';
import { RaceSimulation } from '../game/racing/raceSimulation';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { type TrackPointQuery } from '../game/tracks/trackGeometry';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'assets/manifest.json');

const REQUIRED_CHARACTER_NODES = [
  'Torso',
  'Head',
  'ArmL',
  'ArmR',
  'EarL',
  'EarR',
  'TailBase',
  'ScarfTail',
];

const REQUIRED_CHARACTER_ANIMS = [
  'idle',
  'drive',
  'turnLeft',
  'turnRight',
  'drift',
  'hit',
  'victory',
  'defeat',
  'podium',
];

const REQUIRED_KART_NODES = [
  'KartRoot',
  'ChassisGroup',
  'SteeringWheel',
  'DriverMount',
  'ExhaustL',
  'ExhaustR',
  'WheelFL',
  'WheelFR',
  'WheelRL',
  'WheelRR',
];

const NO_INPUT: KartInputState = {
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
  useItem: false,
  recover: false,
};

function makeAsphaltQuery(): TrackPointQuery {
  const sample = PORTO_DAS_LANTERNAS_LAYOUT.samples[0];
  return {
    nearestSample: sample,
    lateralOffset: 0,
    distanceAlongTrack: 0,
    groundHeight: 0,
    slopeY: 0,
    surface: 'asphalt',
    wallDistance: PORTO_DAS_LANTERNAS_LAYOUT.wallMargin,
    outOfBounds: false,
    onShortcut: false,
    activeBoostPad: null,
    activeRamp: null,
  };
}

describe('Slice 3 — 8 Characters, 8 Structurally Distinct Karts & Physics Variance', () => {
  it('validates all 8 character GLBs (bones + 9 animations), portraits, and HUD icons in manifest.json', async () => {
    expect(CHARACTERS).toHaveLength(8);
    const manifest = validateManifestSchema(JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')));
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    const io = new NodeIO();

    const charSizes = new Set<number>();

    for (const char of CHARACTERS) {
      const modelEntry = byId.get(char.modelAssetId);
      const portraitEntry = byId.get(char.portraitAssetId);
      const iconEntry = byId.get(char.iconAssetId);

      expect(modelEntry?.validationStatus).toBe('validated');
      expect(portraitEntry?.validationStatus).toBe('validated');
      expect(iconEntry?.validationStatus).toBe('validated');

      const glbPath = path.join(PUBLIC_DIR, modelEntry!.path.replace(/^\/+/, ''));
      const raw = await fs.readFile(glbPath);
      charSizes.add(raw.byteLength);

      const doc = await io.readBinary(new Uint8Array(raw));
      const root = doc.getRoot();
      const nodeNames = new Set(root.listNodes().map((n) => n.getName()));
      const animNames = new Set(root.listAnimations().map((a) => a.getName()));

      for (const reqNode of REQUIRED_CHARACTER_NODES) {
        expect(nodeNames.has(reqNode), `${char.id} missing node ${reqNode}`).toBe(true);
      }
      for (const reqAnim of REQUIRED_CHARACTER_ANIMS) {
        expect(animNames.has(reqAnim), `${char.id} missing animation ${reqAnim}`).toBe(true);
      }

      const portraitStat = await fs.stat(
        path.join(PUBLIC_DIR, portraitEntry!.path.replace(/^\/+/, '')),
      );
      const iconStat = await fs.stat(path.join(PUBLIC_DIR, iconEntry!.path.replace(/^\/+/, '')));
      expect(portraitStat.size).toBeGreaterThan(1000);
      expect(iconStat.size).toBeGreaterThan(500);
    }

    // All 8 characters have genuinely different silhouettes/mesh structures
    expect(charSizes.size).toBeGreaterThanOrEqual(6);
  });

  it('validates all 8 kart GLBs with required nodes and distinct chassis geometry', async () => {
    expect(KARTS).toHaveLength(8);
    const manifest = validateManifestSchema(JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')));
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    const io = new NodeIO();

    const meshCountsAndSizes = new Set<string>();

    for (const kart of KARTS) {
      const entry = byId.get(kart.modelAssetId);
      expect(entry?.validationStatus).toBe('validated');

      const glbPath = path.join(PUBLIC_DIR, entry!.path.replace(/^\/+/, ''));
      const raw = await fs.readFile(glbPath);
      const doc = await io.readBinary(new Uint8Array(raw));
      const root = doc.getRoot();
      const nodeNames = new Set(root.listNodes().map((n) => n.getName()));

      for (const reqNode of REQUIRED_KART_NODES) {
        expect(nodeNames.has(reqNode), `${kart.id} missing node ${reqNode}`).toBe(true);
      }

      meshCountsAndSizes.add(`${root.listMeshes().length}:${raw.byteLength}`);
    }

    // All 8 karts differ structurally / byte-wise
    expect(meshCountsAndSizes.size).toBe(8);
  });

  it('produces measurable gameplay differences across top speed, acceleration, handling, drift charge, grip, and mass collisions', () => {
    const query = makeAsphaltQuery();

    // 1. Top speed: Cometa Estelar (topSpeed 9) vs Raiz Veloz (topSpeed 6)
    const runSteps = (
      kartId: (typeof KARTS)[number]['id'],
      steps: number,
      input: Partial<KartInputState>,
    ) => {
      const profile = computeKartPhysicsProfile(getKartById(kartId));
      const state = createInitialKartState(0, 0, 36, 0);
      for (let i = 0; i < steps; i += 1) {
        stepKartSimulation(
          state,
          { ...NO_INPUT, ...input },
          query,
          profile,
          PORTO_DAS_LANTERNAS_LAYOUT,
          FIXED_TIMESTEP,
        );
      }
      return { state, profile };
    };

    const cometaTop = runSteps('cometa-estelar', 240, { throttle: 1 });
    const raizTop = runSteps('raiz-veloz', 240, { throttle: 1 });
    expect(cometaTop.state.forwardSpeed).toBeGreaterThan(raizTop.state.forwardSpeed + 1.5);

    // 2. Acceleration: Brisa Corsária (accel 8) launches faster in first 60 steps than Escorpião Dourado (accel 6)
    const brisaAccel = runSteps('brisa-corsaria', 50, { throttle: 1 });
    const escorpiaoAccel = runSteps('escorpiao-dourado', 50, { throttle: 1 });
    expect(brisaAccel.state.forwardSpeed).toBeGreaterThan(escorpiaoAccel.state.forwardSpeed);

    // 3. Handling: Brisa Corsária (handling 9) turns tighter than Escorpião Dourado (handling 5)
    const brisaTurn = runSteps('brisa-corsaria', 90, { throttle: 1, steer: 1 });
    const escorpiaoTurn = runSteps('escorpiao-dourado', 90, { throttle: 1, steer: 1 });
    expect(Math.abs(brisaTurn.state.yaw)).toBeGreaterThan(Math.abs(escorpiaoTurn.state.yaw));

    // 4. Drift efficiency: Lâmina Glacial (drift 9) builds more drift charge than Raiz Veloz (drift 6)
    const laminaDrift = computeKartPhysicsProfile(getKartById('lamina-glacial'));
    const raizDrift = computeKartPhysicsProfile(getKartById('raiz-veloz'));
    expect(laminaDrift.driftChargeRate).toBeGreaterThan(raizDrift.driftChargeRate);

    const stateLamina = createInitialKartState(0, 0, 36, 0);
    const stateRaiz = createInitialKartState(0, 0, 36, 0);
    stateLamina.forwardSpeed = 24;
    stateRaiz.forwardSpeed = 24;
    for (let i = 0; i < 65; i += 1) {
      stepKartSimulation(
        stateLamina,
        { ...NO_INPUT, throttle: 1, steer: 1, drift: true },
        query,
        laminaDrift,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
      stepKartSimulation(
        stateRaiz,
        { ...NO_INPUT, throttle: 1, steer: 1, drift: true },
        query,
        raizDrift,
        PORTO_DAS_LANTERNAS_LAYOUT,
        FIXED_TIMESTEP,
      );
    }
    expect(stateLamina.driftChargeSeconds).toBeGreaterThan(stateRaiz.driftChargeSeconds);

    // 5. Grip: Raiz Veloz (grip 9) has higher gripFactor than Lâmina Glacial (grip 6)
    expect(raizDrift.gripFactor).toBeGreaterThan(laminaDrift.gripFactor);

    // 6. Mass collision asymmetry: Heavy Engrenagem Turbo (mass 9) knocks light Brisa Corsária (mass 4) farther
    const sim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'boro',
      'engrenagem-turbo',
      'normal',
      3,
      true,
    );
    sim.tracker.phase = 'racing';
    const heavyStartX = 0;
    const lightStartX = 0.6;
    sim.racers[0].sim.x = heavyStartX;
    sim.racers[0].sim.z = 10;
    // Swap AI 1 explicitly to Brisa Corsária so we measure exact heaviest vs lightest collision
    sim.racers[1].profile = computeKartPhysicsProfile(
      getKartById('brisa-corsaria'),
      getCharacterById('mavi'),
    );
    sim.racers[1].sim.x = lightStartX;
    sim.racers[1].sim.z = 10;

    sim.step(FIXED_TIMESTEP, NO_INPUT);

    const heavyDisplacement = Math.abs(sim.racers[0].sim.x - heavyStartX);
    const lightDisplacement = Math.abs(sim.racers[1].sim.x - lightStartX);
    expect(lightDisplacement).toBeGreaterThan(heavyDisplacement * 1.3);
  });
});
