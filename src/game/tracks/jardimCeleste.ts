import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 4.0, z: 36 },
  { x: 0, y: 4.0, z: -56 },
  { x: -46, y: 7.5, z: -132 },
  { x: -132, y: 14.0, z: -142 },
  { x: -202, y: 15.5, z: -66 },
  { x: -172, y: 10.0, z: 16 },
  { x: -102, y: 6.2, z: 48 },
  { x: -134, y: 5.4, z: 128 },
  { x: -52, y: 8.5, z: 176 },
  { x: 52, y: 11.0, z: 158 },
  { x: 118, y: 8.5, z: 94 },
  { x: 74, y: 5.5, z: 58 },
  { x: 14, y: 4.0, z: 82 },
];

export const JARDIM_CELESTE_LAYOUT = assembleTrackLayout({
  id: 'jardim-celeste',
  name: 'Jardim Celeste',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.4,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'grass',
  boostPadSpecs: [
    { id: 'celeste-pad-start', sFraction: 0.08, lateral: 0 },
    { id: 'celeste-pad-cloud', sFraction: 0.34, lateral: -1.8 },
    { id: 'celeste-pad-skybridge', sFraction: 0.61, lateral: 1.8 },
    { id: 'celeste-pad-return', sFraction: 0.88, lateral: 0 },
  ],
  rampSpecs: [
    {
      id: 'celeste-ramp-cloud-crest',
      sFraction: 0.25,
      lateral: 0,
      width: 6.4,
      length: 6.8,
      height: 1.75,
      launchImpulse: 11.8,
    },
    {
      id: 'celeste-ramp-arch-leap',
      sFraction: 0.56,
      lateral: 1.8,
      width: 5.6,
      length: 6.2,
      height: 1.65,
      launchImpulse: 11.4,
    },
    {
      id: 'celeste-ramp-garden-jump',
      sFraction: 0.81,
      lateral: -1.8,
      width: 5.6,
      length: 6.0,
      height: 1.55,
      launchImpulse: 11.2,
    },
  ],
  shortcuts: [
    {
      id: 'jardim-atalho-nuvens',
      surface: 'grass',
      halfWidth: 4.4,
      controlPoints: [
        { x: 76, y: 9.2, z: 132 },
        { x: 64, y: 7.4, z: 96 },
        { x: 42, y: 5.4, z: 76 },
        { x: 16, y: 4.2, z: 80 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.54, end: 0.66 },
  tunnelFractionRange: null,
  itemRowFractions: [0.15, 0.45, 0.72],
  chevronFractions: [0.14, 0.38, 0.51, 0.77, 0.9],
  introCameraPoints: [
    { x: -120, y: 30, z: -115 },
    { x: -175, y: 24, z: 30 },
    { x: -30, y: 22, z: 150 },
    { x: 88, y: 18, z: 78 },
    { x: 14, y: 12, z: 18 },
  ],
  buildScenery: ({ samples }) => {
    const scenery: TrackPropPlacement[] = [];

    // Floating golden sky rings to fly beneath
    for (const frac of [0.12, 0.31, 0.6, 0.84]) {
      const idx = Math.floor(frac * samples.length) % samples.length;
      const sample = samples[idx];
      scenery.push({
        kind: 'sky-ring',
        position: offsetPointOnTrack(sample, 0, 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.15,
      });
    }

    // Floating cloud islands & marble gazebos in the sky void
    scenery.push(
      { kind: 'cloud-island', position: { x: 42, y: 0, z: -30 }, yaw: 0.3, scale: 1.3 },
      { kind: 'cloud-island', position: { x: -46, y: 1, z: -42 }, yaw: 1.1, scale: 1.25 },
      { kind: 'cloud-island', position: { x: -158, y: 9, z: -148 }, yaw: 0.6, scale: 1.5 },
      { kind: 'cloud-island', position: { x: -222, y: 8, z: -32 }, yaw: 1.8, scale: 1.45 },
      { kind: 'cloud-island', position: { x: -72, y: 4, z: 188 }, yaw: 0.4, scale: 1.4 },
      { kind: 'cloud-island', position: { x: 108, y: 4, z: 148 }, yaw: 2.1, scale: 1.35 },
      { kind: 'sky-gazebo', position: { x: 30, y: 4.2, z: -24 }, yaw: -Math.PI * 0.5, scale: 1.1 },
      { kind: 'sky-gazebo', position: { x: -156, y: 14.0, z: -96 }, yaw: 0.5, scale: 1.15 },
      { kind: 'sky-gazebo', position: { x: 18, y: 9.5, z: 178 }, yaw: 3.1, scale: 1.1 },
      { kind: 'sky-gazebo', position: { x: 132, y: 8.2, z: 72 }, yaw: -1.4, scale: 1.1 },
      { kind: 'giant-tree', position: { x: -26, y: 4.0, z: 22 }, yaw: 0.4, scale: 1.2 },
      { kind: 'giant-tree', position: { x: 104, y: 7.0, z: 118 }, yaw: 1.3, scale: 1.25 },
      { kind: 'giant-tree', position: { x: -96, y: 5.5, z: 96 }, yaw: 2.0, scale: 1.2 },
    );

    return scenery;
  },
});
