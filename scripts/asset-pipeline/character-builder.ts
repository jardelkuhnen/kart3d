import { Document, Node } from '@gltf-transform/core';
import type { CharacterId } from '../../src/game/core/types';
import {
  type KeyframeTrackSpec,
  addAnimationClip,
  addMeshToNode,
  buildBoxBeveled,
  buildExtrudedProfile,
  buildLatheMesh,
  buildTubeAlongPath,
  createPbrMaterial,
  writeGlb,
} from './glb-builder';

export interface CharacterBuildSpec {
  id: CharacterId;
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  accentRgb: [number, number, number];
  furOrSkinRgb: [number, number, number];
  style:
    | 'fox'
    | 'inventor'
    | 'star-pilot'
    | 'forest'
    | 'mechanic'
    | 'navigator'
    | 'desert'
    | 'ice';
}

function quatAxis(ax: number, ay: number, az: number, rad: number): [number, number, number, number] {
  const half = rad * 0.5;
  const s = Math.sin(half);
  const len = Math.hypot(ax, ay, az) || 1;
  return [(ax / len) * s, (ay / len) * s, (az / len) * s, Math.cos(half)];
}

function eulerYzxToQuat(rx: number, ry: number, rz: number): [number, number, number, number] {
  const cx = Math.cos(rx * 0.5);
  const sx = Math.sin(rx * 0.5);
  const cy = Math.cos(ry * 0.5);
  const sy = Math.sin(ry * 0.5);
  const cz = Math.cos(rz * 0.5);
  const sz = Math.sin(rz * 0.5);

  const qx = sx * cy * cz + cx * sy * sz;
  const qy = cx * sy * cz - sx * cy * sz;
  const qz = cx * cy * sz + sx * sy * cz;
  const qw = cx * cy * cz - sx * sy * sz;
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  return [qx / len, qy / len, qz / len, qw / len];
}

function packQuatKeys(angles: ReadonlyArray<[number, number, number]>): Float32Array<ArrayBuffer> {
  const arr = new Float32Array(angles.length * 4);
  for (let i = 0; i < angles.length; i += 1) {
    const [qx, qy, qz, qw] = eulerYzxToQuat(angles[i][0], angles[i][1], angles[i][2]);
    arr[i * 4] = qx;
    arr[i * 4 + 1] = qy;
    arr[i * 4 + 2] = qz;
    arr[i * 4 + 3] = qw;
  }
  return arr;
}

function packVec3Keys(vecs: ReadonlyArray<[number, number, number]>): Float32Array<ArrayBuffer> {
  const arr = new Float32Array(vecs.length * 3);
  for (let i = 0; i < vecs.length; i += 1) {
    arr[i * 3] = vecs[i][0];
    arr[i * 3 + 1] = vecs[i][1];
    arr[i * 3 + 2] = vecs[i][2];
  }
  return arr;
}

export const CHARACTER_BUILD_SPECS: readonly CharacterBuildSpec[] = [
  {
    id: 'nilo',
    primaryRgb: [0.46, 0.21, 0.1],
    secondaryRgb: [0.16, 0.2, 0.27],
    accentRgb: [0.05, 0.58, 0.54],
    furOrSkinRgb: [0.95, 0.45, 0.12],
    style: 'fox',
  },
  {
    id: 'boro',
    primaryRgb: [0.15, 0.39, 0.92],
    secondaryRgb: [0.58, 0.42, 0.14],
    accentRgb: [0.98, 0.8, 0.08],
    furOrSkinRgb: [0.94, 0.78, 0.64],
    style: 'inventor',
  },
  {
    id: 'lumi',
    primaryRgb: [0.43, 0.18, 0.85],
    secondaryRgb: [0.12, 0.15, 0.28],
    accentRgb: [0.22, 0.75, 0.98],
    furOrSkinRgb: [0.92, 0.94, 1.0],
    style: 'star-pilot',
  },
  {
    id: 'kora',
    primaryRgb: [0.06, 0.56, 0.38],
    secondaryRgb: [0.42, 0.26, 0.12],
    accentRgb: [0.64, 0.9, 0.21],
    furOrSkinRgb: [0.85, 0.92, 0.78],
    style: 'forest',
  },
  {
    id: 'tiko',
    primaryRgb: [0.88, 0.18, 0.18],
    secondaryRgb: [0.14, 0.16, 0.22],
    accentRgb: [0.96, 0.97, 0.99],
    furOrSkinRgb: [0.96, 0.76, 0.58],
    style: 'mechanic',
  },
  {
    id: 'mavi',
    primaryRgb: [0.04, 0.62, 0.74],
    secondaryRgb: [0.14, 0.18, 0.32],
    accentRgb: [0.98, 0.44, 0.52],
    furOrSkinRgb: [0.94, 0.78, 0.64],
    style: 'navigator',
  },
  {
    id: 'runi',
    primaryRgb: [0.82, 0.45, 0.06],
    secondaryRgb: [0.36, 0.22, 0.1],
    accentRgb: [0.99, 0.88, 0.28],
    furOrSkinRgb: [0.86, 0.66, 0.46],
    style: 'desert',
  },
  {
    id: 'zera',
    primaryRgb: [0.06, 0.58, 0.9],
    secondaryRgb: [0.88, 0.95, 0.99],
    accentRgb: [0.42, 0.92, 0.99],
    furOrSkinRgb: [0.96, 0.88, 0.84],
    style: 'ice',
  },
] as const;

