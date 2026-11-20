import {
  type BoostPadDef,
  type CheckpointDef,
  type RampDef,
  type ShortcutPathDef,
  type SurfaceZoneDef,
  type TrackLayoutDef,
  type TrackPropPlacement,
  type TrackVec3,
  getSampleAtDistance,
  offsetPointOnTrack,
  sampleTrackSpline,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 0.0, z: 36 },
  { x: 0, y: 0.0, z: -58 },
  { x: -34, y: 2.8, z: -126 },
  { x: -112, y: 7.0, z: -148 },
  { x: -178, y: 5.0, z: -98 },
  { x: -186, y: 1.6, z: -14 },
  { x: -152, y: 0.8, z: 66 },
  { x: -90, y: 0.8, z: 118 },
  { x: -26, y: 1.8, z: 92 },
  { x: 30, y: 2.8, z: 134 },
  { x: 96, y: 1.8, z: 116 },
  { x: 74, y: 0.4, z: 68 },
  { x: 14, y: 0.0, z: 82 },
];

const HALF_WIDTH = 8.2;
const WALL_MARGIN = HALF_WIDTH + 2.8;
const SAMPLE_COUNT = 260;

const { samples, totalLength } = sampleTrackSpline(MAIN_CONTROL_POINTS, SAMPLE_COUNT, HALF_WIDTH, true);

// Dirt Harbor Shortcut cutting diagonally behind the Market Plaza hairpin
const SHORTCUT_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: -162, y: 0.85, z: 42 },
  { x: -130, y: 0.9, z: 64 },
  { x: -98, y: 0.95, z: 82 },
  { x: -64, y: 1.25, z: 92 },
];

const shortcutSampled = sampleTrackSpline(SHORTCUT_CONTROL_POINTS, 36, 4.1, false);
const HARBOR_SHORTCUT: ShortcutPathDef = {
  id: 'porto-atalho-mercado',
  surface: 'dirt',
  halfWidth: 4.1,
  controlPoints: SHORTCUT_CONTROL_POINTS,
  samples: shortcutSampled.samples,
};

// 12 sequential checkpoints starting at checkpoint 0 (start/finish line near [0, 0, 0])
const CHECKPOINT_COUNT = 12;
const checkpoints: CheckpointDef[] = Array.from({ length: CHECKPOINT_COUNT }, (_, idx) => {
  const s = (idx / CHECKPOINT_COUNT) * totalLength;
  const sample = getSampleAtDistance(samples, totalLength, s);
  return {
    index: idx,
    t: sample.t,
    s: sample.s,
    position: sample.point,
    tangent: sample.tangent,
    right: sample.right,
    yaw: yawFromTangent(sample.tangent),
    width: HALF_WIDTH * 2.2,
  };
});

// 4 Boost Pads positioned along clean speed lines
const boostPadSpecs: Array<{ id: string; sFraction: number; lateral: number }> = [
  { id: 'boost-start-straight', sFraction: 0.08, lateral: 0 },
  { id: 'boost-bridge-exit', sFraction: 0.29, lateral: -2.2 },
  { id: 'boost-harbor-plaza', sFraction: 0.56, lateral: 2.0 },
  { id: 'boost-tunnel-exit', sFraction: 0.78, lateral: 0 },
];

const boostPads: BoostPadDef[] = boostPadSpecs.map((spec) => {
  const sample = getSampleAtDistance(samples, totalLength, spec.sFraction * totalLength);
  return {
    id: spec.id,
    s: sample.s,
    lateralOffset: spec.lateral,
    position: offsetPointOnTrack(sample, spec.lateral, 0.02),
    yaw: yawFromTangent(sample.tangent),
    width: 2.8,
    length: 4.4,
  };
});

// 2 Jump Ramps: Bridge Crest Ramp + East Cove Boardwalk Ramp
const rampSpecs: Array<{
  id: string;
  sFraction: number;
  lateral: number;
  width: number;
  length: number;
  height: number;
  launchImpulse: number;
}> = [
  {
    id: 'ramp-bridge-crest',
    sFraction: 0.24,
    lateral: 0,
    width: 6.2,
    length: 6.5,
    height: 1.55,
    launchImpulse: 10.5,
  },
  {
    id: 'ramp-cove-jump',
    sFraction: 0.87,
    lateral: -2.4,
    width: 5.0,
    length: 5.8,
    height: 1.35,
    launchImpulse: 9.8,
  },
];

