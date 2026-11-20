import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 0.0, z: 36 },
  { x: 0, y: 0.0, z: -64 },
  { x: 48, y: 3.2, z: -138 },
  { x: 136, y: 8.2, z: -134 },
  { x: 192, y: 9.4, z: -52 },
  { x: 162, y: 5.2, z: 24 },
  { x: 98, y: 3.0, z: 12 },
  { x: 136, y: 2.2, z: 98 },
  { x: 74, y: 4.2, z: 166 },
  { x: -16, y: 4.8, z: 158 },
  { x: -76, y: 2.2, z: 108 },
  { x: -42, y: 1.0, z: 84 },
  { x: -8, y: 0.0, z: 82 },
];

export const CANION_SOLAR_LAYOUT = assembleTrackLayout({
  id: 'canion-solar',
  name: 'Cânion Solar',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.2,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'sand',
  boostPadSpecs: [
    { id: 'canion-pad-start', sFraction: 0.07, lateral: 0 },
    { id: 'canion-pad-rim', sFraction: 0.31, lateral: 1.8 },
    { id: 'canion-pad-temple', sFraction: 0.64, lateral: -1.8 },
    { id: 'canion-pad-finish', sFraction: 0.89, lateral: 0 },
  ],
  rampSpecs: [
    {
      id: 'canion-ramp-overpass',
      sFraction: 0.33,
      lateral: 0,
      width: 6.2,
      length: 6.6,
      height: 1.6,
      launchImpulse: 10.8,
    },
    {
      id: 'canion-ramp-arch',
      sFraction: 0.82,
      lateral: 2.0,
      width: 5.4,
      length: 5.8,
      height: 1.4,
      launchImpulse: 10.2,
    },
  ],
  surfaceZoneSpecs: [
    {
      id: 'canion-sand-wash',
      surface: 'sand',
      sFraction: 0.45,
      length: 76,
      lateralMin: -10,
      lateralMax: 10,
    },
    {
      id: 'canion-dirt-ruins',
      surface: 'dirt',
      sFraction: 0.72,
      length: 80,
      lateralMin: -10,
      lateralMax: 10,
    },
  ],
  shortcuts: [
    {
      id: 'canion-atalho-dunas',
      surface: 'sand',
      halfWidth: 4.3,
      controlPoints: [
        { x: 56, y: 3.8, z: -128 },
        { x: 102, y: 5.4, z: -104 },
        { x: 146, y: 7.0, z: -84 },
        { x: 184, y: 8.8, z: -58 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.27, end: 0.37 },
  tunnelFractionRange: { start: 0.59, end: 0.69 },
  itemRowFractions: [0.15, 0.47, 0.74],
  chevronFractions: [0.14, 0.41, 0.53, 0.78, 0.88],
  introCameraPoints: [
    { x: 125, y: 28, z: -125 },
    { x: 175, y: 20, z: 24 },
    { x: 64, y: 17, z: 140 },
    { x: -58, y: 15, z: 96 },
    { x: -12, y: 7.5, z: 18 },
  ],
  buildScenery: ({ samples, halfWidth }) => {
    const scenery: TrackPropPlacement[] = [];

    // Sun-totem torches along canyon walls
    for (let i = 7; i < samples.length - 4; i += 14) {
      const sample = samples[i];
      const side = i % 28 === 7 ? 1 : -1;
      scenery.push({
        kind: 'sun-totem',
        position: offsetPointOnTrack(sample, side * (halfWidth + 3.2), 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.0,
      });
    }

    // Desert mesas, ancient sandstone ruin pillars, and saguaros
    scenery.push(
      { kind: 'mesa-arch', position: { x: 120, y: 2.0, z: -144 }, yaw: 0.5, scale: 1.2 },
      { kind: 'mesa-arch', position: { x: 26, y: 2.2, z: 162 }, yaw: 0.1, scale: 1.25 },
      { kind: 'ruin-pillar', position: { x: 24, y: 0, z: -24 }, yaw: 0.4, scale: 1.2 },
      { kind: 'ruin-pillar', position: { x: -24, y: 0, z: -38 }, yaw: 1.1, scale: 1.3 },
      { kind: 'ruin-pillar', position: { x: 112, y: 2.5, z: 158 }, yaw: 0.8, scale: 1.35 },
      { kind: 'ruin-pillar', position: { x: 38, y: 3.4, z: 186 }, yaw: 1.9, scale: 1.4 },
      { kind: 'rock-pillar', position: { x: 86, y: 1.8, z: -64 }, yaw: 0.4, scale: 1.6 },
      { kind: 'rock-pillar', position: { x: 152, y: 2.5, z: -16 }, yaw: 1.2, scale: 1.5 },
      { kind: 'rock-pillar', position: { x: 74, y: 1.6, z: 54 }, yaw: 2.1, scale: 1.4 },
      { kind: 'rock-pillar', position: { x: -64, y: 1.2, z: 138 }, yaw: 0.8, scale: 1.45 },
      { kind: 'cactus', position: { x: 34, y: 0.5, z: -88 }, yaw: 0.2, scale: 1.2 },
      { kind: 'cactus', position: { x: -36, y: 0.5, z: -86 }, yaw: 1.1, scale: 1.1 },
      { kind: 'cactus', position: { x: 174, y: 2.0, z: 64 }, yaw: 0.5, scale: 1.25 },
      { kind: 'cactus', position: { x: 116, y: 1.8, z: 122 }, yaw: 1.7, scale: 1.15 },
      { kind: 'cactus', position: { x: -96, y: 1.4, z: 74 }, yaw: 2.4, scale: 1.3 },
      { kind: 'cactus', position: { x: 34, y: 0.5, z: 42 }, yaw: 0.9, scale: 1.2 },
    );

    return scenery;
  },
});
