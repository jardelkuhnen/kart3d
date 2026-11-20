import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 0.0, z: 34 },
  { x: 0, y: 0.0, z: -58 },
  { x: 46, y: 4.2, z: -130 },
  { x: 130, y: 9.5, z: -126 },
  { x: 186, y: 10.0, z: -44 },
  { x: 152, y: 4.5, z: 32 },
  { x: 88, y: 1.8, z: 24 },
  { x: 128, y: 1.4, z: 106 },
  { x: 64, y: 3.8, z: 172 },
  { x: -28, y: 4.6, z: 158 },
  { x: -96, y: 2.2, z: 110 },
  { x: -68, y: 0.8, z: 56 },
  { x: -10, y: 0.0, z: 80 },
];

export const PICO_BOREAL_LAYOUT = assembleTrackLayout({
  id: 'pico-boreal',
  name: 'Pico Boreal',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.3,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'dirt',
  boostPadSpecs: [
    { id: 'boreal-pad-start', sFraction: 0.07, lateral: 0 },
    { id: 'boreal-pad-bridge', sFraction: 0.29, lateral: -1.8 },
    { id: 'boreal-pad-cavern', sFraction: 0.62, lateral: 1.8 },
    { id: 'boreal-pad-finish', sFraction: 0.88, lateral: 0 },
  ],
  rampSpecs: [
    {
      id: 'boreal-ramp-glacier',
      sFraction: 0.27,
      lateral: 0,
      width: 6.2,
      length: 6.5,
      height: 1.55,
      launchImpulse: 10.7,
    },
    {
      id: 'boreal-ramp-icefall',
      sFraction: 0.79,
      lateral: -2.0,
      width: 5.4,
      length: 5.8,
      height: 1.4,
      launchImpulse: 10.1,
    },
  ],
  surfaceZoneSpecs: [
    {
      id: 'boreal-ice-sheet-north',
      surface: 'ice',
      sFraction: 0.24,
      length: 135,
      lateralMin: -10,
      lateralMax: 10,
    },
    {
      id: 'boreal-ice-sheet-south',
      surface: 'ice',
      sFraction: 0.68,
      length: 145,
      lateralMin: -10,
      lateralMax: 10,
    },
  ],
  shortcuts: [
    {
      id: 'pico-atalho-glaciar',
      surface: 'ice',
      halfWidth: 4.3,
      controlPoints: [
        { x: 112, y: 8.6, z: -120 },
        { x: 144, y: 8.8, z: -90 },
        { x: 164, y: 9.2, z: -64 },
        { x: 182, y: 9.8, z: -48 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.22, end: 0.34 },
  tunnelFractionRange: { start: 0.56, end: 0.66 },
  itemRowFractions: [0.16, 0.46, 0.74],
  chevronFractions: [0.14, 0.38, 0.52, 0.77, 0.9],
  introCameraPoints: [
    { x: 120, y: 26, z: -115 },
    { x: 166, y: 20, z: 24 },
    { x: 56, y: 18, z: 144 },
    { x: -66, y: 15, z: 96 },
    { x: -12, y: 8, z: 18 },
  ],
  buildScenery: ({ samples, halfWidth }) => {
    const scenery: TrackPropPlacement[] = [];

    for (let i = 6; i < samples.length - 4; i += 13) {
      const sample = samples[i];
      const side = i % 26 === 6 ? 1 : -1;
      scenery.push({
        kind: 'aurora-pillar',
        position: offsetPointOnTrack(sample, side * (halfWidth + 2.8), 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.05,
        variant: i % 2,
      });
    }

    scenery.push(
      { kind: 'glacier-spire', position: { x: 26, y: 0, z: -26 }, yaw: 0.3, scale: 1.25 },
      { kind: 'glacier-spire', position: { x: -26, y: 0, z: -40 }, yaw: 1.2, scale: 1.35 },
      { kind: 'glacier-spire', position: { x: 96, y: 2.0, z: -158 }, yaw: 0.7, scale: 1.5 },
      { kind: 'glacier-spire', position: { x: 204, y: 3.0, z: -64 }, yaw: 1.9, scale: 1.55 },
      { kind: 'glacier-spire', position: { x: 98, y: 1.5, z: 176 }, yaw: 0.5, scale: 1.4 },
      { kind: 'glacier-spire', position: { x: -56, y: 1.2, z: 168 }, yaw: 2.3, scale: 1.35 },
      { kind: 'snow-pine', position: { x: 32, y: 0.5, z: -78 }, yaw: 0.4, scale: 1.25 },
      { kind: 'snow-pine', position: { x: 168, y: 2.5, z: 24 }, yaw: 1.1, scale: 1.3 },
      { kind: 'snow-pine', position: { x: 138, y: 1.5, z: 74 }, yaw: 0.8, scale: 1.2 },
      { kind: 'snow-pine', position: { x: -94, y: 1.2, z: 134 }, yaw: 1.6, scale: 1.35 },
      { kind: 'snow-pine', position: { x: -92, y: 0.8, z: 62 }, yaw: 2.2, scale: 1.25 },
      { kind: 'snow-pine', position: { x: 32, y: 0.2, z: 40 }, yaw: 0.2, scale: 1.2 },
    );

    return scenery;
  },
});
