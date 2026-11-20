import { Document, Node } from '@gltf-transform/core';
import {
  addMeshToNode,
  buildBoxBeveled,
  buildExtrudedProfile,
  buildLatheMesh,
  buildTubeAlongPath,
  createPbrMaterial,
  writeGlb,
} from './glb-builder';

export interface KartBuildSpec {
  id: string;
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  trimRgb: [number, number, number];
  spoilerStyle: 'dual-wing' | 'turbine' | 'arched' | 'offroad-bar';
  wheelRadiusFront: number;
  wheelRadiusRear: number;
  wheelWidthFront: number;
  wheelWidthRear: number;
}

function quatAxis(ax: number, ay: number, az: number, rad: number): [number, number, number, number] {
  const half = rad * 0.5;
  const s = Math.sin(half);
  const len = Math.hypot(ax, ay, az) || 1;
  return [(ax / len) * s, (ay / len) * s, (az / len) * s, Math.cos(half)];
}

function addWheelAssembly(
  doc: Document,
  parent: Node,
  name: string,
  radius: number,
  width: number,
  tireMat: ReturnType<typeof createPbrMaterial>,
  rimMat: ReturnType<typeof createPbrMaterial>,
  hubMat: ReturnType<typeof createPbrMaterial>,
): Node {
  const wheelNode = doc.createNode(name);
  parent.addChild(wheelNode);

  // Lathe cylinder rotated along X axis so tire rolls cleanly around X
  const hw = width * 0.5;
  const tireGeom = buildLatheMesh(
    [
      { x: radius * 0.58, y: -hw },
      { x: radius * 0.92, y: -hw },
      { x: radius, y: -hw * 0.65 },
      { x: radius, y: hw * 0.65 },
      { x: radius * 0.92, y: hw },
      { x: radius * 0.58, y: hw },
    ],
    20,
    true,
    true,
  );
  const tireNode = addMeshToNode(doc, wheelNode, `${name}_Tire`, tireGeom, tireMat);
  tireNode.setRotation(quatAxis(0, 0, 1, Math.PI * 0.5));

  const rimGeom = buildLatheMesh(
    [
      { x: 0.01, y: -hw * 0.78 },
      { x: radius * 0.6, y: -hw * 0.78 },
      { x: radius * 0.6, y: hw * 0.78 },
      { x: 0.01, y: hw * 0.78 },
    ],
    14,
  );
  const rimNode = addMeshToNode(doc, wheelNode, `${name}_Rim`, rimGeom, rimMat);
  rimNode.setRotation(quatAxis(0, 0, 1, Math.PI * 0.5));

  // Sculpted hubcap spokes tucked neatly inside the rim diameter
  const hubGeom = buildBoxBeveled(width * 0.92, 0.045, radius * 0.56, 0.012);
  addMeshToNode(doc, wheelNode, `${name}_HubBar`, hubGeom, hubMat);
  const hubCross = addMeshToNode(doc, wheelNode, `${name}_HubCross`, hubGeom, hubMat);
  hubCross.setRotation(quatAxis(1, 0, 0, Math.PI * 0.5));

  return wheelNode;
}

