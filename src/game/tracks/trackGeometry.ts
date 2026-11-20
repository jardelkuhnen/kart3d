import type { SurfaceType, TrackId } from '../core/types';

export interface TrackVec3 {
  x: number;
  y: number;
  z: number;
}

export interface TrackSplineSample {
  index: number;
  t: number;
  s: number;
  point: TrackVec3;
  tangent: TrackVec3;
  right: TrackVec3;
  normal: TrackVec3;
  halfWidth: number;
}

export interface SurfaceZoneDef {
  id: string;
  surface: SurfaceType;
  centerS: number;
  length: number;
  lateralMin: number;
  lateralMax: number;
}

export interface BoostPadDef {
  id: string;
  s: number;
  lateralOffset: number;
  position: TrackVec3;
  yaw: number;
  width: number;
  length: number;
}

export interface RampDef {
  id: string;
  s: number;
  lateralOffset: number;
  position: TrackVec3;
  yaw: number;
  width: number;
  length: number;
  height: number;
  launchImpulse: number;
}

export interface CheckpointDef {
  index: number;
  t: number;
  s: number;
  position: TrackVec3;
  tangent: TrackVec3;
  right: TrackVec3;
  yaw: number;
  width: number;
}

export interface ShortcutPathDef {
  id: string;
  surface: SurfaceType;
  halfWidth: number;
  controlPoints: readonly TrackVec3[];
  samples: readonly TrackSplineSample[];
}

export interface TrackPropPlacement {
  kind:
    | 'house'
    | 'lighthouse'
    | 'boat'
    | 'market-stall'
    | 'lantern-post'
    | 'cypress-tree'
    | 'palm-tree'
    | 'chevron-board'
    | 'rock-pillar';
  position: TrackVec3;
  yaw: number;
  scale: number;
  variant?: number;
}

export interface TrackLayoutDef {
  id: TrackId;
  name: string;
  controlPoints: readonly TrackVec3[];
  sampleCount: number;
  halfWidth: number;
  wallMargin: number;
  totalLength: number;
  samples: readonly TrackSplineSample[];
  checkpoints: readonly CheckpointDef[];
  surfaceZones: readonly SurfaceZoneDef[];
  boostPads: readonly BoostPadDef[];
  ramps: readonly RampDef[];
  shortcuts: readonly ShortcutPathDef[];
  tunnelRange: { sStart: number; sEnd: number } | null;
  bridgeRange: { sStart: number; sEnd: number } | null;
  itemBoxZones: readonly TrackVec3[][];
  aiWaypoints: readonly TrackVec3[];
  introCameraPoints: readonly TrackVec3[];
  startGridSlots: readonly { position: TrackVec3; yaw: number }[];
  scenery: readonly TrackPropPlacement[];
}

export interface TrackPointQuery {
  nearestSample: TrackSplineSample;
  lateralOffset: number;
  distanceAlongTrack: number;
  groundHeight: number;
  slopeY: number;
  surface: SurfaceType;
  wallDistance: number;
  outOfBounds: boolean;
  onShortcut: boolean;
  activeBoostPad: BoostPadDef | null;
  activeRamp: RampDef | null;
}

