import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 2.0, z: 36 },
  { x: 0, y: 2.0, z: -62 },
  { x: 44, y: 5.0, z: -136 },
  { x: 136, y: 10.5, z: -134 },
  { x: 196, y: 11.2, z: -52 },
  { x: 166, y: 6.8, z: 24 },
  { x: 102, y: 4.5, z: 16 },
  { x: 136, y: 3.5, z: 98 },
  { x: 72, y: 5.8, z: 168 },
  { x: -22, y: 6.2, z: 158 },
  { x: -88, y: 3.6, z: 112 },
  { x: -56, y: 2.4, z: 66 },
  { x: -10, y: 2.0, z: 82 },
];

export const FORTALEZA_TEMPESTADE_LAYOUT = assembleTrackLayout({
  id: 'fortaleza-tempestade',
  name: 'Fortaleza Tempestade',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.2,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'dirt',
  boostPadSpecs: [
    { id: 'fortaleza-pad-start', sFraction: 0.08, lateral: 0 },
    { id: 'fortaleza-pad-drawbridge', sFraction: 0.31, lateral: 1.8 },
    { id: 'fortaleza-pad-keep', sFraction: 0.65, lateral: -1.8 },
    { id: 'fortaleza-pad-finish', sFraction: 0.89, lateral: 0 },
  ],
  rampSpecs: [
    {
      id: 'fortaleza-ramp-battlement',
      sFraction: 0.28,
      lateral: 0,
      width: 6.2,
      length: 6.6,
      height: 1.65,
      launchImpulse: 11.0,
    },
    {
      id: 'fortaleza-ramp-courtyard',
      sFraction: 0.79,
      lateral: 2.0,
      width: 5.4,
      length: 5.8,
      height: 1.45,
      launchImpulse: 10.4,
    },
  ],
  surfaceZoneSpecs: [
    {
      id: 'fortaleza-dirt-courtyard',
      surface: 'dirt',
      sFraction: 0.48,
      length: 88,
      lateralMin: -10,
      lateralMax: 10,
    },
  ],
  movingHazardSpecs: [
    {
      id: 'fortaleza-iron-gate-1',
      sFraction: 0.42,
      sweepHalfWidth: 4.8,
      speedRadS: 2.2,
      phaseOffset: 0.5,
      radius: 1.5,
      style: 'storm-gate',
    },
    {
      id: 'fortaleza-iron-gate-2',
      sFraction: 0.74,
      sweepHalfWidth: 4.9,
      speedRadS: 2.4,
      phaseOffset: 2.1,
      radius: 1.5,
      style: 'storm-gate',
    },
  ],
  shortcuts: [
    {
      id: 'fortaleza-atalho-muralha',
      surface: 'dirt',
      halfWidth: 4.2,
      controlPoints: [
        { x: 52, y: 5.4, z: -126 },
        { x: 104, y: 7.4, z: -106 },
        { x: 158, y: 9.2, z: -76 },
        { x: 192, y: 10.8, z: -56 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.25, end: 0.36 },
  tunnelFractionRange: { start: 0.59, end: 0.69 },
  itemRowFractions: [0.16, 0.52, 0.76],
  chevronFractions: [0.14, 0.39, 0.53, 0.77, 0.9],
  introCameraPoints: [
    { x: 120, y: 30, z: -120 },
    { x: 175, y: 24, z: 24 },
    { x: 64, y: 20, z: 144 },
    { x: -64, y: 16, z: 96 },
    { x: -12, y: 9, z: 18 },
  ],
  buildScenery: ({ samples, halfWidth }) => {
    const scenery: TrackPropPlacement[] = [];

    for (let i = 8; i < samples.length - 4; i += 16) {
      const sample = samples[i];
      const side = i % 32 === 8 ? 1 : -1;
      scenery.push({
        kind: 'lightning-spire',
        position: offsetPointOnTrack(sample, side * (halfWidth + 3.4), 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.05,
      });
    }

    for (const frac of [0.1, 0.44, 0.85]) {
      const idx = Math.floor(frac * samples.length) % samples.length;
      const sample = samples[idx];
      scenery.push({
        kind: 'storm-arch',
        position: offsetPointOnTrack(sample, 0, 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.0,
      });
    }

    scenery.push(
      { kind: 'castle-tower', position: { x: 26, y: 2.0, z: -26 }, yaw: 0.1, scale: 1.2 },
      { kind: 'castle-tower', position: { x: -26, y: 2.0, z: -36 }, yaw: 0.5, scale: 1.3 },
      { kind: 'castle-tower', position: { x: 108, y: 4.5, z: -158 }, yaw: 0.8, scale: 1.45 },
      { kind: 'castle-tower', position: { x: 214, y: 5.0, z: -56 }, yaw: 1.2, scale: 1.5 },
      { kind: 'castle-tower', position: { x: 96, y: 4.0, z: 176 }, yaw: 0.4, scale: 1.35 },
      { kind: 'castle-tower', position: { x: -46, y: 4.0, z: 174 }, yaw: 1.9, scale: 1.3 },
      { kind: 'castle-tower', position: { x: -108, y: 2.5, z: 112 }, yaw: 0.7, scale: 1.25 },
      { kind: 'rock-pillar', position: { x: 88, y: 2.0, z: 48 }, yaw: 0.4, scale: 1.5 },
      { kind: 'rock-pillar', position: { x: -44, y: 2.0, z: 38 }, yaw: 1.5, scale: 1.3 },
    );

    return scenery;
  },
});
