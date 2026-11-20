import { ITEMS, ITEMS_BY_ID } from '../../data/items';
import type { ItemId } from '../core/types';
import { type KartSimState, triggerKartBoost } from '../physics/kartController';
import {
  type TrackLayoutDef,
  type TrackVec3,
  projectPointOntoTrack,
} from '../tracks/trackGeometry';

export interface ItemBoxState {
  id: string;
  position: TrackVec3;
  active: boolean;
  respawnTimer: number;
}

export interface WorldHazard {
  id: string;
  itemId: 'nevoa-prisma';
  ownerId: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  age: number;
  ttl: number;
}

export interface HomingProjectile {
  id: string;
  itemId: 'faisca-rastreadora';
  ownerId: string;
  targetId: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  age: number;
  ttl: number;
}

export interface WindPulseEvent {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  age: number;
  maxAge: number;
}

export interface RacerItemSlotState {
  heldItem: ItemId | null;
  rouletteTimer: number;
  rouletteDisplayItem: ItemId | null;
  shieldTimer: number;
  hazardSlowTimer: number;
  itemCooldown: number;
}

export interface ItemRacerAdapter {
  id: string;
  rank: number;
  sim: KartSimState;
  itemState: RacerItemSlotState;
}

export interface ItemStepEvents {
  pickedUpByPlayer: boolean;
  usedByPlayer: ItemId | null;
  playerHit: boolean;
  playerShieldBlocked: boolean;
}

const ITEM_ORDER: readonly ItemId[] = ITEMS.map((item) => item.id);
const ITEM_BOX_RADIUS = 2.05;
const ITEM_BOX_RESPAWN_SEC = 4.5;
const ROULETTE_DURATION_SEC = 0.85;

export function createRacerItemState(): RacerItemSlotState {
  return {
    heldItem: null,
    rouletteTimer: 0,
    rouletteDisplayItem: null,
    shieldTimer: 0,
    hazardSlowTimer: 0,
    itemCooldown: 0,
  };
}

/**
 * Selects an item weighted by racer rank (1st..8th) without artificial guaranteed rubber-banding.
 */
export function rollItemForRank(rank1to8: number, rng: () => number = Math.random): ItemId {
  const rankIdx = Math.max(0, Math.min(7, Math.round(rank1to8) - 1));
  let totalWeight = 0;
  for (const item of ITEMS) {
    totalWeight += item.positionWeights[rankIdx];
  }

  let threshold = rng() * totalWeight;
  for (const item of ITEMS) {
    threshold -= item.positionWeights[rankIdx];
    if (threshold <= 0) {
      return item.id;
    }
  }
  return ITEMS[0].id;
}

export class ItemWorldManager {
  public readonly boxes: ItemBoxState[] = [];
  public hazards: WorldHazard[] = [];
  public projectiles: HomingProjectile[] = [];
  public windPulses: WindPulseEvent[] = [];
  private readonly layout: TrackLayoutDef;
  private seq = 0;

  constructor(layout: TrackLayoutDef) {
    this.layout = layout;
    layout.itemBoxZones.forEach((row, rowIdx) => {
      row.forEach((pos, colIdx) => {
        this.boxes.push({
          id: `ibox_${rowIdx}_${colIdx}`,
          position: { ...pos },
          active: true,
          respawnTimer: 0,
        });
      });
    });
  }

  public reset(): void {
    for (const box of this.boxes) {
      box.active = true;
      box.respawnTimer = 0;
    }
    this.hazards = [];
    this.projectiles = [];
    this.windPulses = [];
    this.seq = 0;
  }