export async function buildCharacterGlb(
  spec: CharacterBuildSpec,
  outPath: string,
): Promise<number> {
  const doc = new Document();
  const root = doc.createNode(`Character_${spec.id}_Root`);
  doc.createScene('Scene').addChild(root);

  const skinMat = createPbrMaterial(doc, {
    name: `${spec.id}_Skin`,
    baseColorFactor: [...spec.furOrSkinRgb, 1],
    roughnessFactor: 0.65,
    metallicFactor: 0.04,
  });

  const jacketMat = createPbrMaterial(doc, {
    name: `${spec.id}_Jacket`,
    baseColorFactor: [...spec.primaryRgb, 1],
    roughnessFactor: 0.5,
    metallicFactor: 0.12,
  });

  const creamMat = createPbrMaterial(doc, {
    name: `${spec.id}_Cream`,
    baseColorFactor: [0.98, 0.94, 0.86, 1],
    roughnessFactor: 0.7,
  });

  const accentMat = createPbrMaterial(doc, {
    name: `${spec.id}_Accent`,
    baseColorFactor: [...spec.accentRgb, 1],
    roughnessFactor: 0.35,
    metallicFactor: 0.22,
  });

  const secondaryMat = createPbrMaterial(doc, {
    name: `${spec.id}_Secondary`,
    baseColorFactor: [...spec.secondaryRgb, 1],
    roughnessFactor: 0.48,
    metallicFactor: 0.22,
  });

  const darkMat = createPbrMaterial(doc, {
    name: `${spec.id}_Dark`,
    baseColorFactor: [0.08, 0.09, 0.12, 1],
    roughnessFactor: 0.25,
    metallicFactor: 0.2,
  });

  const glowMat = createPbrMaterial(doc, {
    name: `${spec.id}_Glow`,
    baseColorFactor: [...spec.accentRgb, 1],
    emissiveFactor: [
      spec.accentRgb[0] * 0.75,
      spec.accentRgb[1] * 0.75,
      spec.accentRgb[2] * 0.75,
    ],
    roughnessFactor: 0.16,
    metallicFactor: 0.4,
  });

  // Pelvis & seated legs
  const pelvis = doc.createNode('Pelvis');
  root.addChild(pelvis);

  addMeshToNode(
    doc,
    pelvis,
    'HipMesh',
    buildLatheMesh(
      [
        { x: 0.18, y: 0 },
        { x: 0.22, y: 0.1 },
        { x: 0.19, y: 0.2 },
      ],
      14,
    ),
    secondaryMat,
  );

  for (const side of [-1, 1] as const) {
    addMeshToNode(
      doc,
      pelvis,
      `Leg_${side < 0 ? 'L' : 'R'}`,
      buildTubeAlongPath(
        [
          { x: side * 0.12, y: 0.08, z: 0 },
          { x: side * 0.15, y: 0.06, z: -0.26 },
          { x: side * 0.14, y: -0.02, z: -0.44 },
        ],
        0.065,
        8,
        false,
      ),
      secondaryMat,
    );
    const bootNode = addMeshToNode(
      doc,
      pelvis,
      `Boot_${side < 0 ? 'L' : 'R'}`,
      buildBoxBeveled(0.11, 0.09, 0.16, 0.03),
      darkMat,
    );
    bootNode.setTranslation([side * 0.14, -0.03, -0.48]);
  }

  // Torso (animated)
  const torso = doc.createNode('Torso').setTranslation([0, 0.18, 0]);
  pelvis.addChild(torso);

  addMeshToNode(
    doc,
    torso,
    'TorsoMesh',
    buildLatheMesh(
      [
        { x: 0.17, y: 0 },
        { x: 0.24, y: 0.14 },
        { x: 0.25, y: 0.28 },
        { x: 0.19, y: 0.37 },
        { x: 0.1, y: 0.42 },
      ],
      14,
    ),
    jacketMat,
  );

  const chestNode = addMeshToNode(
    doc,
    torso,
    'ChestBib',
    buildBoxBeveled(0.22, 0.24, 0.12, 0.04),
    spec.style === 'fox' ? creamMat : accentMat,
  );
  chestNode.setTranslation([0, 0.21, -0.17]);

  addMeshToNode(
    doc,
    torso,
    'JacketCollar',
    buildLatheMesh(
      [
        { x: 0.16, y: 0.35 },
        { x: 0.21, y: 0.39 },
        { x: 0.18, y: 0.45 },
      ],
      14,
    ),
    spec.style === 'ice' ? creamMat : accentMat,
  );

  // Shoulder / back signature equipment
  if (spec.style === 'star-pilot' || spec.style === 'forest') {
    for (const side of [-1, 1] as const) {
      const pauldron = addMeshToNode(
        doc,
        torso,
        `Pauldron_${side < 0 ? 'L' : 'R'}`,
        buildBoxBeveled(0.14, 0.1, 0.18, 0.04),
        spec.style === 'star-pilot' ? glowMat : accentMat,
      );
      pauldron.setTranslation([side * 0.26, 0.35, 0]);
      pauldron.setRotation(quatAxis(0, 0, 1, -side * 0.28));
    }
  } else if (spec.style === 'mechanic') {
    // Oversized mechanic wrench strapped across back
    const wrenchShaft = addMeshToNode(
      doc,
      torso,
      'BackWrenchShaft',
      buildBoxBeveled(0.06, 0.56, 0.05, 0.015),
      creamMat,
    );
    wrenchShaft.setTranslation([0.04, 0.28, 0.22]);
    wrenchShaft.setRotation(quatAxis(0, 0, 1, 0.45));
  }

  // ScarfTail node (animated ribbon / cape / desert cloth)
  const scarfTail = doc.createNode('ScarfTail').setTranslation([0.08, 0.38, 0.14]);
  torso.addChild(scarfTail);
  if (
    spec.style === 'fox' ||
    spec.style === 'star-pilot' ||
    spec.style === 'navigator' ||
    spec.style === 'desert' ||
    spec.style === 'forest'
  ) {
    const isCape = spec.style === 'star-pilot' || spec.style === 'forest';
    addMeshToNode(
      doc,
      scarfTail,
      'ScarfRibbon',
      isCape
        ? buildBoxBeveled(0.36, 0.05, 0.42, 0.02)
        : buildTubeAlongPath(
            [
              { x: 0, y: 0, z: 0 },
              { x: 0.06, y: -0.04, z: 0.18 },
              { x: 0.1, y: -0.08, z: 0.36 },
            ],
            0.045,
            8,
            false,
          ),
      accentMat,
    ).setTranslation(isCape ? [-0.08, -0.08, 0.16] : [0, 0, 0]);
  }

  // TailBase node (fox tail / twin inventor tanks / ice crystal pack)
  const tailBase = doc.createNode('TailBase').setTranslation([0, 0.06, 0.18]);
  pelvis.addChild(tailBase);
  if (spec.style === 'fox') {
    addMeshToNode(
      doc,
      tailBase,
      'TailBody',
      buildTubeAlongPath(
        [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0.14, z: 0.24 },
          { x: 0, y: 0.32, z: 0.38 },
        ],
        0.085,
        10,
        false,
      ),
      skinMat,
    );
    const tip = addMeshToNode(
      doc,
      tailBase,
      'TailTip',
      buildLatheMesh(
        [
          { x: 0.08, y: 0 },
          { x: 0.1, y: 0.08 },
          { x: 0.01, y: 0.19 },
        ],
        10,
      ),
      creamMat,
    );
    tip.setTranslation([0, 0.32, 0.38]);
    tip.setRotation(quatAxis(1, 0, 0, 1.4));
  } else if (spec.style === 'inventor' || spec.style === 'ice') {
    for (const side of [-1, 1] as const) {
      const tank = addMeshToNode(
        doc,
        tailBase,
        `BackPackTank_${side < 0 ? 'L' : 'R'}`,
        buildLatheMesh(
          [
            { x: 0.075, y: 0 },
            { x: 0.08, y: 0.28 },
            { x: 0.02, y: 0.34 },
          ],
          10,
        ),
        spec.style === 'ice' ? glowMat : secondaryMat,
      );
      tank.setTranslation([side * 0.1, 0.12, 0.06]);
    }
  }

  // Head assembly (animated)
  const head = doc.createNode('Head').setTranslation([0, 0.44, -0.02]);
  torso.addChild(head);

  addMeshToNode(
    doc,
    head,
    'HeadCranium',
    buildLatheMesh(
      [
        { x: 0.12, y: 0 },
        { x: 0.22, y: 0.09 },
        { x: 0.23, y: 0.2 },
        { x: 0.19, y: 0.3 },
        { x: 0.09, y: 0.36 },
        { x: 0.01, y: 0.38 },
      ],
      16,
    ),
    spec.style === 'star-pilot' ? jacketMat : skinMat,
  );

  // Expressive facial features
  if (spec.style === 'fox') {
    const snout = addMeshToNode(
      doc,
      head,
      'Snout',
      buildLatheMesh(
        [
          { x: 0.11, y: 0 },
          { x: 0.09, y: 0.08 },
          { x: 0.045, y: 0.16 },
          { x: 0.01, y: 0.18 },
        ],
        12,
      ),
      creamMat,
    );
    snout.setTranslation([0, 0.14, -0.17]);
    snout.setRotation(quatAxis(1, 0, 0, -Math.PI * 0.5));

    const nose = addMeshToNode(doc, head, 'Nose', buildBoxBeveled(0.055, 0.04, 0.05, 0.015), darkMat);
    nose.setTranslation([0, 0.15, -0.35]);
  }

  if (spec.style === 'star-pilot' || spec.style === 'ice') {
    // Sleek glowing full visor across front of face
    const visor = addMeshToNode(
      doc,
      head,
      'TechVisor',
      buildBoxBeveled(0.34, 0.13, 0.16, 0.04),
      glowMat,
    );
    visor.setTranslation([0, 0.21, -0.16]);
  } else {
    for (const side of [-1, 1] as const) {
      const eyeNode = addMeshToNode(
        doc,
        head,
        `Eye_${side < 0 ? 'L' : 'R'}`,
        buildBoxBeveled(0.065, 0.075, 0.04, 0.018),
        creamMat,
      );
      eyeNode.setTranslation([side * 0.085, 0.2, -0.21]);

      const pupil = addMeshToNode(
        doc,
        head,
        `Pupil_${side < 0 ? 'L' : 'R'}`,
        buildBoxBeveled(0.036, 0.048, 0.03, 0.01),
        darkMat,
      );
      pupil.setTranslation([side * 0.085, 0.2, -0.228]);

      const brow = addMeshToNode(
        doc,
        head,
        `Brow_${side < 0 ? 'L' : 'R'}`,
        buildBoxBeveled(0.075, 0.024, 0.035, 0.008),
        darkMat,
      );
      brow.setTranslation([side * 0.09, 0.258, -0.215]);
    }
  }

  // Distinct Headgear per character
  switch (spec.style) {
    case 'fox':
    case 'inventor':
    case 'desert': {
      // Goggles on brow (fox aviator, inventor brass, desert mirrored)
      addMeshToNode(
        doc,
        head,
        'GoggleStrap',
        buildTubeAlongPath(
          [
            { x: -0.22, y: 0.29, z: -0.1 },
            { x: -0.23, y: 0.28, z: 0.05 },
            { x: 0, y: 0.28, z: 0.22 },
            { x: 0.23, y: 0.28, z: 0.05 },
            { x: 0.22, y: 0.29, z: -0.1 },
          ],
          0.025,
          8,
          false,
        ),
        darkMat,
      );
      for (const side of [-1, 1] as const) {
        const rim = addMeshToNode(
          doc,
          head,
          `GoggleRim_${side}`,
          buildLatheMesh(
            [
              { x: 0.07, y: 0 },
              { x: 0.075, y: 0.04 },
            ],
            12,
          ),
          secondaryMat,
        );
        rim.setTranslation([side * 0.095, 0.31, -0.18]);
        rim.setRotation(quatAxis(1, 0, 0, 1.15));

        const lens = addMeshToNode(
          doc,
          head,
          `GoggleLens_${side}`,
          buildLatheMesh(
            [
              { x: 0.052, y: 0 },
              { x: 0.052, y: 0.035 },
            ],
            12,
          ),
          glowMat,
        );
        lens.setTranslation([side * 0.095, 0.315, -0.19]);
        lens.setRotation(quatAxis(1, 0, 0, 1.15));
      }
      if (spec.style === 'inventor') {
        const dome = addMeshToNode(
          doc,
          head,
          'InventorDome',
          buildLatheMesh(
            [
              { x: 0.24, y: 0.24 },
              { x: 0.23, y: 0.36 },
              { x: 0.11, y: 0.45 },
              { x: 0.01, y: 0.47 },
            ],
            14,
          ),
          secondaryMat,
        );
        void dome;
      } else if (spec.style === 'desert') {
        const turban = addMeshToNode(
          doc,
          head,
          'DesertTurban',
          buildLatheMesh(
            [
              { x: 0.24, y: 0.22 },
              { x: 0.28, y: 0.32 },
              { x: 0.24, y: 0.42 },
              { x: 0.06, y: 0.46 },
            ],
            14,
          ),
          creamMat,
        );
        const crest = addMeshToNode(
          doc,
          head,
          'SunGem',
          buildBoxBeveled(0.08, 0.1, 0.06, 0.02),
          glowMat,
        );
        crest.setTranslation([0, 0.34, -0.25]);
        void turban;
      }
      break;
    }
    case 'star-pilot': {
      addMeshToNode(
        doc,
        head,
        'StarHelmetHalo',
        buildLatheMesh(
          [
            { x: 0.24, y: 0.22 },
            { x: 0.25, y: 0.3 },
            { x: 0.16, y: 0.42 },
            { x: 0.02, y: 0.46 },
          ],
          16,
        ),
        secondaryMat,
      );
      break;
    }
    case 'forest': {
      addMeshToNode(
        doc,
        head,
        'ForestCirclet',
        buildLatheMesh(
          [
            { x: 0.24, y: 0.26 },
            { x: 0.245, y: 0.32 },
          ],
          14,
        ),
        secondaryMat,
      );
      break;
    }
    case 'mechanic': {
      const cap = addMeshToNode(
        doc,
        head,
        'PitCap',
        buildLatheMesh(
          [
            { x: 0.24, y: 0.24 },
            { x: 0.23, y: 0.37 },
            { x: 0.05, y: 0.43 },
          ],
          14,
        ),
        jacketMat,
      );
      const brim = addMeshToNode(
        doc,
        head,
        'PitCapBrim',
        buildBoxBeveled(0.28, 0.04, 0.2, 0.015),
        accentMat,
      );
      brim.setTranslation([0, 0.26, 0.23]); // Backwards racing cap!
      void cap;
      break;
    }
    case 'navigator': {
      const hatBrim = addMeshToNode(
        doc,
        head,
        'TricornBrim',
        buildExtrudedProfile(
          [
            { x: -0.34, y: 0 },
            { x: 0.34, y: 0 },
            { x: 0.22, y: 0.09 },
            { x: -0.22, y: 0.09 },
          ],
          0.42,
          0.03,
        ),
        secondaryMat,
      );
      hatBrim.setTranslation([0, 0.3, 0]);
      const hatCrown = addMeshToNode(
        doc,
        head,
        'TricornCrown',
        buildLatheMesh(
          [
            { x: 0.21, y: 0.3 },
            { x: 0.18, y: 0.45 },
            { x: 0.02, y: 0.47 },
          ],
          12,
        ),
        jacketMat,
      );
      const plume = addMeshToNode(
        doc,
        head,
        'CaptainPlume',
        buildBoxBeveled(0.08, 0.14, 0.24, 0.03),
        accentMat,
      );
      plume.setTranslation([0.16, 0.45, 0.06]);
      void hatCrown;
      break;
    }
    case 'ice': {
      addMeshToNode(
        doc,
        head,
        'PolarHood',
        buildLatheMesh(
          [
            { x: 0.25, y: 0.16 },
            { x: 0.27, y: 0.28 },
            { x: 0.24, y: 0.4 },
            { x: 0.04, y: 0.46 },
          ],
          16,
        ),
        jacketMat,
      );
      const furTrim = addMeshToNode(
        doc,
        head,
        'HoodFurTrim',
        buildBoxBeveled(0.38, 0.11, 0.14, 0.04),
        creamMat,
      );
      furTrim.setTranslation([0, 0.31, -0.17]);
      break;
    }
  }

  // EarL & EarR nodes (animated fox ears / antennae / antlers / earcups / fur flaps)
  const earL = doc.createNode('EarL').setTranslation([-0.14, 0.31, 0.01]);
  earL.setRotation(quatAxis(0, 0, 1, 0.36));
  head.addChild(earL);

  const earR = doc.createNode('EarR').setTranslation([0.14, 0.31, 0.01]);
  earR.setRotation(quatAxis(0, 0, 1, -0.36));
  head.addChild(earR);

  if (spec.style === 'fox') {
    const earGeom = buildExtrudedProfile(
      [
        { x: -0.075, y: 0 },
        { x: 0.075, y: 0 },
        { x: 0.025, y: 0.21 },
        { x: -0.02, y: 0.22 },
      ],
      0.05,
      0.015,
    );
    const tipGeom = buildExtrudedProfile(
      [
        { x: -0.042, y: 0.14 },
        { x: 0.042, y: 0.14 },
        { x: 0.01, y: 0.23 },
      ],
      0.055,
      0.01,
    );
    addMeshToNode(doc, earL, 'EarLMesh', earGeom, skinMat);
    addMeshToNode(doc, earL, 'EarLTip', tipGeom, darkMat);
    addMeshToNode(doc, earR, 'EarRMesh', earGeom, skinMat);
    addMeshToNode(doc, earR, 'EarRTip', tipGeom, darkMat);
  } else if (spec.style === 'star-pilot' || spec.style === 'forest') {
    const rodGeom = buildTubeAlongPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0.22, z: 0.04 },
      ],
      0.028,
      8,
      false,
    );
    const bulbGeom = buildBoxBeveled(0.08, 0.08, 0.08, 0.025);
    addMeshToNode(doc, earL, 'AntlerL', rodGeom, secondaryMat);
    addMeshToNode(doc, earL, 'AntlerTipL', bulbGeom, glowMat).setTranslation([0, 0.24, 0.04]);
    addMeshToNode(doc, earR, 'AntlerR', rodGeom, secondaryMat);
    addMeshToNode(doc, earR, 'AntlerTipR', bulbGeom, glowMat).setTranslation([0, 0.24, 0.04]);
  } else if (spec.style === 'inventor' || spec.style === 'mechanic') {
    const cupGeom = buildLatheMesh(
      [
        { x: 0.09, y: -0.04 },
        { x: 0.095, y: 0.04 },
      ],
      10,
    );
    addMeshToNode(doc, earL, 'EarCupL', cupGeom, accentMat).setTranslation([-0.08, -0.1, 0]);
    addMeshToNode(doc, earR, 'EarCupR', cupGeom, accentMat).setTranslation([0.08, -0.1, 0]);
  } else {
    const flapGeom = buildBoxBeveled(0.08, 0.18, 0.12, 0.03);
    addMeshToNode(doc, earL, 'EarOrnL', flapGeom, accentMat).setTranslation([-0.08, -0.06, 0]);
    addMeshToNode(doc, earR, 'EarOrnR', flapGeom, accentMat).setTranslation([0.08, -0.06, 0]);
  }

  // Articulated arms reaching forward toward steering wheel
  const armGeom = buildTubeAlongPath(
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -0.1, z: -0.16 },
      { x: 0, y: -0.08, z: -0.31 },
    ],
    0.052,
    10,
    false,
  );
  const gloveGeom = buildBoxBeveled(0.095, 0.085, 0.11, 0.03);

  const armL = doc.createNode('ArmL').setTranslation([-0.22, 0.31, -0.02]);
  torso.addChild(armL);
  addMeshToNode(doc, armL, 'ArmLMesh', armGeom, jacketMat);
  addMeshToNode(doc, armL, 'GloveL', gloveGeom, darkMat).setTranslation([0.04, -0.08, -0.34]);

  const armR = doc.createNode('ArmR').setTranslation([0.22, 0.31, -0.02]);
  torso.addChild(armR);
  addMeshToNode(doc, armR, 'ArmRMesh', armGeom, jacketMat);
  addMeshToNode(doc, armR, 'GloveR', gloveGeom, darkMat).setTranslation([-0.04, -0.08, -0.34]);

  // All 9 mandatory AnimationClips targeting exact node hierarchy
  const buildClip = (
    name: string,
    times: number[],
    torsoAngles: Array<[number, number, number]>,
    headAngles: Array<[number, number, number]>,
    armLAngles: Array<[number, number, number]>,
    armRAngles: Array<[number, number, number]>,
    earLAngles: Array<[number, number, number]>,
    earRAngles: Array<[number, number, number]>,
    tailAngles: Array<[number, number, number]>,
    scarfAngles: Array<[number, number, number]>,
    torsoPositions?: Array<[number, number, number]>,
  ) => {
    const tArr = new Float32Array(times);
    const tracks: KeyframeTrackSpec[] = [
      { targetNode: torso, path: 'rotation', times: tArr, values: packQuatKeys(torsoAngles) },
      { targetNode: head, path: 'rotation', times: tArr, values: packQuatKeys(headAngles) },
      { targetNode: armL, path: 'rotation', times: tArr, values: packQuatKeys(armLAngles) },
      { targetNode: armR, path: 'rotation', times: tArr, values: packQuatKeys(armRAngles) },
      { targetNode: earL, path: 'rotation', times: tArr, values: packQuatKeys(earLAngles) },
      { targetNode: earR, path: 'rotation', times: tArr, values: packQuatKeys(earRAngles) },
      { targetNode: tailBase, path: 'rotation', times: tArr, values: packQuatKeys(tailAngles) },
      { targetNode: scarfTail, path: 'rotation', times: tArr, values: packQuatKeys(scarfAngles) },
    ];
    if (torsoPositions) {
      tracks.push({
        targetNode: torso,
        path: 'translation',
        times: tArr,
        values: packVec3Keys(torsoPositions),
      });
    }
    addAnimationClip(doc, name, tracks);
  };

  buildClip(
    'idle',
    [0, 0.8, 1.6],
    [[0.03, 0, 0], [-0.02, 0.03, 0], [0.03, 0, 0]],
    [[0.02, -0.06, 0], [-0.03, 0.08, 0], [0.02, -0.06, 0]],
    [[0, 0, 0], [-0.04, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [-0.04, 0, 0], [0, 0, 0]],
    [[0, 0, 0.18], [-0.08, 0, 0.24], [0, 0, 0.18]],
    [[0, 0, -0.18], [-0.06, 0, -0.22], [0, 0, -0.18]],
    [[0, -0.18, 0], [0.05, 0.18, 0], [0, -0.18, 0]],
    [[0.05, -0.1, 0], [-0.05, 0.1, 0], [0.05, -0.1, 0]],
  );
  buildClip(
    'drive',
    [0, 0.22, 0.44],
    [[0.1, 0, 0], [0.13, 0, 0.02], [0.1, 0, 0]],
    [[-0.06, 0, 0], [-0.09, 0.02, 0], [-0.06, 0, 0]],
    [[-0.05, 0, 0], [-0.09, 0.03, 0], [-0.05, 0, 0]],
    [[-0.05, 0, 0], [-0.09, -0.03, 0], [-0.05, 0, 0]],
    [[-0.25, 0, 0.18], [-0.32, 0, 0.2], [-0.25, 0, 0.18]],
    [[-0.25, 0, -0.18], [-0.32, 0, -0.2], [-0.25, 0, -0.18]],
    [[-0.12, -0.15, 0], [-0.16, 0.15, 0], [-0.12, -0.15, 0]],
    [[-0.15, -0.22, 0.05], [-0.08, 0.22, -0.05], [-0.15, -0.22, 0.05]],
  );
  buildClip(
    'turnLeft',
    [0, 0.25, 0.5],
    [[0.12, 0.12, 0.22], [0.14, 0.15, 0.26], [0.12, 0.12, 0.22]],
    [[-0.04, 0.28, 0.1], [-0.06, 0.32, 0.12], [-0.04, 0.28, 0.1]],
    [[0.14, 0.1, 0], [0.16, 0.12, 0], [0.14, 0.1, 0]],
    [[-0.22, 0.12, 0], [-0.24, 0.14, 0], [-0.22, 0.12, 0]],
    [[-0.25, 0.1, 0.32], [-0.3, 0.12, 0.36], [-0.25, 0.1, 0.32]],
    [[-0.25, 0.1, -0.08], [-0.3, 0.12, -0.05], [-0.25, 0.1, -0.08]],
    [[-0.1, -0.35, -0.12], [-0.12, -0.28, -0.15], [-0.1, -0.35, -0.12]],
    [[-0.18, -0.32, -0.12], [-0.12, -0.4, -0.16], [-0.18, -0.32, -0.12]],
  );
  buildClip(
    'turnRight',
    [0, 0.25, 0.5],
    [[0.12, -0.12, -0.22], [0.14, -0.15, -0.26], [0.12, -0.12, -0.22]],
    [[-0.04, -0.28, -0.1], [-0.06, -0.32, -0.12], [-0.04, -0.28, -0.1]],
    [[-0.22, -0.12, 0], [-0.24, -0.14, 0], [-0.22, -0.12, 0]],
    [[0.14, -0.1, 0], [0.16, -0.12, 0], [0.14, -0.1, 0]],
    [[-0.25, -0.1, 0.08], [-0.3, -0.12, 0.05], [-0.25, -0.1, 0.08]],
    [[-0.25, -0.1, -0.32], [-0.3, -0.12, -0.36], [-0.25, -0.1, -0.32]],
    [[-0.1, 0.35, 0.12], [-0.12, 0.28, 0.15], [-0.1, 0.35, 0.12]],
    [[-0.18, 0.32, 0.12], [-0.12, 0.4, 0.16], [-0.18, 0.32, 0.12]],
  );
  buildClip(
    'drift',
    [0, 0.18, 0.36],
    [[0.24, 0, 0.28], [0.27, 0.04, 0.31], [0.24, 0, 0.28]],
    [[-0.12, -0.25, -0.08], [-0.15, -0.28, -0.1], [-0.12, -0.25, -0.08]],
    [[-0.18, -0.12, 0.14], [-0.24, -0.14, 0.18], [-0.18, -0.12, 0.14]],
    [[0.12, 0.1, -0.14], [0.16, 0.12, -0.18], [0.12, 0.1, -0.14]],
    [[-0.42, 0, 0.34], [-0.5, 0, 0.38], [-0.42, 0, 0.34]],
    [[-0.42, 0, -0.34], [-0.5, 0, -0.38], [-0.42, 0, -0.34]],
    [[-0.24, -0.32, 0], [-0.28, 0.32, 0], [-0.24, -0.32, 0]],
    [[-0.35, -0.38, 0.14], [-0.25, 0.38, -0.14], [-0.35, -0.38, 0.14]],
  );
  buildClip(
    'hit',
    [0, 0.18, 0.4, 0.65],
    [[-0.26, 0.22, -0.18], [-0.34, -0.24, 0.22], [-0.12, 0.12, -0.08], [0.05, 0, 0]],
    [[-0.22, -0.3, 0.15], [0.18, 0.35, -0.18], [-0.08, -0.12, 0.06], [0, 0, 0]],
    [[0.45, 0, 0.55], [0.6, 0.2, 0.72], [0.25, 0, 0.25], [0, 0, 0]],
    [[0.45, 0, -0.55], [0.6, -0.2, -0.72], [0.25, 0, -0.25], [0, 0, 0]],
    [[0.25, 0, 0.45], [0.35, 0, 0.55], [0.1, 0, 0.28], [0, 0, 0.18]],
    [[0.25, 0, -0.45], [0.35, 0, -0.55], [0.1, 0, -0.28], [0, 0, -0.18]],
    [[0.2, 0.4, 0], [0.2, -0.4, 0], [0.1, 0.2, 0], [0, 0, 0]],
    [[0.3, 0.3, 0], [0.2, -0.3, 0], [0.1, 0.15, 0], [0, 0, 0]],
  );
  buildClip(
    'victory',
    [0, 0.35, 0.7, 1.05],
    [[-0.08, 0, 0], [-0.14, 0.12, 0.06], [-0.06, -0.12, -0.06], [-0.08, 0, 0]],
    [[0.12, 0, 0], [0.2, 0.18, 0], [0.16, -0.18, 0], [0.12, 0, 0]],
    [[0.7, 0.2, 0.45], [1.15, 0.25, 0.65], [0.82, 0.15, 0.52], [0.7, 0.2, 0.45]],
    [[0.7, -0.2, -0.45], [1.15, -0.25, -0.65], [0.82, -0.15, -0.52], [0.7, -0.2, -0.45]],
    [[0.1, 0, 0.15], [0.24, 0, 0.1], [0.14, 0, 0.2], [0.1, 0, 0.15]],
    [[0.1, 0, -0.15], [0.24, 0, -0.1], [0.14, 0, -0.2], [0.1, 0, -0.15]],
    [[0.18, -0.42, 0], [0.24, 0.42, 0], [0.2, -0.35, 0], [0.18, -0.42, 0]],
    [[0.1, -0.25, 0], [0.2, 0.25, 0], [0.12, -0.2, 0], [0.1, -0.25, 0]],
    [[0, 0.18, 0], [0, 0.26, 0], [0, 0.2, 0], [0, 0.18, 0]],
  );
  buildClip(
    'defeat',
    [0, 0.65, 1.3],
    [[0.26, 0, 0], [0.32, 0.05, 0.04], [0.26, 0, 0]],
    [[-0.28, -0.14, 0.08], [-0.34, 0.14, -0.08], [-0.28, -0.14, 0.08]],
    [[-0.28, 0, 0.12], [-0.34, 0, 0.16], [-0.28, 0, 0.12]],
    [[-0.28, 0, -0.12], [-0.34, 0, -0.16], [-0.28, 0, -0.12]],
    [[-0.35, 0, 0.55], [-0.4, 0, 0.6], [-0.35, 0, 0.55]],
    [[-0.35, 0, -0.55], [-0.4, 0, -0.6], [-0.35, 0, -0.55]],
    [[-0.38, 0, 0], [-0.44, 0.06, 0], [-0.38, 0, 0]],
    [[-0.2, 0, 0], [-0.24, 0.04, 0], [-0.2, 0, 0]],
  );
  buildClip(
    'podium',
    [0, 0.45, 0.9, 1.35],
    [[0, -0.08, 0], [-0.08, 0.18, 0.06], [-0.04, 0.02, -0.05], [0, -0.08, 0]],
    [[0.14, -0.1, 0], [0.22, 0.15, 0.05], [0.18, 0.05, -0.04], [0.14, -0.1, 0]],
    [[0.95, 0.15, 0.55], [1.25, 0.25, 0.72], [0.92, 0.12, 0.5], [0.95, 0.15, 0.55]],
    [[0.32, 0, -0.25], [0.75, -0.15, -0.5], [0.45, -0.05, -0.35], [0.32, 0, -0.25]],
    [[0.15, 0, 0.15], [0.28, 0, 0.12], [0.2, 0, 0.18], [0.15, 0, 0.15]],
    [[0.15, 0, -0.15], [0.28, 0, -0.12], [0.2, 0, -0.18], [0.15, 0, -0.15]],
    [[0.2, -0.35, 0], [0.28, 0.35, 0], [0.22, -0.28, 0], [0.2, -0.35, 0]],
    [[0.08, -0.22, 0], [0.16, 0.22, 0], [0.1, -0.18, 0], [0.08, -0.22, 0]],
    [[0, 0.18, 0], [0, 0.28, 0], [0, 0.21, 0], [0, 0.18, 0]],
  );

  void (root as Node);
  return writeGlb(doc, outPath);
}
