import { DIFFICULTY_CONFIG } from '../core/constants';
import type { Difficulty } from '../core/types';
import type { HomingProjectile, RacerItemSlotState, WorldHazard } from '../items/itemSystem';
import type { KartInputState, KartSimState } from '../physics/kartController';
import {
  type TrackLayoutDef,
  type TrackPointQuery,
  evaluateMovingHazardPos,
} from '../tracks/trackGeometry';

export interface AiDriverState {
  laneOffset: number;
  shortcutTendency: number;
  stuckTimer: number;
  itemWaitTimer: number;
  driftSign: -1 | 0 | 1;
}

export function createAiDriverState(slotIndex: number): AiDriverState {
  const laneOffsets = [-3.6, -2.1, -0.7, 0.8, 2.2, 3.6, -1.4, 1.4];
  return {
    laneOffset: laneOffsets[slotIndex % laneOffsets.length],
    shortcutTendency: slotIndex % 2 === 0 ? 0.85 : 0.35,
    stuckTimer: 0,
    itemWaitTimer: 0.6 + (slotIndex % 3) * 0.45,
    driftSign: 0,
  };
}

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface AiPerceptionContext {
  layout: TrackLayoutDef;
  difficulty: Difficulty;
  selfId: string;
  selfSim: KartSimState;
  selfTrackQuery: TrackPointQuery;
  selfItem: RacerItemSlotState;
  selfRank: number;
  otherKarts: ReadonlyArray<{ id: string; sim: KartSimState }>;
  hazards: readonly WorldHazard[];
  incomingProjectiles: readonly HomingProjectile[];
  raceTimeSec?: number;
  dt: number;
}