  public activateItem(
    user: ItemRacerAdapter,
    allRacers: readonly ItemRacerAdapter[],
    playerId: string,
    events: ItemStepEvents,
  ): boolean {
    const slot = user.itemState;
    if (!slot.heldItem || slot.rouletteTimer > 0 || slot.itemCooldown > 0) {
      return false;
    }

    const itemId = slot.heldItem;
    const def = ITEMS_BY_ID[itemId];
    slot.heldItem = null;
    slot.itemCooldown = def.cooldownSeconds;

    if (user.id === playerId) {
      events.usedByPlayer = itemId;
    }

    const fx = -Math.sin(user.sim.yaw);
    const fz = -Math.cos(user.sim.yaw);

    switch (itemId) {
      case 'pulso-solar': {
        triggerKartBoost(user.sim, def.durationSeconds, 1.34, 'Pulso Solar');
        break;
      }
      case 'bolha-guardia': {
        slot.shieldTimer = Math.max(slot.shieldTimer, def.durationSeconds);
        break;
      }
      case 'nevoa-prisma': {
        this.seq += 1;
        this.hazards.push({
          id: `haz_${this.seq}`,
          itemId: 'nevoa-prisma',
          ownerId: user.id,
          x: user.sim.x - fx * 3.1,
          y: user.sim.y + 0.3,
          z: user.sim.z - fz * 3.1,
          radius: 2.75,
          age: 0,
          ttl: def.durationSeconds,
        });
        break;
      }
      case 'faisca-rastreadora': {
        // Target the racer directly ahead in standings (or closest ahead if rank 1)
        const aheadTarget =
          allRacers.find((r) => r.id !== user.id && r.rank === user.rank - 1) ??
          allRacers.find((r) => r.id !== user.id && r.rank === 1) ??
          allRacers.find((r) => r.id !== user.id) ??
          null;

        this.seq += 1;
        this.projectiles.push({
          id: `proj_${this.seq}`,
          itemId: 'faisca-rastreadora',
          ownerId: user.id,
          targetId: aheadTarget?.id ?? null,
          x: user.sim.x + fx * 2.4,
          y: user.sim.y + 0.6,
          z: user.sim.z + fz * 2.4,
          yaw: user.sim.yaw,
          speed: 48,
          age: 0,
          ttl: def.durationSeconds,
        });
        break;
      }
      case 'onda-de-vento': {
        const waveRadius = 9.5;
        this.seq += 1;
        this.windPulses.push({
          id: `wind_${this.seq}`,
          ownerId: user.id,
          x: user.sim.x,
          y: user.sim.y + 0.6,
          z: user.sim.z,
          radius: waveRadius,
          age: 0,
          maxAge: 0.65,
        });

        // Deflect any incoming seeker projectiles near the user!
        this.projectiles = this.projectiles.filter((proj) => {
          if (proj.ownerId === user.id) return true;
          if (Math.abs(proj.y - user.sim.y) > 2.8) return true;
          const dist = Math.hypot(proj.x - user.sim.x, proj.z - user.sim.z);
          return dist > waveRadius;
        });

        // Push nearby unshielded rivals away from the user (with vertical separation check)
        for (const rival of allRacers) {
          if (rival.id === user.id) continue;
          if (Math.abs(rival.sim.y - user.sim.y) > 2.4) continue;
          const dx = rival.sim.x - user.sim.x;
          const dz = rival.sim.z - user.sim.z;
          const dist = Math.hypot(dx, dz);
          if (dist < waveRadius && dist > 0.01) {
            if (rival.itemState.shieldTimer > 0) {
              rival.itemState.shieldTimer = 0;
              if (rival.id === playerId) events.playerShieldBlocked = true;
              continue;
            }
            const strength = (1 - dist / waveRadius) * 18;
            rival.sim.vx += (dx / dist) * strength;
            rival.sim.vz += (dz / dist) * strength;
            rival.sim.forwardSpeed *= 0.84;
            rival.sim.hitTimer = Math.max(rival.sim.hitTimer, 0.45);
            if (rival.id === playerId) events.playerHit = true;
          }
        }
        break;
      }
      case 'cristal-de-salto': {
        user.sim.vy = Math.max(user.sim.vy, 13.5);
        user.sim.grounded = false;
        triggerKartBoost(user.sim, def.durationSeconds, 1.14, 'Cristal de Salto');
        break;
      }
    }

    return true;
  }

  public step(
    dt: number,
    racers: readonly ItemRacerAdapter[],
    playerId: string,
    rng: () => number = Math.random,
  ): ItemStepEvents {
    const events: ItemStepEvents = {
      pickedUpByPlayer: false,
      usedByPlayer: null,
      playerHit: false,
      playerShieldBlocked: false,
    };

    // 1. Respawn & check item box pickups
    for (const box of this.boxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.respawnTimer = 0;
        }
        continue;
      }

