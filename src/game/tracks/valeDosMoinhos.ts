import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 0.0, z: 38 },
  { x: 0, y: 0.0, z: -56 },
  { x: -44, y: 4.8, z: -124 },
  { x: -122, y: 11.4, z: -136 },
  { x: -186, y: 13.2, z: -72 },
  { x: -164, y: 6.0, z: 14 },
  { x: -96, y: 1.8, z: 44 },
  { x: -128, y: 1.2, z: 124 },
  { x: -46, y: 0.6, z: 166 },
  { x: 52, y: 1.4, z: 152 },
  { x: 108, y: 4.6, z: 96 },
  { x: 68, y: 2.2, z: 54 },
  { x: 14, y: 0.0, z: 82 },
];

export const VALE_DOS_MOINHOS_LAYOUT = assembleTrackLayout({
  id: 'vale-dos-moinhos',
  name: 'Vale dos Moinhos',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.3,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'grass',
  boostPadSpecs: [
    { id: 'vale-pad-start', sFraction: 0.08, lateral: 0 },
    { id: 'vale-pad-ridge', sFraction: 0.34, lateral: -1.8 },
    { id: 'vale-pad-river', sFraction: 0.63, lateral: 1.6 },
    { id: 'vale-pad-home', sFraction: 0.89, lateral: 0 },
  ],
  rampSpecs: [
    {
      id: 'vale-ramp-windmill-drop',
      sFraction: 0.36,
      lateral: 0,
      width: 6.4,
      length: 6.6,
      height: 1.65,
      launchImpulse: 11.2,
    },
    {
      id: 'vale-ramp-river-crest',
      sFraction: 0.6,
      lateral: 2.0,
      width: 5.4,
      length: 6.0,
      height: 1.4,
      launchImpulse: 10.0,
    },
    {
      id: 'vale-ramp-pasture',
      sFraction: 0.81,
      lateral: -2.0,
      width: 5.2,
      length: 5.6,
      height: 1.35,
      launchImpulse: 9.8,
    },
  ],
  surfaceZoneSpecs: [
    {
      id: 'vale-dirt-farm-road',
      surface: 'dirt',
      sFraction: 0.72,
      length: 84,
      lateralMin: -10,
      lateralMax: 10,
    },
  ],
  shortcuts: [
    {
      id: 'vale-atalho-colina',
      surface: 'grass',
      halfWidth: 4.3,
      controlPoints: [
        { x: 64, y: 2.2, z: 144 },
        { x: 66, y: 2.8, z: 110 },
        { x: 48, y: 2.0, z: 82 },
        { x: 24, y: 0.6, z: 76 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.56, end: 0.66 },
  tunnelFractionRange: null,
  itemRowFractions: [0.16, 0.46, 0.74],
  chevronFractions: [0.15, 0.32, 0.48, 0.77, 0.9],
  introCameraPoints: [
    { x: -125, y: 28, z: -115 },
    { x: -165, y: 21, z: 32 },
    { x: -30, y: 18, z: 148 },
    { x: 90, y: 16, z: 74 },
    { x: 14, y: 7.5, z: 18 },
  ],
  buildScenery: ({ samples, halfWidth }) => {
    const scenery: TrackPropPlacement[] = [];

    // Roadside pine fence lanterns / posts
    for (let i = 8; i < samples.length - 4; i += 14) {
      const sample = samples[i];
      const side = i % 28 === 8 ? 1 : -1;
      scenery.push({
        kind: 'hay-bale',
        position: offsetPointOnTrack(sample, side * (halfWidth + 4.4), 0),
        yaw: yawFromTangent(sample.tangent) + 0.4,
        scale: 1.0,
      });
    }

    // Hero rotating Windmills + Rural Barns + Pine Trees
    scenery.push(
      { kind: 'windmill', position: { x: -138, y: 7.5, z: -164 }, yaw: 0.6, scale: 1.15 },
      { kind: 'windmill', position: { x: -206, y: 8.5, z: -96 }, yaw: 1.2, scale: 1.2 },
      { kind: 'windmill', position: { x: -134, y: 2.2, z: -22 }, yaw: -0.5, scale: 1.05 },
      { kind: 'windmill', position: { x: -146, y: 0.6, z: 82 }, yaw: 0.9, scale: 1.1 },
      { kind: 'windmill', position: { x: 24, y: 0.4, z: 178 }, yaw: 3.1, scale: 1.15 },
      { kind: 'windmill', position: { x: 132, y: 3.6, z: 112 }, yaw: -1.4, scale: 1.1 },
      { kind: 'barn', position: { x: 28, y: 0, z: -26 }, yaw: -Math.PI * 0.5, scale: 1.15 },
      { kind: 'barn', position: { x: -30, y: 0, z: -38 }, yaw: Math.PI * 0.45, scale: 1.05 },
      { kind: 'barn', position: { x: -86, y: 0.8, z: 142 }, yaw: 0.4, scale: 1.1 },
      { kind: 'barn', position: { x: 88, y: 2.2, z: 26 }, yaw: -2.4, scale: 1.05 },
      { kind: 'hay-bale', position: { x: 19, y: 0, z: -12 }, yaw: 0.2, scale: 1.2 },
      { kind: 'hay-bale', position: { x: -21, y: 0, z: -20 }, yaw: 1.0, scale: 1.2 },
      { kind: 'pine-tree', position: { x: -64, y: 4.2, z: -158 }, yaw: 0.3, scale: 1.4 },
      { kind: 'pine-tree', position: { x: -166, y: 9.0, z: -146 }, yaw: 1.1, scale: 1.3 },
      { kind: 'pine-tree', position: { x: -206, y: 4.5, z: 22 }, yaw: 0.7, scale: 1.35 },
      { kind: 'pine-tree', position: { x: -68, y: 0.8, z: 86 }, yaw: 1.8, scale: 1.2 },
      { kind: 'pine-tree', position: { x: 86, y: 1.4, z: 162 }, yaw: 2.2, scale: 1.35 },
      { kind: 'pine-tree', position: { x: 136, y: 3.0, z: 68 }, yaw: 0.4, scale: 1.25 },
      { kind: 'pine-tree', position: { x: 42, y: 0.2, z: 32 }, yaw: 1.5, scale: 1.2 },
    );

    return scenery;
  },
});
