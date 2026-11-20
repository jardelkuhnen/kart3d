import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 0.0, z: 36 },
  { x: 0, y: 0.0, z: -66 },
  { x: -44, y: 3.5, z: -138 },
  { x: -132, y: 9.5, z: -144 },
  { x: -198, y: 11.5, z: -72 },
  { x: -178, y: 6.0, z: 18 },
  { x: -104, y: 2.4, z: 48 },
  { x: -140, y: 1.2, z: 130 },
  { x: -56, y: 4.0, z: 174 },
  { x: 46, y: 5.5, z: 162 },
  { x: 114, y: 3.2, z: 102 },
  { x: 66, y: 1.2, z: 64 },
  { x: 12, y: 0.0, z: 82 },
];

export const CIDADE_NEON_LAYOUT = assembleTrackLayout({
  id: 'cidade-neon',
  name: 'Cidade Neon',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.3,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'asphalt',
  boostPadSpecs: [
    { id: 'neon-pad-start', sFraction: 0.07, lateral: 0 },
    { id: 'neon-pad-viaduct', sFraction: 0.31, lateral: -2.0 },
    { id: 'neon-pad-tunnel', sFraction: 0.65, lateral: 2.0 },
    { id: 'neon-pad-dash', sFraction: 0.9, lateral: 0 },
  ],
  rampSpecs: [
    {
      id: 'neon-ramp-skyway',
      sFraction: 0.25,
      lateral: 0,
      width: 6.4,
      length: 6.4,
      height: 1.55,
      launchImpulse: 10.8,
    },
    {
      id: 'neon-ramp-plaza',
      sFraction: 0.77,
      lateral: -2.2,
      width: 5.2,
      length: 5.8,
      height: 1.35,
      launchImpulse: 9.9,
    },
  ],
  movingHazardSpecs: [
    {
      id: 'neon-laser-barrier-1',
      sFraction: 0.44,
      sweepHalfWidth: 5.0,
      speedRadS: 2.1,
      phaseOffset: 0.0,
      radius: 1.45,
      style: 'neon-barrier',
    },
    {
      id: 'neon-laser-barrier-2',
      sFraction: 0.81,
      sweepHalfWidth: 4.8,
      speedRadS: 2.35,
      phaseOffset: 1.7,
      radius: 1.45,
      style: 'neon-barrier',
    },
  ],
  shortcuts: [
    {
      id: 'cidade-atalho-viaduto',
      surface: 'asphalt',
      halfWidth: 4.2,
      controlPoints: [
        { x: 76, y: 2.4, z: 128 },
        { x: 64, y: 1.8, z: 100 },
        { x: 42, y: 1.0, z: 80 },
        { x: 18, y: 0.2, z: 80 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.2, end: 0.36 },
  tunnelFractionRange: { start: 0.58, end: 0.68 },
  itemRowFractions: [0.16, 0.49, 0.73],
  chevronFractions: [0.14, 0.39, 0.53, 0.78, 0.89],
  introCameraPoints: [
    { x: -130, y: 28, z: -120 },
    { x: -175, y: 22, z: 26 },
    { x: -35, y: 16, z: 150 },
    { x: 90, y: 16, z: 78 },
    { x: 12, y: 8, z: 16 },
  ],
  buildScenery: ({ samples, halfWidth }) => {
    const scenery: TrackPropPlacement[] = [];

    for (let i = 6; i < samples.length - 4; i += 14) {
      const sample = samples[i];
      scenery.push({
        kind: 'neon-arch',
        position: offsetPointOnTrack(sample, 0, 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.0,
        variant: i % 2,
      });
    }

    for (let i = 10; i < samples.length - 6; i += 22) {
      const sample = samples[i];
      const side = i % 44 === 10 ? 1 : -1;
      scenery.push({
        kind: 'neon-billboard',
        position: offsetPointOnTrack(sample, side * (halfWidth + 4.8), 0),
        yaw: yawFromTangent(sample.tangent) + (side > 0 ? Math.PI * 0.45 : -Math.PI * 0.45),
        scale: 1.05,
        variant: i % 3,
      });
    }

    scenery.push(
      { kind: 'skyscraper', position: { x: 30, y: 0, z: -26 }, yaw: 0.1, scale: 1.25, variant: 0 },
      { kind: 'skyscraper', position: { x: -32, y: 0, z: -38 }, yaw: 0.3, scale: 1.35, variant: 1 },
      { kind: 'skyscraper', position: { x: 38, y: 0, z: -82 }, yaw: -0.2, scale: 1.15, variant: 2 },
      { kind: 'skyscraper', position: { x: -92, y: 1.0, z: -168 }, yaw: 0.6, scale: 1.4, variant: 0 },
      { kind: 'skyscraper', position: { x: -178, y: 2.0, z: -140 }, yaw: 0.9, scale: 1.3, variant: 1 },
      { kind: 'skyscraper', position: { x: -222, y: 1.5, z: -22 }, yaw: 0.4, scale: 1.45, variant: 2 },
      { kind: 'skyscraper', position: { x: -172, y: 0.5, z: 146 }, yaw: 0.8, scale: 1.25, variant: 0 },
      { kind: 'skyscraper', position: { x: -64, y: 0.5, z: 196 }, yaw: 0.1, scale: 1.35, variant: 1 },
      { kind: 'skyscraper', position: { x: 84, y: 0.5, z: 178 }, yaw: -0.4, scale: 1.3, variant: 2 },
      { kind: 'skyscraper', position: { x: 138, y: 1.0, z: 96 }, yaw: -0.7, scale: 1.2, variant: 0 },
    );

    return scenery;
  },
});