function catmullRomValue(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function evaluateCatmullRom(
  controlPoints: readonly TrackVec3[],
  tNorm: number,
  closed = true,
): TrackVec3 {
  const n = controlPoints.length;
  const wrapped = closed ? ((tNorm % 1) + 1) % 1 : Math.max(0, Math.min(1, tNorm));
  const scaled = wrapped * (closed ? n : n - 1);
  const seg = Math.min(closed ? n - 1 : n - 2, Math.floor(scaled));
  const localT = scaled - seg;

  const idx = (offset: number): number => {
    const raw = seg + offset;
    if (closed) {
      return ((raw % n) + n) % n;
    }
    return Math.max(0, Math.min(n - 1, raw));
  };

  const p0 = controlPoints[idx(-1)];
  const p1 = controlPoints[idx(0)];
  const p2 = controlPoints[idx(1)];
  const p3 = controlPoints[idx(2)];

  return {
    x: catmullRomValue(p0.x, p1.x, p2.x, p3.x, localT),
    y: catmullRomValue(p0.y, p1.y, p2.y, p3.y, localT),
    z: catmullRomValue(p0.z, p1.z, p2.z, p3.z, localT),
  };
}

function normalizeVec3(v: TrackVec3): TrackVec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-8) return { x: 0, y: 0, z: -1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function crossVec3(a: TrackVec3, b: TrackVec3): TrackVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function sampleTrackSpline(
  controlPoints: readonly TrackVec3[],
  sampleCount: number,
  halfWidth: number,
  closed = true,
): { samples: TrackSplineSample[]; totalLength: number } {
  const rawPoints: TrackVec3[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / (closed ? sampleCount : sampleCount - 1);
    rawPoints.push(evaluateCatmullRom(controlPoints, t, closed));
  }

  const samples: TrackSplineSample[] = [];
  let accumS = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const curr = rawPoints[i];
    if (i > 0) {
      const prev = rawPoints[i - 1];
      accumS += Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z);
    }

    const prevPt = rawPoints[closed ? (i - 1 + sampleCount) % sampleCount : Math.max(0, i - 1)];
    const nextPt = rawPoints[closed ? (i + 1) % sampleCount : Math.min(sampleCount - 1, i + 1)];
    const tangent = normalizeVec3({
      x: nextPt.x - prevPt.x,
      y: nextPt.y - prevPt.y,
      z: nextPt.z - prevPt.z,
    });
    // In +Y up, -Z forward, +X right: forward x up = right
    const right = normalizeVec3(crossVec3(tangent, { x: 0, y: 1, z: 0 }));
    const normal = normalizeVec3(crossVec3(right, tangent));

    samples.push({
      index: i,
      t: i / sampleCount,
      s: accumS,
      point: curr,
      tangent,
      right,
      normal,
      halfWidth,
    });
  }

  let totalLength = accumS;
  if (closed && sampleCount > 1) {
    const last = rawPoints[sampleCount - 1];
    const first = rawPoints[0];
    totalLength += Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z);
  }

  return { samples, totalLength };
}

export function getSampleAtDistance(
  samples: readonly TrackSplineSample[],
  totalLength: number,
  targetS: number,
): TrackSplineSample {
  const s = ((targetS % totalLength) + totalLength) % totalLength;
  let best = samples[0];
  let bestDiff = Infinity;
  for (const sample of samples) {
    const diff = Math.abs(sample.s - s);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = sample;
    }
  }
  return best;
}

export function yawFromTangent(tangent: TrackVec3): number {
  // Kart forward is -Z at yaw = 0; rotating around +Y maps (0,0,-1) -> (-sin(yaw), 0, -cos(yaw))
  return Math.atan2(-tangent.x, -tangent.z);
}

export function offsetPointOnTrack(
  sample: TrackSplineSample,
  lateralOffset: number,
  yOffset = 0,
): TrackVec3 {
  return {
    x: sample.point.x + sample.right.x * lateralOffset,
    y: sample.point.y + yOffset,
    z: sample.point.z + sample.right.z * lateralOffset,
  };
}

function findNearestSample(
  samples: readonly TrackSplineSample[],
  x: number,
  z: number,
  yHint?: number,
): { sample: TrackSplineSample; distSq: number; lateral: number } {
  let best = samples[0];
  let bestScore = Infinity;
  let bestDistSq = Infinity;

  for (const sample of samples) {
    const dx = x - sample.point.x;
    const dz = z - sample.point.z;
    const dy = yHint !== undefined ? (yHint - sample.point.y) * 0.45 : 0;
    const distSq = dx * dx + dz * dz;
    const score = distSq + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      bestDistSq = distSq;
      best = sample;
    }
  }

  const dx = x - best.point.x;
  const dz = z - best.point.z;
  const lateral = dx * best.right.x + dz * best.right.z;

  return { sample: best, distSq: bestDistSq, lateral };
}

