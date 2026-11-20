import { Document, Node } from '@gltf-transform/core';
import type { KartId } from '../../src/game/core/types';
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
  id: KartId;
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  trimRgb: [number, number, number];
  chassisStyle:
    | 'rally'
    | 'armored-boiler'
    | 'star-dart'
    | 'forest-buggy'
    | 'classic-gt'
    | 'nautical-skiff'
    | 'dune-scorpion'
    | 'ice-blade';
  wheelRadiusFront: number;
  wheelRadiusRear: number;
  wheelWidthFront: number;
  wheelWidthRear: number;
}

export const KART_BUILD_SPECS: readonly KartBuildSpec[] = [
  {
    id: 'trilha-raposa',
    primaryRgb: [0.96, 0.45, 0.09],
    secondaryRgb: [0.12, 0.16, 0.24],
    trimRgb: [0.98, 0.74, 0.14],
    chassisStyle: 'rally',
    wheelRadiusFront: 0.27,
    wheelRadiusRear: 0.33,
    wheelWidthFront: 0.25,
    wheelWidthRear: 0.34,
  },
  {
    id: 'engrenagem-turbo',
    primaryRgb: [0.15, 0.39, 0.92],
    secondaryRgb: [0.28, 0.33, 0.41],
    trimRgb: [0.98, 0.8, 0.08],
    chassisStyle: 'armored-boiler',
    wheelRadiusFront: 0.3,
    wheelRadiusRear: 0.36,
    wheelWidthFront: 0.28,
    wheelWidthRear: 0.36,
  },
  {
    id: 'cometa-estelar',
    primaryRgb: [0.43, 0.16, 0.85],
    secondaryRgb: [0.06, 0.09, 0.16],
    trimRgb: [0.22, 0.75, 0.98],
    chassisStyle: 'star-dart',
    wheelRadiusFront: 0.25,
    wheelRadiusRear: 0.31,
    wheelWidthFront: 0.22,
    wheelWidthRear: 0.3,
  },
  {
    id: 'raiz-veloz',
    primaryRgb: [0.02, 0.59, 0.41],
    secondaryRgb: [0.47, 0.21, 0.06],
    trimRgb: [0.64, 0.9, 0.21],
    chassisStyle: 'forest-buggy',
    wheelRadiusFront: 0.31,
    wheelRadiusRear: 0.4,
    wheelWidthFront: 0.29,
    wheelWidthRear: 0.4,
  },
  {
    id: 'chave-mestra-gt',
    primaryRgb: [0.86, 0.15, 0.15],
    secondaryRgb: [0.96, 0.97, 0.99],
    trimRgb: [0.09, 0.11, 0.16],
    chassisStyle: 'classic-gt',
    wheelRadiusFront: 0.27,
    wheelRadiusRear: 0.33,
    wheelWidthFront: 0.24,
    wheelWidthRear: 0.32,
  },
  {
    id: 'brisa-corsaria',
    primaryRgb: [0.03, 0.57, 0.7],
    secondaryRgb: [0.96, 0.88, 0.7],
    trimRgb: [0.98, 0.44, 0.52],
    chassisStyle: 'nautical-skiff',
    wheelRadiusFront: 0.25,
    wheelRadiusRear: 0.3,
    wheelWidthFront: 0.22,
    wheelWidthRear: 0.29,
  },
  {
    id: 'escorpiao-dourado',
    primaryRgb: [0.85, 0.47, 0.02],
    secondaryRgb: [0.16, 0.15, 0.14],
    trimRgb: [0.99, 0.88, 0.28],
    chassisStyle: 'dune-scorpion',
    wheelRadiusFront: 0.3,
    wheelRadiusRear: 0.38,
    wheelWidthFront: 0.28,
    wheelWidthRear: 0.38,
  },
  {
    id: 'lamina-glacial',
    primaryRgb: [0.01, 0.52, 0.78],
    secondaryRgb: [0.89, 0.91, 0.94],
    trimRgb: [0.13, 0.83, 0.93],
    chassisStyle: 'ice-blade',
    wheelRadiusFront: 0.25,
    wheelRadiusRear: 0.32,
    wheelWidthFront: 0.23,
    wheelWidthRear: 0.31,
  },
] as const;

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
    18,
    true,
    true,
  );
  addMeshToNode(doc, wheelNode, `${name}_Tire`, tireGeom, tireMat).setRotation(
    quatAxis(0, 0, 1, Math.PI * 0.5),
  );

  const rimGeom = buildLatheMesh(
    [
      { x: 0.01, y: -hw * 0.78 },
      { x: radius * 0.6, y: -hw * 0.78 },
      { x: radius * 0.6, y: hw * 0.78 },
      { x: 0.01, y: hw * 0.78 },
    ],
    12,
  );
  addMeshToNode(doc, wheelNode, `${name}_Rim`, rimGeom, rimMat).setRotation(
    quatAxis(0, 0, 1, Math.PI * 0.5),
  );

  const hubGeom = buildBoxBeveled(width * 0.92, 0.045, radius * 0.56, 0.012);
  addMeshToNode(doc, wheelNode, `${name}_HubBar`, hubGeom, hubMat);
  addMeshToNode(doc, wheelNode, `${name}_HubCross`, hubGeom, hubMat).setRotation(
    quatAxis(1, 0, 0, Math.PI * 0.5),
  );

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

  const chassisGroup = doc.createNode('ChassisGroup');
  kartRoot.addChild(chassisGroup);

  // Undertray base
  addMeshToNode(
    doc,
    chassisGroup,
    'Undertray',
    buildBoxBeveled(1.06, 0.12, 2.28, 0.04),
    secondaryMat,
  ).setTranslation([0, 0.22, 0.02]);

  // Distinct Main Cowl Silhouette per kart archetype
  const profiles: Record<KartBuildSpec['chassisStyle'], Array<{ x: number; y: number }>> = {
    rally: [
      { x: -1.16, y: 0.24 },
      { x: -0.96, y: 0.45 },
      { x: -0.35, y: 0.56 },
      { x: 0.38, y: 0.58 },
      { x: 0.96, y: 0.68 },
      { x: 1.06, y: 0.32 },
    ],
    'armored-boiler': [
      { x: -1.15, y: 0.24 },
      { x: -1.12, y: 0.62 },
      { x: -0.42, y: 0.68 },
      { x: 0.45, y: 0.66 },
      { x: 1.05, y: 0.78 },
      { x: 1.12, y: 0.28 },
    ],
    'star-dart': [
      { x: -1.42, y: 0.24 },
      { x: -0.78, y: 0.44 },
      { x: -0.25, y: 0.52 },
      { x: 0.55, y: 0.58 },
      { x: 1.12, y: 0.46 },
      { x: 1.05, y: 0.24 },
    ],
    'forest-buggy': [
      { x: -1.12, y: 0.32 },
      { x: -0.82, y: 0.52 },
      { x: -0.2, y: 0.58 },
      { x: 0.48, y: 0.6 },
      { x: 0.98, y: 0.72 },
      { x: 1.02, y: 0.34 },
    ],
    'classic-gt': [
      { x: -1.28, y: 0.24 },
      { x: -1.22, y: 0.56 },
      { x: -0.45, y: 0.64 },
      { x: 0.45, y: 0.62 },
      { x: 1.12, y: 0.58 },
      { x: 1.14, y: 0.26 },
    ],
    'nautical-skiff': [
      { x: -1.36, y: 0.54 },
      { x: -0.95, y: 0.42 },
      { x: -0.2, y: 0.48 },
      { x: 0.65, y: 0.56 },
      { x: 1.08, y: 0.64 },
      { x: 0.96, y: 0.24 },
    ],
    'dune-scorpion': [
      { x: -1.1, y: 0.34 },
      { x: -0.75, y: 0.48 },
      { x: 0.1, y: 0.5 },
      { x: 0.88, y: 0.68 },
      { x: 1.06, y: 0.38 },
      { x: -0.98, y: 0.26 },
    ],
    'ice-blade': [
      { x: -1.38, y: 0.2 },
      { x: -0.88, y: 0.42 },
      { x: -0.32, y: 0.54 },
      { x: 0.58, y: 0.58 },
      { x: 1.12, y: 0.52 },
      { x: 1.05, y: 0.22 },
    ],
  };

  const cowlWidth = spec.chassisStyle === 'star-dart' || spec.chassisStyle === 'ice-blade' ? 0.58 : 0.76;
  const centerBody = addMeshToNode(
    doc,
    chassisGroup,
    'MainCowl',
    buildExtrudedProfile(profiles[spec.chassisStyle], cowlWidth, 0.05),
    primaryMat,
  );
  centerBody.setRotation(quatAxis(0, 1, 0, Math.PI * 0.5));

  // Style-specific structural silhouettes (wings, boilers, rollcages, fenders, ski blades!)
  switch (spec.chassisStyle) {
    case 'rally': {
      for (const side of [-1, 1] as const) {
        addMeshToNode(doc, chassisGroup, `SidePod_${side}`, buildBoxBeveled(0.32, 0.25, 1.24, 0.06), primaryMat).setTranslation([side * 0.56, 0.34, 0.08]);
        addMeshToNode(doc, chassisGroup, `SideTrim_${side}`, buildBoxBeveled(0.34, 0.07, 1.08, 0.02), trimMat).setTranslation([side * 0.56, 0.38, 0.08]);
      }
      addMeshToNode(doc, chassisGroup, 'RearSpoilerWing', buildBoxBeveled(1.34, 0.075, 0.32, 0.03), trimMat).setTranslation([0, 0.99, 1.0]);
      break;
    }
    case 'armored-boiler': {
      // Heavy front steel guard + rear copper boiler tank + golden side gears
      addMeshToNode(doc, chassisGroup, 'HeavyRam', buildBoxBeveled(1.48, 0.24, 0.24, 0.06), trimMat).setTranslation([0, 0.34, -1.24]);
      const boiler = addMeshToNode(
        doc,
        chassisGroup,
        'BoilerTank',
        buildLatheMesh([{ x: 0.34, y: -0.4 }, { x: 0.38, y: 0 }, { x: 0.34, y: 0.4 }], 14),
        trimMat,
      );
      boiler.setTranslation([0, 0.76, 0.85]);
      boiler.setRotation(quatAxis(0, 0, 1, Math.PI * 0.5));
      for (const side of [-1, 1] as const) {
        addMeshToNode(doc, chassisGroup, `ArmorSide_${side}`, buildBoxBeveled(0.28, 0.36, 1.15, 0.04), secondaryMat).setTranslation([side * 0.58, 0.42, 0.06]);
      }
      break;
    }
    case 'star-dart': {
      // Swept delta wings + glowing trim rails + tall central tailfin
      for (const side of [-1, 1] as const) {
        const wing = addMeshToNode(doc, chassisGroup, `DeltaWing_${side}`, buildBoxBeveled(0.68, 0.06, 0.85, 0.02), primaryMat);
        wing.setTranslation([side * 0.56, 0.36, 0.28]);
        wing.setRotation(quatAxis(0, 1, 0, -side * 0.38));
        const rail = addMeshToNode(doc, chassisGroup, `WingRail_${side}`, buildBoxBeveled(0.08, 0.09, 0.92, 0.02), headlightMat);
        rail.setTranslation([side * 0.84, 0.38, 0.38]);
      }
      addMeshToNode(doc, chassisGroup, 'CenterFin', buildBoxBeveled(0.08, 0.56, 0.65, 0.02), trimMat).setTranslation([0, 0.88, 0.88]);
      break;
    }
    case 'forest-buggy': {
      // Overarching off-road rollcage + front rally lightbar
      const cage = addMeshToNode(
        doc,
        chassisGroup,
        'TimberRollcage',
        buildTubeAlongPath(
          [
            { x: -0.45, y: 0.45, z: -0.35 },
            { x: -0.42, y: 1.38, z: 0.1 },
            { x: 0.42, y: 1.38, z: 0.1 },
            { x: 0.45, y: 0.45, z: -0.35 },
          ],
          0.052,
          8,
          false,
        ),
        secondaryMat,
      );
      void cage;
      addMeshToNode(doc, chassisGroup, 'BullbarRoofLights', buildBoxBeveled(0.7, 0.11, 0.12, 0.03), headlightMat).setTranslation([0, 1.44, 0.08]);
      break;
    }
    case 'classic-gt': {
      // Chrome radiator grille + sculpted wheel fenders + ducktail spoiler
      addMeshToNode(doc, chassisGroup, 'RadiatorGrille', buildBoxBeveled(0.58, 0.28, 0.1, 0.02), chromeMat).setTranslation([0, 0.38, -1.26]);
      for (const [fx, fz] of [[-0.82, -0.84], [0.82, -0.84], [-0.86, 0.82], [0.86, 0.82]] as const) {
        addMeshToNode(doc, chassisGroup, `Fender_${fx}_${fz}`, buildBoxBeveled(0.32, 0.07, 0.58, 0.025), primaryMat).setTranslation([fx, 0.62, fz]);
      }
      addMeshToNode(doc, chassisGroup, 'DucktailWing', buildBoxBeveled(1.1, 0.14, 0.24, 0.04), secondaryMat).setTranslation([0, 0.68, 1.12]);
      break;
    }
    case 'nautical-skiff': {
      // Upturned prow ring + deck rails + twin stern rudder fins
      const bowRing = addMeshToNode(
        doc,
        chassisGroup,
        'BowRing',
        buildLatheMesh([{ x: 0.11, y: -0.04 }, { x: 0.11, y: 0.04 }], 12),
        trimMat,
      );
      bowRing.setTranslation([0, 0.54, -1.4]);
      for (const side of [-1, 1] as const) {
        addMeshToNode(doc, chassisGroup, `DeckRail_${side}`, buildBoxBeveled(0.1, 0.14, 1.45, 0.03), secondaryMat).setTranslation([side * 0.44, 0.55, 0.02]);
        const rudder = addMeshToNode(doc, chassisGroup, `SternRudder_${side}`, buildBoxBeveled(0.06, 0.48, 0.36, 0.02), trimMat);
        rudder.setTranslation([side * 0.42, 0.84, 1.02]);
        rudder.setRotation(quatAxis(0, 0, 1, -side * 0.22));
      }
      break;
    }
    case 'dune-scorpion': {
      // Scorpion-tail overhead tubular frame + exposed rear V-engine scoop
      addMeshToNode(
        doc,
        chassisGroup,
        'ScorpionSpine',
        buildTubeAlongPath(
          [
            { x: 0, y: 0.45, z: -0.8 },
            { x: 0, y: 0.45, z: 0.95 },
            { x: 0, y: 1.38, z: 0.95 },
            { x: 0, y: 1.46, z: 0.15 },
          ],
          0.058,
          8,
          false,
        ),
        trimMat,
      );
      addMeshToNode(doc, chassisGroup, 'AirScoop', buildBoxBeveled(0.42, 0.2, 0.36, 0.04), primaryMat).setTranslation([0, 1.48, 0.18]);
      break;
    }
    case 'ice-blade': {
      // Twin front ski-blade outriggers + twin vertical ice-blade rear fins
      for (const side of [-1, 1] as const) {
        const ski = addMeshToNode(doc, chassisGroup, `FrontSki_${side}`, buildBoxBeveled(0.18, 0.05, 0.88, 0.02), trimMat);
        ski.setTranslation([side * 0.54, 0.14, -1.08]);
        addMeshToNode(doc, chassisGroup, `IceFin_${side}`, buildBoxBeveled(0.06, 0.46, 0.5, 0.02), headlightMat).setTranslation([side * 0.45, 0.78, 0.92]);
      }
      break;
    }
  }

  // Front bumper, headlights & axles
  addMeshToNode(
    doc,
    chassisGroup,
    'FrontBumper',
    buildTubeAlongPath(
      [
        { x: -0.68, y: 0.24, z: -1.02 },
        { x: -0.58, y: 0.24, z: -1.24 },
        { x: 0.58, y: 0.24, z: -1.24 },
        { x: 0.68, y: 0.24, z: -1.02 },
      ],
      0.052,
      8,
      false,
    ),
    trimMat,
  );

  for (const side of [-1, 1] as const) {
    const lamp = addMeshToNode(
      doc,
      chassisGroup,
      `Headlight_${side < 0 ? 'L' : 'R'}`,
      buildLatheMesh([{ x: 0.07, y: 0 }, { x: 0.075, y: 0.06 }, { x: 0.01, y: 0.08 }], 10),
      headlightMat,
    );
    lamp.setTranslation([side * 0.34, 0.44, -1.05]);
    lamp.setRotation(quatAxis(1, 0, 0, -Math.PI * 0.5));
  }

  for (const [label, zPos] of [
    ['FrontAxle', -0.84],
    ['RearAxle', 0.82],
  ] as const) {
    addMeshToNode(
      doc,
      chassisGroup,
      label,
      buildTubeAlongPath(
        [
          { x: -0.82, y: 0.28, z: zPos },
          { x: 0, y: 0.24, z: zPos },
          { x: 0.82, y: 0.28, z: zPos },
        ],
        0.048,
        8,
        false,
      ),
      chromeMat,
    );
  }

  // Seat + DriverMount + SteeringWheel
  addMeshToNode(doc, chassisGroup, 'SeatCushion', buildBoxBeveled(0.46, 0.1, 0.44, 0.03), secondaryMat).setTranslation([0, 0.5, 0.22]);
  const seatBack = addMeshToNode(doc, chassisGroup, 'SeatBackrest', buildBoxBeveled(0.46, 0.46, 0.11, 0.04), secondaryMat);
  seatBack.setTranslation([0, 0.72, 0.42]);
  seatBack.setRotation(quatAxis(1, 0, 0, -0.36));

  chassisGroup.addChild(doc.createNode('DriverMount').setTranslation([0, 0.54, 0.22]));

  addMeshToNode(
    doc,
    chassisGroup,
    'SteeringColumn',
    buildTubeAlongPath([{ x: 0, y: 0.48, z: -0.34 }, { x: 0, y: 0.72, z: -0.18 }], 0.036, 8, false),
    chromeMat,
  );

  const steeringWheel = doc.createNode('SteeringWheel').setTranslation([0, 0.73, -0.17]);
  steeringWheel.setRotation(quatAxis(1, 0, 0, -0.98));
  chassisGroup.addChild(steeringWheel);

  const wheelRimPts = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return { x: Math.cos(a) * 0.16, y: Math.sin(a) * 0.16, z: 0 };
  });
  addMeshToNode(doc, steeringWheel, 'SteeringRim', buildTubeAlongPath(wheelRimPts, 0.025, 6, true), secondaryMat);
  addMeshToNode(doc, steeringWheel, 'SteeringHub', buildBoxBeveled(0.28, 0.045, 0.035, 0.01), trimMat);

  // Rear engine block + Twin Exhausts
  addMeshToNode(doc, chassisGroup, 'EngineBlock', buildBoxBeveled(0.54, 0.28, 0.48, 0.05), chromeMat).setTranslation([0, 0.62, 0.78]);

  for (const [idx, side] of ([-1, 1] as const).entries()) {
    const exName = idx === 0 ? 'ExhaustL' : 'ExhaustR';
    const exNode = doc.createNode(exName).setTranslation([side * 0.28, 0.56, 1.12]);
    chassisGroup.addChild(exNode);

    const pipePoints =
      spec.chassisStyle === 'armored-boiler'
        ? [
            { x: 0, y: 0, z: -0.12 },
            { x: side * 0.08, y: 0.35, z: 0 },
            { x: side * 0.08, y: 0.72, z: 0.04 },
          ]
        : [
            { x: 0, y: -0.05, z: -0.26 },
            { x: side * 0.04, y: 0.02, z: -0.08 },
            { x: side * 0.06, y: 0.14, z: 0.08 },
          ];
    addMeshToNode(doc, exNode, `${exName}_Pipe`, buildTubeAlongPath(pipePoints, 0.065, 10, false), chromeMat);
    const tipCore = addMeshToNode(
      doc,
      exNode,
      `${exName}_Core`,
      buildLatheMesh([{ x: 0.048, y: 0 }, { x: 0.048, y: 0.06 }], 8),
      exhaustCoreMat,
    );
    const lastPt = pipePoints[pipePoints.length - 1];
    tipCore.setTranslation([lastPt.x, lastPt.y, lastPt.z]);
    tipCore.setRotation(quatAxis(1, 0, 0, spec.chassisStyle === 'armored-boiler' ? 0 : 2.0));
  }

  // 4 independent rotating/steering wheels touching Y = 0
  addWheelAssembly(doc, kartRoot, 'WheelFL', spec.wheelRadiusFront, spec.wheelWidthFront, tireMat, chromeMat, trimMat).setTranslation([-0.82, spec.wheelRadiusFront, -0.84]);
  addWheelAssembly(doc, kartRoot, 'WheelFR', spec.wheelRadiusFront, spec.wheelWidthFront, tireMat, chromeMat, trimMat).setTranslation([0.82, spec.wheelRadiusFront, -0.84]);
  addWheelAssembly(doc, kartRoot, 'WheelRL', spec.wheelRadiusRear, spec.wheelWidthRear, tireMat, chromeMat, trimMat).setTranslation([-0.86, spec.wheelRadiusRear, 0.82]);
  addWheelAssembly(doc, kartRoot, 'WheelRR', spec.wheelRadiusRear, spec.wheelWidthRear, tireMat, chromeMat, trimMat).setTranslation([0.86, spec.wheelRadiusRear, 0.82]);

  void (kartRoot as Node);
  return writeGlb(doc, outPath);
}