export async function buildKartGlb(spec: KartBuildSpec, outPath: string): Promise<number> {
  const doc = new Document();
  const kartRoot = doc.createNode('KartRoot');
  doc.createScene('Scene').addChild(kartRoot);

  const primaryMat = createPbrMaterial(doc, {
    name: `${spec.id}_Primary`,
    baseColorFactor: [...spec.primaryRgb, 1],
    metallicFactor: 0.32,
    roughnessFactor: 0.28,
  });

  const secondaryMat = createPbrMaterial(doc, {
    name: `${spec.id}_Secondary`,
    baseColorFactor: [...spec.secondaryRgb, 1],
    metallicFactor: 0.25,
    roughnessFactor: 0.45,
  });

  const trimMat = createPbrMaterial(doc, {
    name: `${spec.id}_Trim`,
    baseColorFactor: [...spec.trimRgb, 1],
    metallicFactor: 0.55,
    roughnessFactor: 0.26,
  });

  const chromeMat = createPbrMaterial(doc, {
    name: `${spec.id}_Chrome`,
    baseColorFactor: [0.82, 0.86, 0.92, 1],
    metallicFactor: 0.85,
    roughnessFactor: 0.2,
  });

  const tireMat = createPbrMaterial(doc, {
    name: `${spec.id}_Tire`,
    baseColorFactor: [0.1, 0.11, 0.13, 1],
    metallicFactor: 0.05,
    roughnessFactor: 0.85,
  });

  const headlightMat = createPbrMaterial(doc, {
    name: `${spec.id}_Headlight`,
    baseColorFactor: [1, 0.96, 0.82, 1],
    emissiveFactor: [0.95, 0.86, 0.55],
    roughnessFactor: 0.15,
  });

  const exhaustCoreMat = createPbrMaterial(doc, {
    name: `${spec.id}_ExhaustCore`,
    baseColorFactor: [0.95, 0.45, 0.12, 1],
    emissiveFactor: [0.55, 0.22, 0.04],
    roughnessFactor: 0.3,
  });

  // ChassisGroup suspends above axle line and tilts on acceleration/turns/drifts
  const chassisGroup = doc.createNode('ChassisGroup');
  kartRoot.addChild(chassisGroup);

  // Undertray skid floor
  const floorGeom = buildBoxBeveled(1.06, 0.12, 2.25, 0.04);
  const floorNode = addMeshToNode(doc, chassisGroup, 'Undertray', floorGeom, secondaryMat);
  floorNode.setTranslation([0, 0.22, 0.02]);

  // Sculpted side-profile nose + cowl extruded across width
  const bodySideProfile = [
    { x: -1.16, y: 0.24 },
    { x: -0.96, y: 0.45 },
    { x: -0.35, y: 0.56 },
    { x: 0.38, y: 0.58 },
    { x: 0.96, y: 0.68 },
    { x: 1.06, y: 0.32 },
    { x: -1.04, y: 0.2 },
  ];
  const centerBodyGeom = buildExtrudedProfile(bodySideProfile, 0.72, 0.05);
  const centerBody = addMeshToNode(doc, chassisGroup, 'MainCowl', centerBodyGeom, primaryMat);
  // Extrusion is in XY along Z -> rotate +90deg around Y so profile X maps to forward/back Z!
  centerBody.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  centerBody.setTranslation([0, 0, 0]);

  // Aerodynamic side pods
  for (const side of [-1, 1] as const) {
    const podGeom = buildBoxBeveled(0.32, 0.25, 1.24, 0.06);
    const podNode = addMeshToNode(
      doc,
      chassisGroup,
      `SidePod_${side < 0 ? 'L' : 'R'}`,
      podGeom,
      primaryMat,
    );
    podNode.setTranslation([side * 0.56, 0.34, 0.08]);

    const stripeGeom = buildBoxBeveled(0.34, 0.07, 1.08, 0.02);
    const stripeNode = addMeshToNode(
      doc,
      chassisGroup,
      `SideTrim_${side < 0 ? 'L' : 'R'}`,
      stripeGeom,
      trimMat,
    );
    stripeNode.setTranslation([side * 0.56, 0.38, 0.08]);
  }

  // Front tubular bumper & glowing dual headlights
  const bumperGeom = buildTubeAlongPath(
    [
      { x: -0.68, y: 0.24, z: -1.02 },
      { x: -0.58, y: 0.24, z: -1.24 },
      { x: 0.58, y: 0.24, z: -1.24 },
      { x: 0.68, y: 0.24, z: -1.02 },
    ],
    0.055,
    10,
    false,
  );
  addMeshToNode(doc, chassisGroup, 'FrontBumper', bumperGeom, trimMat);

  for (const side of [-1, 1] as const) {
    const lampGeom = buildLatheMesh(
      [
        { x: 0.07, y: 0 },
        { x: 0.075, y: 0.06 },
        { x: 0.01, y: 0.08 },
      ],
      12,
    );
    const lamp = addMeshToNode(
      doc,
      chassisGroup,
      `Headlight_${side < 0 ? 'L' : 'R'}`,
      lampGeom,
      headlightMat,
    );
    lamp.setTranslation([side * 0.34, 0.44, -1.05]);
    lamp.setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  }

  // Front & rear suspension struts connecting chassis to wheels
  for (const [label, zPos] of [
    ['FrontAxle', -0.84],
    ['RearAxle', 0.82],
  ] as const) {
    const axleGeom = buildTubeAlongPath(
      [
        { x: -0.82, y: 0.28, z: zPos },
        { x: 0, y: 0.24, z: zPos },
        { x: 0.82, y: 0.28, z: zPos },
      ],
      0.048,
      10,
      false,
    );
    addMeshToNode(doc, chassisGroup, label, axleGeom, chromeMat);
  }

  // Bolstered racing bucket seat
  const seatBase = addMeshToNode(
    doc,
    chassisGroup,
    'SeatCushion',
    buildBoxBeveled(0.46, 0.1, 0.44, 0.03),
    secondaryMat,
  );
  seatBase.setTranslation([0, 0.5, 0.22]);

  const seatBack = addMeshToNode(
    doc,
    chassisGroup,
    'SeatBackrest',
    buildBoxBeveled(0.46, 0.46, 0.11, 0.04),
    secondaryMat,
  );
  seatBack.setTranslation([0, 0.72, 0.42]);
  seatBack.setRotation([-0.18, 0, 0, 0.983]);

  // Driver mount socket (exact seat anchor for CharacterRig)
  const driverMount = doc.createNode('DriverMount').setTranslation([0, 0.54, 0.22]);
  chassisGroup.addChild(driverMount);

  // Steering column & animated SteeringWheel
  const columnGeom = buildTubeAlongPath(
    [
      { x: 0, y: 0.48, z: -0.34 },
      { x: 0, y: 0.72, z: -0.18 },
    ],
    0.036,
    10,
    false,
  );
  addMeshToNode(doc, chassisGroup, 'SteeringColumn', columnGeom, chromeMat);

  const steeringWheel = doc.createNode('SteeringWheel').setTranslation([0, 0.73, -0.17]);
  steeringWheel.setRotation([-0.48, 0, 0, 0.877]);
  chassisGroup.addChild(steeringWheel);

  const wheelRimPts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: Math.cos(a) * 0.16, y: Math.sin(a) * 0.16, z: 0 };
  });
  addMeshToNode(
    doc,
    steeringWheel,
    'SteeringRim',
    buildTubeAlongPath(wheelRimPts, 0.025, 8, true),
    secondaryMat,
  );
  addMeshToNode(
    doc,
    steeringWheel,
    'SteeringHub',
    buildBoxBeveled(0.28, 0.045, 0.035, 0.01),
    trimMat,
  );

  // Rear engine deck + sculpted spoiler wing
  const engineBlock = addMeshToNode(
    doc,
    chassisGroup,
    'EngineBlock',
    buildBoxBeveled(0.54, 0.28, 0.48, 0.05),
    chromeMat,
  );
  engineBlock.setTranslation([0, 0.62, 0.78]);

  for (const side of [-1, 1] as const) {
    const strut = addMeshToNode(
      doc,
      chassisGroup,
      `SpoilerStrut_${side < 0 ? 'L' : 'R'}`,
      buildBoxBeveled(0.06, 0.34, 0.18, 0.02),
      secondaryMat,
    );
    strut.setTranslation([side * 0.38, 0.82, 0.96]);
  }
  const spoilerWing = addMeshToNode(
    doc,
    chassisGroup,
    'RearSpoilerWing',
    buildBoxBeveled(1.34, 0.075, 0.32, 0.03),
    trimMat,
  );
  spoilerWing.setTranslation([0, 0.99, 1.0]);
  spoilerWing.setRotation([-0.14, 0, 0, 0.99]);

  // Twin angled chrome exhaust pipes
  for (const [idx, side] of ([-1, 1] as const).entries()) {
    const exName = idx === 0 ? 'ExhaustL' : 'ExhaustR';
    const exNode = doc.createNode(exName).setTranslation([side * 0.28, 0.56, 1.12]);
    chassisGroup.addChild(exNode);

    const pipeGeom = buildTubeAlongPath(
      [
        { x: 0, y: -0.05, z: -0.26 },
        { x: side * 0.04, y: 0.02, z: -0.08 },
        { x: side * 0.06, y: 0.14, z: 0.08 },
      ],
      0.065,
      12,
      false,
    );
    addMeshToNode(doc, exNode, `${exName}_Pipe`, pipeGeom, chromeMat);

    const tipCore = addMeshToNode(
      doc,
      exNode,
      `${exName}_Core`,
      buildLatheMesh(
        [
          { x: 0.048, y: 0 },
          { x: 0.048, y: 0.06 },
        ],
        10,
      ),
      exhaustCoreMat,
    );
    tipCore.setTranslation([side * 0.06, 0.13, 0.07]);
    tipCore.setRotation(quatAxis(1, 0, 0, 2.0));
  }

  // 4 independent rotating/steering wheels resting at Y = 0
  const fl = addWheelAssembly(
    doc,
    kartRoot,
    'WheelFL',
    spec.wheelRadiusFront,
    spec.wheelWidthFront,
    tireMat,
    chromeMat,
    trimMat,
  );
  fl.setTranslation([-0.82, spec.wheelRadiusFront, -0.84]);

  const fr = addWheelAssembly(
    doc,
    kartRoot,
    'WheelFR',
    spec.wheelRadiusFront,
    spec.wheelWidthFront,
    tireMat,
    chromeMat,
    trimMat,
  );
  fr.setTranslation([0.82, spec.wheelRadiusFront, -0.84]);

  const rl = addWheelAssembly(
    doc,
    kartRoot,
    'WheelRL',
    spec.wheelRadiusRear,
    spec.wheelWidthRear,
    tireMat,
    chromeMat,
    trimMat,
  );
  rl.setTranslation([-0.86, spec.wheelRadiusRear, 0.82]);

  const rr = addWheelAssembly(
    doc,
    kartRoot,
    'WheelRR',
    spec.wheelRadiusRear,
    spec.wheelWidthRear,
    tireMat,
    chromeMat,
    trimMat,
  );
  rr.setTranslation([0.86, spec.wheelRadiusRear, 0.82]);

  void (kartRoot as Node);
  return writeGlb(doc, outPath);
}

export const TRILHA_RAPOSA_BUILD_SPEC: KartBuildSpec = {
  id: 'trilha-raposa',
  primaryRgb: [0.96, 0.45, 0.09],
  secondaryRgb: [0.12, 0.16, 0.24],
  trimRgb: [0.98, 0.74, 0.14],
  spoilerStyle: 'dual-wing',
  wheelRadiusFront: 0.27,
  wheelRadiusRear: 0.33,
  wheelWidthFront: 0.25,
  wheelWidthRear: 0.34,
};
