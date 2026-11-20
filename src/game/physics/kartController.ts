import { DRIFT_TIERS, SURFACE_PROPERTIES } from '../core/constants';
import type { CharacterDef, KartDef, SurfaceType } from '../core/types';
import {
  getCheckpointPose,
  type TrackLayoutDef,
  type TrackPointQuery,
  yawFromTangent,
} from '../tracks/trackGeometry';

export interface KartInputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  drift: boolean;
  useItem: boolean;
  recover: boolean;
}

export interface KartPhysicsProfile {
  topSpeedMs: number;
  accelMs2: number;
  brakeMs2: number;
  reverseMaxMs: number;
  turnRateRadS: number;
  gripFactor: number;
  massKg: number;
  driftChargeRate: number;
  recoveryBoostFactor: number;
}

export interface KartSimState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  forwardSpeed: number;
  steerAngle: number;
  grounded: boolean;
  surface: SurfaceType;
  driftActive: boolean;
  driftDir: -1 | 0 | 1; // +1 = drifting left (+yaw), -1 = drifting right (-yaw)
  driftButtonHeld: boolean;
  driftChargeSeconds: number;
  driftTier: 0 | 1 | 2 | 3;
  boostTimer: number;
  boostMultiplier: number;
  boostLabel: string | null;
  hitTimer: number;
  recoverTimer: number;
  wheelSpinAngle: number;
  suspensionOffset: number;
  suspensionVel: number;
  chassisPitch: number;
  chassisRoll: number;
  visualSlipYaw: number;
  boostPadCooldown: number;
  rampCooldown: number;
  distanceAlongTrack: number;
  lateralOffset: number;
  onShortcut: boolean;
  lastSafeCheckpointIndex: number;
  wallStuckTimer: number;
  wallCollisionThisStep: boolean;
  totalDriftsCompleted: number;
  totalTurbosTriggered: number;
}

function normalizeAngle(rad: number): number {
  let a = (rad + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

const GRAVITY = 28;
const HOP_IMPULSE = 4.8;
const MIN_DRIFT_SPEED = 9.5;

function clampStat(val: number): number {
  return Math.max(1, Math.min(10, val));
}

export function computeKartPhysicsProfile(
  kart: KartDef,
  character?: CharacterDef,
): KartPhysicsProfile {
  const b = character?.statBonuses ?? {};
  const topSpeed = clampStat(kart.attributes.topSpeed + (b.topSpeed ?? 0));
  const acceleration = clampStat(kart.attributes.acceleration + (b.acceleration ?? 0));
  const braking = clampStat(kart.attributes.braking + (b.braking ?? 0));
  const handling = clampStat(kart.attributes.handling + (b.handling ?? 0));
  const grip = clampStat(kart.attributes.grip + (b.grip ?? 0));
  const mass = clampStat(kart.attributes.mass + (b.mass ?? 0));
  const driftEfficiency = clampStat(kart.attributes.driftEfficiency + (b.driftEfficiency ?? 0));
  const recovery = clampStat(kart.attributes.recovery + (b.recovery ?? 0));

  return {
    topSpeedMs: 31 + (topSpeed / 10) * 8.2,
    accelMs2: 17 + (acceleration / 10) * 11,
    brakeMs2: 26 + (braking / 10) * 14,
    reverseMaxMs: 11.5,
    turnRateRadS: 1.55 + (handling / 10) * 0.95,
    gripFactor: 0.72 + (grip / 10) * 0.34,
    massKg: 85 + mass * 12,
    driftChargeRate: 0.76 + (driftEfficiency / 10) * 0.48,
    recoveryBoostFactor: 0.75 + (recovery / 10) * 0.45,
  };
}

export function createInitialKartState(
  x: number,
  y: number,
  z: number,
  yaw: number,
): KartSimState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    forwardSpeed: 0,
    steerAngle: 0,
    grounded: true,
    surface: 'asphalt',
    driftActive: false,
    driftDir: 0,
    driftButtonHeld: false,
    driftChargeSeconds: 0,
    driftTier: 0,
    boostTimer: 0,
    boostMultiplier: 1,
    boostLabel: null,
    hitTimer: 0,
    recoverTimer: 0,
    wheelSpinAngle: 0,
    suspensionOffset: 0,
    suspensionVel: 0,
    chassisPitch: 0,
    chassisRoll: 0,
    visualSlipYaw: 0,
    boostPadCooldown: 0,
    rampCooldown: 0,
    distanceAlongTrack: 0,
    lateralOffset: 0,
    onShortcut: false,
    lastSafeCheckpointIndex: 0,
    wallStuckTimer: 0,
    wallCollisionThisStep: false,
    totalDriftsCompleted: 0,
    totalTurbosTriggered: 0,
  };
}