const ramps: RampDef[] = rampSpecs.map((spec) => {
  const sample = getSampleAtDistance(samples, totalLength, spec.sFraction * totalLength);
  return {
    id: spec.id,
    s: sample.s,
    lateralOffset: spec.lateral,
    position: offsetPointOnTrack(sample, spec.lateral, 0),
    yaw: yawFromTangent(sample.tangent),
    width: spec.width,
    length: spec.length,
    height: spec.height,
    launchImpulse: spec.launchImpulse,
  };
});

// Sand cove shoulder + dirt apron zones near harbor beach
const surfaceZones: SurfaceZoneDef[] = [
  {
    id: 'sand-cove-shoulder',
    surface: 'sand',
    centerS: totalLength * 0.42,
    length: 110,
    lateralMin: HALF_WIDTH + 1.2,
    lateralMax: WALL_MARGIN + 2,
  },
  {
    id: 'dirt-market-apron',
    surface: 'dirt',
    centerS: totalLength * 0.54,
    length: 75,
    lateralMin: -(WALL_MARGIN + 2),
    lateralMax: -(HALF_WIDTH + 1.2),
  },
];

// Staggered 8-slot starting grid behind checkpoint 0
const startGridSlots = Array.from({ length: 8 }, (_, slotIdx) => {
  const row = Math.floor(slotIdx / 2);
  const col = slotIdx % 2 === 0 ? -1 : 1;
  const sBehind = (totalLength - 8 - row * 4.4) % totalLength;
  const sample = getSampleAtDistance(samples, totalLength, sBehind);
  return {
    position: offsetPointOnTrack(sample, col * 2.5, 0.35),
    yaw: yawFromTangent(sample.tangent),
  };
});

// Item box rows (3 rows prepared for Slice 2)
const itemBoxZones: TrackVec3[][] = [0.16, 0.48, 0.72].map((frac) => {
  const sample = getSampleAtDistance(samples, totalLength, frac * totalLength);
  return [-4.2, -1.4, 1.4, 4.2].map((lat) => offsetPointOnTrack(sample, lat, 1.0));
});

// AI racing line waypoints (prepared for Slice 2)
const aiWaypoints: TrackVec3[] = Array.from({ length: 36 }, (_, idx) => {
  const sample = getSampleAtDistance(samples, totalLength, (idx / 36) * totalLength);
  return sample.point;
});

// Intro flyover camera path overlooking lighthouse, bridge, harbor, and start gantry
const introCameraPoints: TrackVec3[] = [
  { x: -135, y: 24, z: -120 },
  { x: -160, y: 18, z: 25 },
  { x: -65, y: 15, z: 110 },
  { x: 45, y: 12, z: 60 },
  { x: 14, y: 7, z: 18 },
];

// Rich curated scenery placements around the coastal town & bay
const scenery: TrackPropPlacement[] = [];

// Lantern posts lining the waterfront road every ~38m
for (let i = 6; i < SAMPLE_COUNT - 4; i += 12) {
  const sample = samples[i];
  const side = i % 24 === 6 ? 1 : -1;
  scenery.push({
    kind: 'lantern-post',
    position: offsetPointOnTrack(sample, side * (HALF_WIDTH + 2.2), 0),
    yaw: yawFromTangent(sample.tangent) + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5),
    scale: 1.0,
  });
}

// High-contrast chevron turn boards at sharp curves
for (const frac of [0.13, 0.36, 0.53, 0.67, 0.89]) {
  const sample = getSampleAtDistance(samples, totalLength, frac * totalLength);
  const nextSample = getSampleAtDistance(samples, totalLength, (frac + 0.03) * totalLength);
  const turnCross = sample.tangent.x * nextSample.tangent.z - sample.tangent.z * nextSample.tangent.x;
  const outerSide = turnCross > 0 ? -1 : 1;
  scenery.push({
    kind: 'chevron-board',
    position: offsetPointOnTrack(sample, outerSide * (WALL_MARGIN + 0.8), 0),
    yaw: yawFromTangent(sample.tangent) + (turnCross > 0 ? -0.35 : 0.35),
    scale: 1.15,
  });
}