      for (const racer of racers) {
        if (Math.abs(racer.sim.y - box.position.y) > 2.4) continue;
        const dist = Math.hypot(racer.sim.x - box.position.x, racer.sim.z - box.position.z);
        if (dist <= ITEM_BOX_RADIUS) {
          box.active = false;
          box.respawnTimer = ITEM_BOX_RESPAWN_SEC;

          if (!racer.itemState.heldItem && racer.itemState.rouletteTimer <= 0) {
            racer.itemState.heldItem = rollItemForRank(racer.rank, rng);
            racer.itemState.rouletteTimer = ROULETTE_DURATION_SEC;
            racer.itemState.rouletteDisplayItem = racer.itemState.heldItem;
            if (racer.id === playerId) {
              events.pickedUpByPlayer = true;
            }
          }
          break;
        }
      }
    }

    // 2. Tick racer item timers & roulette display
    for (const racer of racers) {
      const slot = racer.itemState;
      slot.shieldTimer = Math.max(0, slot.shieldTimer - dt);
      slot.hazardSlowTimer = Math.max(0, slot.hazardSlowTimer - dt);
      slot.itemCooldown = Math.max(0, slot.itemCooldown - dt);

      if (slot.rouletteTimer > 0) {
        slot.rouletteTimer = Math.max(0, slot.rouletteTimer - dt);
        if (slot.rouletteTimer === 0) {
          slot.rouletteDisplayItem = slot.heldItem;
        } else {
          const cycleIdx = Math.floor(slot.rouletteTimer * 14) % ITEM_ORDER.length;
          slot.rouletteDisplayItem = ITEM_ORDER[cycleIdx];
        }
      }
    }

    // 3. Step Névoa Prisma hazards
    const remainingHazards: WorldHazard[] = [];
    for (const haz of this.hazards) {
      haz.age += dt;
      haz.ttl -= dt;
      if (haz.ttl <= 0) continue;

      let triggered = false;
      for (const racer of racers) {
        if (racer.id === haz.ownerId && haz.age < 0.7) continue; // brief owner grace period
        const dist = Math.hypot(racer.sim.x - haz.x, racer.sim.z - haz.z);
        const verticalOk = Math.abs(racer.sim.y - haz.y) <= 2.1;
        if (dist <= haz.radius && verticalOk) {
          triggered = true;
          if (racer.itemState.shieldTimer > 0) {
            racer.itemState.shieldTimer = 0;
            if (racer.id === playerId) events.playerShieldBlocked = true;
          } else {
            racer.itemState.hazardSlowTimer = 1.6;
            racer.sim.forwardSpeed *= 0.68;
            racer.sim.hitTimer = Math.max(racer.sim.hitTimer, 0.55);
            if (racer.id === playerId) events.playerHit = true;
          }
          break;
        }
      }
      if (!triggered) {
        remainingHazards.push(haz);
      }
    }
    this.hazards = remainingHazards;

    // 4. Step Faísca Rastreadora homing projectiles
    const remainingProjectiles: HomingProjectile[] = [];
    const samples = this.layout.samples;
    for (const proj of this.projectiles) {
      proj.age += dt;
      proj.ttl -= dt;
      if (proj.ttl <= 0) continue;

      const projQuery = projectPointOntoTrack(this.layout, proj.x, proj.z, proj.y);
      const target = racers.find((r) => r.id === proj.targetId);
      if (target) {
        const dxToTarget = target.sim.x - proj.x;
        const dzToTarget = target.sim.z - proj.z;
        const distToTarget = Math.hypot(dxToTarget, dzToTarget);

        // Follow track spline while far away so projectile never cuts through walls/terrain;
        // lock directly onto target once within close range (18m).
        let aimX = target.sim.x;
        let aimZ = target.sim.z;
        if (distToTarget > 18 && samples.length > 0) {
          const aheadIdx = (projQuery.nearestSample.index + 5) % samples.length;
          aimX = samples[aheadIdx].point.x;
          aimZ = samples[aheadIdx].point.z;
        }

        const desiredYaw = Math.atan2(-(aimX - proj.x), -(aimZ - proj.z));
        let diff = desiredYaw - proj.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        proj.yaw += Math.max(-4.2 * dt, Math.min(4.2 * dt, diff));
      }

      // Hug track surface height so jumping karts (Cristal de Salto / ramps) cleanly vault over
      const targetGroundY = projQuery.groundHeight + 0.6;
      proj.y += (targetGroundY - proj.y) * Math.min(1, dt * 10);

      proj.x += -Math.sin(proj.yaw) * proj.speed * dt;
      proj.z += -Math.cos(proj.yaw) * proj.speed * dt;

      let hitSomeone = false;
      for (const racer of racers) {
        if (racer.id === proj.ownerId && proj.age < 0.5) continue;
        const dist = Math.hypot(racer.sim.x - proj.x, racer.sim.z - proj.z);
        // Players jumping high with Cristal de Salto or ramps can vault cleanly over the spark!
        const verticalClear = Math.abs(racer.sim.y - (proj.y - 0.6)) > 1.4;
        if (dist <= 1.85 && !verticalClear) {
          hitSomeone = true;
          if (racer.itemState.shieldTimer > 0) {
            racer.itemState.shieldTimer = 0;
            if (racer.id === playerId) events.playerShieldBlocked = true;
          } else {
            racer.sim.forwardSpeed *= 0.42;
            racer.sim.hitTimer = Math.max(racer.sim.hitTimer, 1.15);
            racer.sim.boostTimer = 0;
            if (racer.id === playerId) events.playerHit = true;
          }
          break;
        }
      }

      if (!hitSomeone) {
        remainingProjectiles.push(proj);
      }
    }
    this.projectiles = remainingProjectiles;

    // 5. Step expanding wind pulse visual rings
    this.windPulses = this.windPulses
      .map((w) => ({ ...w, age: w.age + dt }))
      .filter((w) => w.age < w.maxAge);

    return events;
  }
}