export function triggerKartBoost(
  state: KartSimState,
  durationSeconds: number,
  multiplier: number,
  label: string,
): void {
  if (multiplier >= state.boostMultiplier || state.boostTimer <= 0.15) {
    state.boostMultiplier = multiplier;
    state.boostLabel = label;
  }
  state.boostTimer = Math.max(state.boostTimer, durationSeconds);
  state.totalTurbosTriggered += 1;
}

export function beginKartRecovery(
  state: KartSimState,
  layout: TrackLayoutDef,
): void {
  const pose = getCheckpointPose(layout, state.lastSafeCheckpointIndex);
  state.x = pose.position.x;
  state.y = pose.position.y + 0.4;
  state.z = pose.position.z;
  state.yaw = pose.yaw;
  state.vx = 0;
  state.vy = 0;
  state.vz = 0;
  state.forwardSpeed = 0;
  state.driftActive = false;
  state.driftDir = 0;
  state.driftChargeSeconds = 0;
  state.driftTier = 0;
  state.boostTimer = 0;
  state.boostMultiplier = 1;
  state.boostLabel = null;
  state.recoverTimer = 0.55;
  state.wallStuckTimer = 0;
  state.wallCollisionThisStep = false;
  state.visualSlipYaw = 0;
}

function getDriftTierForCharge(chargeSeconds: number): 0 | 1 | 2 | 3 {
  if (chargeSeconds >= DRIFT_TIERS[2].chargeThresholdSeconds) return 3;
  if (chargeSeconds >= DRIFT_TIERS[1].chargeThresholdSeconds) return 2;
  if (chargeSeconds >= DRIFT_TIERS[0].chargeThresholdSeconds) return 1;
  return 0;
}