export function computeAiKartInput(
  aiState: AiDriverState,
  ctx: AiPerceptionContext,
): KartInputState {
  const diffCfg = DIFFICULTY_CONFIG[ctx.difficulty];
  const { layout, selfSim, selfTrackQuery } = ctx;
  const samples = layout.samples;
  const n = samples.length;

  // Stuck detection & authentic recovery trigger
  if (selfSim.recoverTimer <= 0 && Math.abs(selfSim.forwardSpeed) < 2.8) {
    aiState.stuckTimer += ctx.dt;
  } else {
    aiState.stuckTimer = 0;
  }
  const needsRecover = aiState.stuckTimer > 2.2;
  if (needsRecover) {
    aiState.stuckTimer = 0;
  }

  // Choose target point on an actual nearby shortcut based on its real entryS/exitS (ALTO-01)
  let targetX: number;
  let targetZ: number;
  let activeShortcutTarget: { x: number; z: number } | null = null;

  if (ctx.difficulty !== 'easy' && aiState.shortcutTendency > 0.5 && layout.shortcuts.length > 0) {
    const curS = selfTrackQuery.nearestSample.s;
    const totalLen = Math.max(1, layout.totalLength);
    for (const sc of layout.shortcuts) {
      if (sc.samples.length < 2) continue;
      // Signed circular delta from shortcut entryS to current kart s
      let deltaFromEntry = curS - sc.entryS;
      if (deltaFromEntry > totalLen * 0.5) deltaFromEntry -= totalLen;
      if (deltaFromEntry < -totalLen * 0.5) deltaFromEntry += totalLen;

      // Circular span of the shortcut along main track
      const span = ((sc.exitS - sc.entryS) % totalLen + totalLen) % totalLen;
      const approachingEntry = deltaFromEntry >= -26 && deltaFromEntry <= Math.max(18, span * 0.85);

      if (selfTrackQuery.onShortcut || approachingEntry) {
        let bestIdx = 0;
        let bestDistSq = Infinity;
        for (let idx = 0; idx < sc.samples.length; idx += 1) {
          const sp = sc.samples[idx].point;
          const dSq = (sp.x - selfSim.x) ** 2 + (sp.z - selfSim.z) ** 2;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = idx;
          }
        }
        // Only engage if the shortcut is actually within sensible proximity and not already exited
        if (bestIdx < sc.samples.length - 2 && (selfTrackQuery.onShortcut || bestDistSq < 36 * 36)) {
          const targetIdx = Math.min(sc.samples.length - 1, bestIdx + 4);
          const pt = sc.samples[targetIdx].point;
          activeShortcutTarget = { x: pt.x, z: pt.z };
          break;
        }
      }
    }
  }

  if (activeShortcutTarget) {
    targetX = activeShortcutTarget.x;
    targetZ = activeShortcutTarget.z;
  } else {
    const lookAheadSteps = ctx.difficulty === 'hard' ? 7 : ctx.difficulty === 'normal' ? 8 : 10;
    const targetSample = samples[(selfTrackQuery.nearestSample.index + lookAheadSteps) % n];
    const farSample = samples[(selfTrackQuery.nearestSample.index + lookAheadSteps + 9) % n];
    void farSample;

    let desiredLateral = aiState.laneOffset * (1 - diffCfg.aiLinePrecision * 0.45);

    // Avoid slower karts immediately ahead (overtaking lane shift)
    for (const other of ctx.otherKarts) {
      if (other.id === ctx.selfId) continue;
      const dx = other.sim.x - selfSim.x;
      const dz = other.sim.z - selfSim.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 8.5) {
        const forwardDot =
          dx * -Math.sin(selfSim.yaw) + dz * -Math.cos(selfSim.yaw);
        if (forwardDot > 0.5) {
          const rightDot = dx * Math.cos(selfSim.yaw) - dz * Math.sin(selfSim.yaw);
          desiredLateral += rightDot >= 0 ? -3.0 : 3.0;
        }
      }
    }

    // Avoid deployed Névoa Prisma traps
    for (const haz of ctx.hazards) {
      const dx = haz.x - selfSim.x;
      const dz = haz.z - selfSim.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 14) {
        const rightDot = dx * Math.cos(selfSim.yaw) - dz * Math.sin(selfSim.yaw);
        desiredLateral += rightDot >= 0 ? -3.4 : 3.4;
      }
    }

    // Avoid sweeping track hazards (Cidade Neon barriers / Fortaleza storm gates)
    if (layout.movingHazards.length > 0) {
      const timeSec = ctx.raceTimeSec ?? 0;
      for (const mh of layout.movingHazards) {
        const pos = evaluateMovingHazardPos(mh, timeSec);
        const dx = pos.x - selfSim.x;
        const dz = pos.z - selfSim.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 18) {
          const rightDot = dx * Math.cos(selfSim.yaw) - dz * Math.sin(selfSim.yaw);
          desiredLateral += rightDot >= 0 ? -4.2 : 4.2;
        }
      }
    }

    const clampedLat = Math.max(
      -(layout.halfWidth - 1.5),
      Math.min(layout.halfWidth - 1.5, desiredLateral),
    );
    targetX = targetSample.point.x + targetSample.right.x * clampedLat;
    targetZ = targetSample.point.z + targetSample.right.z * clampedLat;
  }

  const desiredYaw = Math.atan2(-(targetX - selfSim.x), -(targetZ - selfSim.z));
  const yawError = normalizeAngle(desiredYaw - selfSim.yaw);
  // yaw > 0 turns LEFT (steer < 0), yaw < 0 turns RIGHT (steer > 0)
  const rawSteer = -yawError / 0.65;
  const steer = Math.max(-1, Math.min(1, rawSteer));

  // Corner curvature ahead for authentic braking & 3-tier drifting
  const nearTangent = selfTrackQuery.nearestSample.tangent;
  const cornerSample = samples[(selfTrackQuery.nearestSample.index + 11) % n];
  const cornerTurnDot =
    nearTangent.x * cornerSample.tangent.x + nearTangent.z * cornerSample.tangent.z;
  const sharpTurnAhead = Math.abs(yawError) > 0.34 || cornerTurnDot < 0.84;

  const shouldDrift =
    sharpTurnAhead &&
    selfSim.forwardSpeed > 18 &&
    diffCfg.aiDriftSkill > 0.55 &&
    Math.abs(steer) > 0.42 &&
    selfSim.driftChargeSeconds < 1.85; // Release drift to unleash Mini-Turbo!

  // Throttle scaled by difficulty profile (no impossible speed cheats!)
  let throttle = diffCfg.aiSpeedFactor;
  let brake = 0;
  if (Math.abs(yawError) > 1.15 && selfSim.forwardSpeed > 18) {
    throttle = 0.25;
    brake = 0.5;
  }

  // Tactical item usage
  let useItem = false;
  if (ctx.selfItem.heldItem && ctx.selfItem.rouletteTimer <= 0 && ctx.selfItem.itemCooldown <= 0) {
    aiState.itemWaitTimer -= ctx.dt;
    const incomingDanger = ctx.incomingProjectiles.some(
      (p) => p.targetId === ctx.selfId && Math.hypot(p.x - selfSim.x, p.z - selfSim.z) < 22,
    );
    const rivalClose = ctx.otherKarts.some(
      (k) => k.id !== ctx.selfId && Math.hypot(k.sim.x - selfSim.x, k.sim.z - selfSim.z) < 7.5,
    );

    if (
      incomingDanger &&
      (ctx.selfItem.heldItem === 'bolha-guardia' ||
        ctx.selfItem.heldItem === 'cristal-de-salto' ||
        ctx.selfItem.heldItem === 'onda-de-vento')
    ) {
      useItem = true;
    } else if (aiState.itemWaitTimer <= 0) {
      if (ctx.selfItem.heldItem === 'onda-de-vento' && rivalClose) {
        useItem = true;
      } else if (ctx.selfItem.heldItem !== 'onda-de-vento' || ctx.selfRank > 1) {
        useItem = Math.random() < diffCfg.aiItemAggression;
      }
      aiState.itemWaitTimer = 1.2;
    }
  } else {
    aiState.itemWaitTimer = 0.75;
  }

  return {
    throttle,
    brake,
    steer,
    drift: shouldDrift,
    useItem,
    recover: needsRecover,
  };
}
