import { describe, expect, it } from 'vitest';
import { getKartById } from '../data/karts';
import { FIXED_TIMESTEP } from '../game/core/constants';
import {
  type ItemRacerAdapter,
  type ItemStepEvents,
  ItemWorldManager,
  createRacerItemState,
  rollItemForRank,
} from '../game/items/itemSystem';
import {
  computeKartPhysicsProfile,
  createInitialKartState,
} from '../game/physics/kartController';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { TRACK_LAYOUTS } from '../game/tracks/registry';
import { projectPointOntoTrack } from '../game/tracks/trackGeometry';

function makeAdapter(id: string, rank: number, x: number, z: number, yaw = 0): ItemRacerAdapter {
  const sim = createInitialKartState(x, 0, z, yaw);
  sim.forwardSpeed = 28;
  return {
    id,
    rank,
    sim,
    itemState: createRacerItemState(),
  };
}

function emptyEvents(): ItemStepEvents {
  return {
    pickedUpByPlayer: false,
    usedByPlayer: null,
    playerHit: false,
    playerShieldBlocked: false,
  };
}

describe('6-Item System & Position-Balanced Distribution', () => {
  it('distributes defensive/trap items more often to 1st place and boost/catch-up items to 8th place', () => {
    const firstCounts: Record<string, number> = {};
    const eighthCounts: Record<string, number> = {};
    for (let i = 0; i < 400; i += 1) {
      const r = (i + 0.5) / 400;
      const i1 = rollItemForRank(1, () => r);
      const i8 = rollItemForRank(8, () => r);
      firstCounts[i1] = (firstCounts[i1] ?? 0) + 1;
      eighthCounts[i8] = (eighthCounts[i8] ?? 0) + 1;
    }

    expect((firstCounts['bolha-guardia'] ?? 0) + (firstCounts['nevoa-prisma'] ?? 0)).toBeGreaterThan(
      (eighthCounts['bolha-guardia'] ?? 0) + (eighthCounts['nevoa-prisma'] ?? 0),
    );
    expect(eighthCounts['pulso-solar'] ?? 0).toBeGreaterThan(firstCounts['pulso-solar'] ?? 0);
  });

  it('picks up an item box on contact and respawns it after cooldown', () => {
    const manager = new ItemWorldManager(PORTO_DAS_LANTERNAS_LAYOUT);
    const firstBox = manager.boxes[0];
    const player = makeAdapter('p1', 3, firstBox.position.x, firstBox.position.z);

    const ev = manager.step(FIXED_TIMESTEP, [player], 'p1', () => 0.25);
    expect(ev.pickedUpByPlayer).toBe(true);
    expect(firstBox.active).toBe(false);
    expect(player.itemState.heldItem).not.toBeNull();

    // Wait out respawn timer (4.5s)
    for (let i = 0; i < 300; i += 1) {
      manager.step(FIXED_TIMESTEP, [makeAdapter('p1', 3, 999, 999)], 'p1');
    }
    expect(firstBox.active).toBe(true);
  });

  it('implements Pulso Solar, Cristal de Salto, Névoa Prisma, Bolha Guardiã, Faísca Rastreadora and Onda de Vento', () => {
    const manager = new ItemWorldManager(PORTO_DAS_LANTERNAS_LAYOUT);
    const p1 = makeAdapter('p1', 2, 0, 10, 0);
    const p2 = makeAdapter('p2', 1, 0, -5, 0);
    const p3 = makeAdapter('p3', 3, 3.0, 10, 0);
    const racers = [p1, p2, p3];

    // 1. Pulso Solar boost
    p1.itemState.heldItem = 'pulso-solar';
    expect(manager.activateItem(p1, racers, 'p1', emptyEvents())).toBe(true);
    expect(p1.sim.boostTimer).toBeGreaterThan(1.0);
    expect(p1.sim.boostMultiplier).toBeGreaterThan(1.25);
    p1.itemState.itemCooldown = 0;

    // 2. Cristal de Salto vertical launch
    p1.itemState.heldItem = 'cristal-de-salto';
    expect(manager.activateItem(p1, racers, 'p1', emptyEvents())).toBe(true);
    expect(p1.sim.vy).toBeGreaterThan(10);
    expect(p1.sim.grounded).toBe(false);
    p1.itemState.itemCooldown = 0;

    // 3. Névoa Prisma trap spawns behind p2 and slows unshielded p1 when hit
    p2.itemState.heldItem = 'nevoa-prisma';
    manager.activateItem(p2, racers, 'p1', emptyEvents());
    expect(manager.hazards).toHaveLength(1);
    const haz = manager.hazards[0];
    haz.ttl = 8.0; // beyond grace period
    p1.sim.x = haz.x;
    p1.sim.y = haz.y;
    p1.sim.z = haz.z;
    const hitEv = manager.step(FIXED_TIMESTEP, racers, 'p1');
    expect(hitEv.playerHit).toBe(true);
    expect(p1.itemState.hazardSlowTimer).toBeGreaterThan(1.0);

    // 4. Bolha Guardiã protects against Faísca Rastreadora homing projectile
    p2.itemState.heldItem = 'bolha-guardia';
    p2.itemState.itemCooldown = 0;
    manager.activateItem(p2, racers, 'p1', emptyEvents());
    expect(p2.itemState.shieldTimer).toBeGreaterThan(5.0);

    p1.itemState.heldItem = 'faisca-rastreadora';
    p1.itemState.itemCooldown = 0;
    p1.sim.x = 0;
    p1.sim.y = 0;
    p1.sim.z = 10;
    p2.sim.x = 0;
    p2.sim.y = 0;
    p2.sim.z = 2;
    manager.activateItem(p1, racers, 'p1', emptyEvents());
    expect(manager.projectiles).toHaveLength(1);

    for (let i = 0; i < 30; i += 1) {
      manager.step(FIXED_TIMESTEP, racers, 'p1');
    }
    expect(manager.projectiles).toHaveLength(0);
    expect(p2.itemState.shieldTimer).toBe(0); // Shield absorbed the seeker!
    expect(p2.sim.hitTimer).toBe(0);

    // 5. Onda de Vento pushes nearby p3 laterally
    const p3InitialVx = p3.sim.vx;
    p1.itemState.heldItem = 'onda-de-vento';
    p1.itemState.itemCooldown = 0;
    manager.activateItem(p1, racers, 'p1', emptyEvents());
    expect(manager.windPulses).toHaveLength(1);
    expect(p3.sim.vx).toBeGreaterThan(p3InitialVx);

    void computeKartPhysicsProfile(getKartById('trilha-raposa'));
  });

  it('places every item box above true track surface elevation across all 8 tracks (CRÍTICO-03)', () => {
    for (const layout of Object.values(TRACK_LAYOUTS)) {
      const manager = new ItemWorldManager(layout);
      expect(manager.boxes.length).toBeGreaterThan(0);
      for (const box of manager.boxes) {
        const q = projectPointOntoTrack(layout, box.position.x, box.position.z, box.position.y);
        expect(box.position.y).toBeGreaterThanOrEqual(q.groundHeight + 0.5);
      }
    }
  });
});