export function stepKartSimulation(
  state: KartSimState,
  input: KartInputState,
  trackQuery: TrackPointQuery,
  profile: KartPhysicsProfile,
  layout: TrackLayoutDef,
  dt: number,
  canDrive = true,
): void {
  // Cooldowns & timers
  state.boostPadCooldown = Math.max(0, state.boostPadCooldown - dt);
  state.rampCooldown = Math.max(0, state.rampCooldown - dt);
  state.hitTimer = Math.max(0, state.hitTimer - dt);
  state.wallCollisionThisStep = false;
  state.distanceAlongTrack = trackQuery.distanceAlongTrack;
  state.lateralOffset = trackQuery.lateralOffset;
  state.onShortcut = trackQuery.onShortcut;
  state.surface = trackQuery.surface;

  if (state.recoverTimer > 0) {
    state.recoverTimer = Math.max(0, state.recoverTimer - dt);
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
    return;
  }

  // Manual or out-of-bounds recovery without forward exploit
  if (canDrive && (input.recover || trackQuery.outOfBounds || state.y < -8)) {
    beginKartRecovery(state, layout);
    return;
  }

  if (!canDrive) {
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
    state.forwardSpeed = 0;
    state.steerAngle += (input.steer * 0.4 - state.steerAngle) * Math.min(1, dt * 10);
    return;
  }

  if (state.boostTimer > 0) {
    state.boostTimer = Math.max(0, state.boostTimer - dt);
    if (state.boostTimer === 0) {
      state.boostMultiplier = 1;
      state.boostLabel = null;
    }
  }
  if (input.brake > 0.5 && input.throttle <= 0.05 && state.boostTimer > 0) {
    state.boostTimer = 0;
    state.boostMultiplier = 1;
    state.boostLabel = null;
  }

  const surfaceCfg = SURFACE_PROPERTIES[state.surface];
  const boosting = state.boostTimer > 0;
  // Active turbo overrides off-road slowdown (rewards tactical shortcuts!)
  const surfaceSpeedMult = boosting ? Math.max(0.95, surfaceCfg.maxSpeedMultiplier) : surfaceCfg.maxSpeedMultiplier;
  const maxAllowedSpeed = profile.topSpeedMs * surfaceSpeedMult * state.boostMultiplier;

  // Trigger boost pad
  if (trackQuery.activeBoostPad && state.boostPadCooldown <= 0) {
    triggerKartBoost(state, 1.35, 1.28, 'Painel de Impulso');
    state.boostPadCooldown = 0.7;
  }

  // Trigger jump ramp launch
  if (trackQuery.activeRamp && state.rampCooldown <= 0 && state.forwardSpeed > 12 && state.grounded) {
    state.vy = trackQuery.activeRamp.launchImpulse + Math.min(3, state.forwardSpeed * 0.08);
    state.grounded = false;
    state.rampCooldown = 0.65;
  }

  // Smooth steering
  const targetSteer = Math.max(-1, Math.min(1, input.steer));
  state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * 12);

  // Longitudinal speed integration
  if (boosting) {
    const targetBoostSpeed = profile.topSpeedMs * state.boostMultiplier;
    state.forwardSpeed += (targetBoostSpeed - state.forwardSpeed) * Math.min(1, dt * 7.5);
  } else if (input.throttle > 0.05) {
    const accelScale = state.hitTimer > 0 ? profile.recoveryBoostFactor : 1;
    const speedRatio = Math.max(0, state.forwardSpeed / Math.max(1, maxAllowedSpeed));
    const torqueCurve = 1.12 - 0.52 * Math.min(1, speedRatio);
    state.forwardSpeed +=
      input.throttle * profile.accelMs2 * accelScale * torqueCurve * dt;
    if (state.forwardSpeed > maxAllowedSpeed) {
      // Smoothly bleed excess speed down on slower surfaces like grass/sand
      state.forwardSpeed -= Math.min(state.forwardSpeed - maxAllowedSpeed, 22 * dt);
    }
  } else if (input.brake > 0.05) {
    if (state.forwardSpeed > 0.6) {
      state.forwardSpeed = Math.max(0, state.forwardSpeed - input.brake * profile.brakeMs2 * dt);
    } else {
      state.forwardSpeed = Math.max(
        -profile.reverseMaxMs,
        state.forwardSpeed - input.brake * profile.accelMs2 * 0.75 * dt,
      );
    }
  } else {
    // Natural rolling drag based on surface
    const dragDecel = (6.5 + surfaceCfg.drag * 120) * dt;
    if (Math.abs(state.forwardSpeed) <= dragDecel) {
      state.forwardSpeed = 0;
    } else {
      state.forwardSpeed -= Math.sign(state.forwardSpeed) * dragDecel;
    }
  }

  // Drift system (3 tiers) — hop once per Space press, lock drift direction immediately or mid-hop
  const freshDriftPress = input.drift && !state.driftButtonHeld;
  state.driftButtonHeld = input.drift;

  if (input.drift && !state.driftActive && state.forwardSpeed >= MIN_DRIFT_SPEED) {
    if (freshDriftPress && state.grounded) {
      state.vy = Math.max(state.vy, HOP_IMPULSE);
      state.grounded = false;
    }
    if (Math.abs(targetSteer) > 0.15) {
      state.driftActive = true;
      state.driftDir = targetSteer < 0 ? 1 : -1;
      state.driftChargeSeconds = 0;
      state.driftTier = 0;
    }
  } else if (input.drift && state.driftActive) {
    if (state.forwardSpeed < MIN_DRIFT_SPEED * 0.65) {
      state.driftActive = false;
      state.driftDir = 0;
      state.driftChargeSeconds = 0;
      state.driftTier = 0;
    } else {
      // Allow steering from wide arc to tight inward arc during drift
      // driftDir = +1 (left turn): steer = -1 tightens left, steer = +1 widens
      const inwardEffort = state.driftDir === 1 ? -targetSteer : targetSteer;
      const chargeFactor = 0.55 + Math.max(0, inwardEffort) * 0.85;
      state.driftChargeSeconds +=
        dt * profile.driftChargeRate * surfaceCfg.driftChargeMultiplier * chargeFactor;
      state.driftTier = getDriftTierForCharge(state.driftChargeSeconds);

      const driftTurnRate = profile.turnRateRadS * (0.78 + 0.55 * inwardEffort);
      state.yaw += state.driftDir * driftTurnRate * dt;
    }
  } else if (!input.drift && state.driftActive) {
    // Release drift -> trigger Mini-Turbo according to tier!
    if (state.driftTier > 0) {
      const tier = DRIFT_TIERS[state.driftTier - 1];
      triggerKartBoost(state, tier.boostDurationSeconds, tier.speedBonusMultiplier, tier.label);
      state.totalDriftsCompleted += 1;
    }
    state.driftActive = false;
    state.driftDir = 0;
    state.driftChargeSeconds = 0;
    state.driftTier = 0;
  }

  // Normal steering when not in locked drift (keeps minimum turn authority at low speed)
  if (!state.driftActive) {
    const speedNorm = Math.min(1, Math.abs(state.forwardSpeed) / 10);
    const minSteerAuthority = input.throttle > 0.05 || input.brake > 0.05 ? 0.42 : 0.25;
    const effectiveSteerScale = Math.max(speedNorm, minSteerAuthority);
    const reverseSign = state.forwardSpeed < -0.5 ? -1 : 1;
    const gripTurnScale = 0.6 + 0.4 * Math.min(1, surfaceCfg.grip * profile.gripFactor);
    state.yaw +=
      -state.steerAngle *
      profile.turnRateRadS *
      effectiveSteerScale *
      reverseSign *
      gripTurnScale *
      dt;
  }

  // Convert heading + velocity into world velocity (with slight ice/drift lateral momentum)
  const forwardX = -Math.sin(state.yaw);
  const forwardZ = -Math.cos(state.yaw);
  const targetVx = forwardX * state.forwardSpeed;
  const targetVz = forwardZ * state.forwardSpeed;

  const lateralResponsiveness =
    state.driftActive
      ? 6.2
      : Math.max(2.2, 13.5 * surfaceCfg.grip * profile.gripFactor);
  const blend = Math.min(1, lateralResponsiveness * dt);
  state.vx += (targetVx - state.vx) * blend;
  state.vz += (targetVz - state.vz) * blend;

  // Horizontal integration + track boundary containment (arcade wall-slide)
  const stepDx = state.vx * dt;
  const stepDz = state.vz * dt;
  state.x += stepDx;
  state.z += stepDz;

  const sample = trackQuery.nearestSample;
  const postLateral =
    trackQuery.lateralOffset + (stepDx * sample.right.x + stepDz * sample.right.z);
  const maxLateral = trackQuery.wallDistance - 0.95;

  if (!trackQuery.onShortcut && Math.abs(postLateral) > maxLateral) {
    const wallSign = Math.sign(postLateral) || 1;
    const outX = sample.right.x * wallSign;
    const outZ = sample.right.z * wallSign;
    const excess = Math.abs(postLateral) - maxLateral;

    // 1. Clamp strictly back onto playable track width
    state.x -= outX * excess;
    state.z -= outZ * excess;
    state.lateralOffset = wallSign * maxLateral;
    state.wallCollisionThisStep = true;

    // 2. Remove only outward wall-normal velocity so kart slides cleanly along the tangent
    const tLen = Math.hypot(sample.tangent.x, sample.tangent.z) || 1;
    const tx = sample.tangent.x / tLen;
    const tz = sample.tangent.z / tLen;
    const vOut = state.vx * outX + state.vz * outZ;
    if (vOut > 0) {
      state.vx -= outX * (vOut + 0.8);
      state.vz -= outZ * (vOut + 0.8);
    }

    const vTan = state.vx * tx + state.vz * tz;
    const headingX = -Math.sin(state.yaw);
    const headingZ = -Math.cos(state.yaw);
    const intoWallDot = headingX * outX + headingZ * outZ;
    const trackYaw = yawFromTangent(sample.tangent);
    const targetSafeYaw = trackYaw + wallSign * 0.1;

    // 3. Auto-align kart yaw gently away from barrier to prevent 90-deg lockups
    if (intoWallDot > 0.02 && state.forwardSpeed >= -0.5) {
      const diffToSafe = normalizeAngle(targetSafeYaw - state.yaw);
      const alignRate = (3.5 + intoWallDot * 6.5) * dt;
      state.yaw += Math.sign(diffToSafe) * Math.min(Math.abs(diffToSafe), alignRate);

      const projectedForward = Math.max(0, vTan);
      if (intoWallDot > 0.45 && state.forwardSpeed > 14) {
        state.forwardSpeed = Math.max(
          projectedForward * 0.85,
          state.forwardSpeed * (1 - intoWallDot * 0.22),
        );
        if (excess > 0.2 && intoWallDot > 0.65) {
          state.hitTimer = Math.max(state.hitTimer, 0.2);
        }
      } else {
        state.forwardSpeed = Math.max(
          Math.min(state.forwardSpeed, maxAllowedSpeed * 0.92),
          projectedForward * 0.92,
        );
      }
    }

    // 4. Auto-unstick failsafe if holding throttle wedged against barrier for >= 1.0s
    if (input.throttle > 0.1 && Math.abs(vTan) < 2.5) {
      state.wallStuckTimer += dt;
      if (state.wallStuckTimer >= 1.0) {
        state.x -= outX * 1.6;
        state.z -= outZ * 1.6;
        state.lateralOffset = wallSign * Math.max(0, maxLateral - 1.6);
        state.yaw = trackYaw + wallSign * 0.14;
        state.forwardSpeed = Math.max(state.forwardSpeed, 10);
        state.vx = -Math.sin(state.yaw) * state.forwardSpeed;
        state.vz = -Math.cos(state.yaw) * state.forwardSpeed;
        state.wallStuckTimer = 0;
      }
    } else {
      state.wallStuckTimer = Math.max(0, state.wallStuckTimer - dt * 2.5);
    }
  } else {
    state.wallStuckTimer = Math.max(0, state.wallStuckTimer - dt * 3);
  }

  // Vertical motion, ramp & gravity
  const wasGrounded = state.grounded;
  if (!state.grounded || state.y > trackQuery.groundHeight + 0.08) {
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y < trackQuery.groundHeight) {
      if (state.vy <= 0) {
        const impactSpeed = Math.abs(state.vy);
        state.y = trackQuery.groundHeight;
        state.vy = 0;
        state.grounded = true;
        if (!wasGrounded && impactSpeed > 3) {
          state.suspensionVel -= Math.min(2.4, impactSpeed * 0.22);
        }
      } else {
        // Ascending over ramp or uphill slope: follow surface floor without canceling launch vy
        state.y = trackQuery.groundHeight;
      }
    }
  } else {
    state.y = trackQuery.groundHeight;
    state.vy = 0;
    state.grounded = true;
  }

  // Suspension spring-damper for chassis visual bounce
  const springForce = -110 * state.suspensionOffset - 16 * state.suspensionVel;
  state.suspensionVel += springForce * dt;
  state.suspensionOffset = Math.max(
    -0.14,
    Math.min(0.14, state.suspensionOffset + state.suspensionVel * dt),
  );

  // Wheel rotation & chassis body dynamics
  state.wheelSpinAngle = (state.wheelSpinAngle + (state.forwardSpeed / 0.3) * dt) % (Math.PI * 2);

  const targetPitch =
    -trackQuery.slopeY * 0.75 +
    (boosting ? -0.055 : input.brake > 0.1 ? 0.045 : input.throttle > 0.1 ? -0.025 : 0);
  state.chassisPitch += (targetPitch - state.chassisPitch) * Math.min(1, dt * 10);

  const targetRoll = state.driftActive
    ? state.driftDir * 0.14
    : -state.steerAngle * Math.min(1, Math.abs(state.forwardSpeed) / 25) * 0.08;
  state.chassisRoll += (targetRoll - state.chassisRoll) * Math.min(1, dt * 10);

  const targetSlipYaw = state.driftActive ? state.driftDir * 0.32 : 0;
  state.visualSlipYaw += (targetSlipYaw - state.visualSlipYaw) * Math.min(1, dt * 11);
}