export function projectPointOntoTrack(
  layout: TrackLayoutDef,
  x: number,
  z: number,
  yHint?: number,
): TrackPointQuery {
  const main = findNearestSample(layout.samples, x, z, yHint);
  let activeSample = main.sample;
  let lateralOffset = main.lateral;
  let groundHeight = main.sample.point.y;
  let onShortcut = false;
  let surface: SurfaceType = 'asphalt';
  let wallDistance = layout.wallMargin;

  // Check if the racer is currently on an explicit shortcut path
  for (const shortcut of layout.shortcuts) {
    const sc = findNearestSample(shortcut.samples, x, z, yHint);
    if (Math.abs(sc.lateral) <= shortcut.halfWidth + 1.2 && sc.distSq < main.distSq + 25) {
      onShortcut = true;
      activeSample = sc.sample;
      lateralOffset = sc.lateral;
      groundHeight = sc.sample.point.y;
      surface = shortcut.surface;
      wallDistance = shortcut.halfWidth + 2.4;
      break;
    }
  }

  if (!onShortcut) {
    const absLat = Math.abs(lateralOffset);
    if (absLat <= layout.halfWidth) {
      surface = 'asphalt';
    } else if (absLat <= layout.halfWidth + 1.3) {
      surface = 'asphalt'; // Raised curb edge
    } else {
      surface = 'grass';
    }

    for (const zone of layout.surfaceZones) {
      const ds = Math.abs(main.sample.s - zone.centerS);
      const wrappedDs = Math.min(ds, layout.totalLength - ds);
      if (
        wrappedDs <= zone.length * 0.5 &&
        lateralOffset >= zone.lateralMin &&
        lateralOffset <= zone.lateralMax
      ) {
        surface = zone.surface;
      }
    }
  }

  // Check boost pads
  let activeBoostPad: BoostPadDef | null = null;
  for (const pad of layout.boostPads) {
    const dx = x - pad.position.x;
    const dz = z - pad.position.z;
    const cos = Math.cos(-pad.yaw);
    const sin = Math.sin(-pad.yaw);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= pad.width * 0.55 && Math.abs(lz) <= pad.length * 0.55) {
      activeBoostPad = pad;
      break;
    }
  }

  // Check jump ramps (also elevates effective ground height across the ramp slope!)
  let activeRamp: RampDef | null = null;
  for (const ramp of layout.ramps) {
    const dx = x - ramp.position.x;
    const dz = z - ramp.position.z;
    const cos = Math.cos(-ramp.yaw);
    const sin = Math.sin(-ramp.yaw);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= ramp.width * 0.55 && Math.abs(lz) <= ramp.length * 0.55) {
      activeRamp = ramp;
      // Local -Z is forward up the ramp
      const progress = Math.max(0, Math.min(1, (ramp.length * 0.5 - lz) / ramp.length));
      groundHeight = Math.max(groundHeight, ramp.position.y + progress * ramp.height);
      break;
    }
  }

  const outOfBounds = Math.abs(lateralOffset) > wallDistance + 4.5;

  return {
    nearestSample: main.sample,
    lateralOffset,
    distanceAlongTrack: main.sample.s,
    groundHeight,
    slopeY: activeSample.tangent.y,
    surface,
    wallDistance,
    outOfBounds,
    onShortcut,
    activeBoostPad,
    activeRamp,
  };
}

export function getCheckpointPose(
  layout: TrackLayoutDef,
  checkpointIndex: number,
): { position: TrackVec3; yaw: number } {
  const safeIndex =
    ((checkpointIndex % layout.checkpoints.length) + layout.checkpoints.length) %
    layout.checkpoints.length;
  const cp = layout.checkpoints[safeIndex];
  return {
    position: { x: cp.position.x, y: cp.position.y + 0.35, z: cp.position.z },
    yaw: cp.yaw,
  };
}
