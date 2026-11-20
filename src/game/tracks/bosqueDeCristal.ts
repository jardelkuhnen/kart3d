import {
  type TrackPropPlacement,
  type TrackVec3,
  assembleTrackLayout,
  offsetPointOnTrack,
  yawFromTangent,
} from './trackGeometry';

const MAIN_CONTROL_POINTS: readonly TrackVec3[] = [
  { x: 0, y: 0.0, z: 34 },
  { x: 0, y: 0.0, z: -52 },
  { x: 42, y: 2.4, z: -116 },
  { x: 122, y: 5.2, z: -118 },
  { x: 170, y: 5.6, z: -48 },
  { x: 142, y: 2.2, z: 24 },
  { x: 84, y: 0.6, z: 54 },
  { x: 122, y: 1.8, z: 128 },
  { x: 52, y: 3.8, z: 174 },
  { x: -24, y: 4.4, z: 154 },
  { x: -88, y: 2.2, z: 122 },
  { x: -102, y: 0.9, z: 62 },
  { x: -50, y: 0.5, z: 76 },
  { x: -10, y: 0.0, z: 82 },
];

export const BOSQUE_DE_CRISTAL_LAYOUT = assembleTrackLayout({
  id: 'bosque-de-cristal',
  name: 'Bosque de Cristal',
  controlPoints: MAIN_CONTROL_POINTS,
  halfWidth: 8.2,
  defaultRoadSurface: 'asphalt',
  offroadSurface: 'grass',
  boostPadSpecs: [
    { id: 'bosque-pad-start', sFraction: 0.07, lateral: 0 },
    { id: 'bosque-pad-waterfall', sFraction: 0.27, lateral: -2.0 },
    { id: 'bosque-pad-cavern', sFraction: 0.6, lateral: 1.8 },
    { id: 'bosque-pad-exit', sFraction: 0.87, lateral: -1.6 },
  ],
  rampSpecs: [
    {
      id: 'bosque-ramp-bridge',
      sFraction: 0.29,
      lateral: 0,
      width: 6.2,
      length: 6.4,
      height: 1.5,
      launchImpulse: 10.6,
    },
    {
      id: 'bosque-ramp-grove',
      sFraction: 0.78,
      lateral: 2.2,
      width: 5.2,
      length: 5.8,
      height: 1.3,
      launchImpulse: 9.8,
    },
  ],
  surfaceZoneSpecs: [
    {
      id: 'bosque-moss-trail',
      surface: 'dirt',
      sFraction: 0.42,
      length: 95,
      lateralMin: -10,
      lateralMax: 10,
    },
    {
      id: 'bosque-mushroom-path',
      surface: 'dirt',
      sFraction: 0.74,
      length: 78,
      lateralMin: -10,
      lateralMax: 10,
    },
  ],
  shortcuts: [
    {
      id: 'bosque-atalho-cogumelos',
      surface: 'dirt',
      halfWidth: 4.2,
      controlPoints: [
        { x: -92, y: 2.1, z: 120 },
        { x: -64, y: 1.5, z: 98 },
        { x: -34, y: 0.8, z: 86 },
        { x: -12, y: 0.2, z: 80 },
      ],
    },
  ],
  bridgeFractionRange: { start: 0.2, end: 0.31 },
  tunnelFractionRange: { start: 0.54, end: 0.64 },
  itemRowFractions: [0.15, 0.47, 0.71],
  chevronFractions: [0.14, 0.37, 0.51, 0.67, 0.88],
  introCameraPoints: [
    { x: 135, y: 24, z: -120 },
    { x: 165, y: 19, z: 22 },
    { x: 56, y: 17, z: 145 },
    { x: -62, y: 14, z: 94 },
    { x: -12, y: 7.5, z: 18 },
  ],
  buildScenery: ({ samples, halfWidth }) => {
    const scenery: TrackPropPlacement[] = [];

    // Bioluminescent mushroom lamps lining the forest road
    for (let i = 5; i < samples.length - 4; i += 11) {
      const sample = samples[i];
      const side = i % 22 === 5 ? 1 : -1;
      scenery.push({
        kind: 'mushroom-lamp',
        position: offsetPointOnTrack(sample, side * (halfWidth + 2.3), 0),
        yaw: yawFromTangent(sample.tangent),
        scale: 1.05,
        variant: i % 3,
      });
    }

    // Giant enchanted trees, luminous crystal clusters & waterfall cliffs
    scenery.push(
      { kind: 'waterfall-cliff', position: { x: 188, y: -1.5, z: -84 }, yaw: -2.2, scale: 1.25 },
      { kind: 'waterfall-cliff', position: { x: 194, y: -1.5, z: -22 }, yaw: -1.5, scale: 1.15 },
      { kind: 'giant-tree', position: { x: -28, y: 0, z: -20 }, yaw: 0.2, scale: 1.3 },
      { kind: 'giant-tree', position: { x: 28, y: 0, z: -28 }, yaw: 1.4, scale: 1.2 },
      { kind: 'giant-tree', position: { x: 64, y: 0.4, z: -72 }, yaw: 0.8, scale: 1.45 },
      { kind: 'giant-tree', position: { x: 112, y: 0.6, z: 22 }, yaw: 2.1, scale: 1.35 },
      { kind: 'giant-tree', position: { x: 148, y: 1.2, z: 96 }, yaw: 0.5, scale: 1.25 },
      { kind: 'giant-tree', position: { x: -58, y: 1.6, z: 158 }, yaw: 1.9, scale: 1.4 },
      { kind: 'giant-tree', position: { x: -126, y: 1.2, z: 96 }, yaw: 0.3, scale: 1.3 },
      { kind: 'giant-tree', position: { x: -34, y: 0.2, z: 32 }, yaw: 1.1, scale: 1.15 },
      { kind: 'crystal-cluster', position: { x: 20, y: 0, z: -72 }, yaw: 0.4, scale: 1.3, variant: 0 },
      { kind: 'crystal-cluster', position: { x: 96, y: 1.4, z: -92 }, yaw: 1.2, scale: 1.5, variant: 1 },
      { kind: 'crystal-cluster', position: { x: 86, y: 2.6, z: 180 }, yaw: 0.7, scale: 1.65, variant: 0 },
      { kind: 'crystal-cluster', position: { x: 14, y: 3.4, z: 184 }, yaw: 2.2, scale: 1.45, variant: 1 },
      { kind: 'crystal-cluster', position: { x: -74, y: 0.8, z: 64 }, yaw: 0.9, scale: 1.35, variant: 0 },
      { kind: 'crystal-cluster', position: { x: -24, y: 0.2, z: 108 }, yaw: 1.7, scale: 1.2, variant: 1 },
      { kind: 'cypress-tree', position: { x: 52, y: 0.6, z: 102 }, yaw: 0.4, scale: 1.35 },
      { kind: 'cypress-tree', position: { x: 162, y: 1.2, z: 54 }, yaw: 1.3, scale: 1.25 },
    );

    return scenery;
  },
});