// Coastal houses, market stalls, cypress/palm trees, boats, and Hero Lighthouse
scenery.push(
  { kind: 'lighthouse', position: { x: -206, y: 1.0, z: -42 }, yaw: 0.4, scale: 1.0 },
  { kind: 'house', position: { x: 24, y: 0, z: -22 }, yaw: -Math.PI * 0.5, scale: 1.1, variant: 0 },
  { kind: 'house', position: { x: 26, y: 0, z: -48 }, yaw: -Math.PI * 0.5, scale: 1.25, variant: 1 },
  { kind: 'house', position: { x: -24, y: 0, z: -18 }, yaw: Math.PI * 0.5, scale: 1.05, variant: 2 },
  { kind: 'house', position: { x: -28, y: 0, z: -52 }, yaw: Math.PI * 0.45, scale: 1.15, variant: 0 },
  { kind: 'house', position: { x: -124, y: 0.8, z: 142 }, yaw: 0.25, scale: 1.2, variant: 1 },
  { kind: 'house', position: { x: -162, y: 0.8, z: 112 }, yaw: 0.75, scale: 1.05, variant: 2 },
  { kind: 'house', position: { x: 132, y: 1.2, z: 108 }, yaw: -0.9, scale: 1.15, variant: 0 },
  { kind: 'market-stall', position: { x: -128, y: 0.85, z: 46 }, yaw: 0.4, scale: 1.0, variant: 0 },
  { kind: 'market-stall', position: { x: -116, y: 0.85, z: 58 }, yaw: 0.45, scale: 1.0, variant: 1 },
  { kind: 'market-stall', position: { x: -96, y: 0.9, z: 68 }, yaw: 0.2, scale: 1.0, variant: 0 },
  { kind: 'boat', position: { x: -72, y: -1.4, z: -55 }, yaw: 0.5, scale: 1.3 },
  { kind: 'boat', position: { x: -115, y: -1.4, z: -18 }, yaw: -0.4, scale: 1.1 },
  { kind: 'boat', position: { x: -55, y: -1.4, z: 22 }, yaw: 1.1, scale: 1.2 },
  { kind: 'boat', position: { x: -235, y: -1.4, z: -85 }, yaw: 0.8, scale: 1.5 },
  { kind: 'palm-tree', position: { x: -58, y: 0.4, z: -16 }, yaw: 0.2, scale: 1.1 },
  { kind: 'palm-tree', position: { x: -136, y: 0.8, z: 96 }, yaw: 1.1, scale: 1.25 },
  { kind: 'palm-tree', position: { x: 46, y: 0.2, z: 36 }, yaw: 0.7, scale: 1.15 },
  { kind: 'palm-tree', position: { x: 96, y: 0.6, z: 46 }, yaw: 2.1, scale: 1.2 },
  { kind: 'cypress-tree', position: { x: -64, y: 3.2, z: -166 }, yaw: 0, scale: 1.3 },
  { kind: 'cypress-tree', position: { x: -146, y: 5.5, z: -166 }, yaw: 0.8, scale: 1.4 },
  { kind: 'cypress-tree', position: { x: 48, y: 2.5, z: 158 }, yaw: 0.4, scale: 1.35 },
  { kind: 'cypress-tree', position: { x: -18, y: 1.8, z: 154 }, yaw: 1.2, scale: 1.25 },
  { kind: 'rock-pillar', position: { x: -78, y: 0, z: -96 }, yaw: 0.4, scale: 1.4 },
  { kind: 'rock-pillar', position: { x: -142, y: 0, z: -64 }, yaw: 1.6, scale: 1.2 },
);

export const PORTO_DAS_LANTERNAS_LAYOUT: TrackLayoutDef = {
  id: 'porto-das-lanternas',
  name: 'Porto das Lanternas',
  controlPoints: MAIN_CONTROL_POINTS,
  sampleCount: SAMPLE_COUNT,
  halfWidth: HALF_WIDTH,
  wallMargin: WALL_MARGIN,
  totalLength,
  samples,
  checkpoints,
  surfaceZones,
  boostPads,
  ramps,
  shortcuts: [HARBOR_SHORTCUT],
  tunnelRange: { sStart: totalLength * 0.69, sEnd: totalLength * 0.77 },
  bridgeRange: { sStart: totalLength * 0.19, sEnd: totalLength * 0.28 },
  itemBoxZones,
  aiWaypoints,
  introCameraPoints,
  startGridSlots,
  scenery,
};
