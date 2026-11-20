import { Document, Node } from '@gltf-transform/core';
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
  id: string;
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  accentRgb: [number, number, number];
  furOrSkinRgb: [number, number, number];
  earStyle: 'fox' | 'helmet' | 'visor' | 'crown' | 'cap' | 'hood' | 'bandana' | 'ushanka';
  hasTail: boolean;
  hasScarf: boolean;
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

export async function buildCharacterGlb(
  spec: CharacterBuildSpec,
  outPath: string,
): Promise<number> {
  const doc = new Document();
  const root = doc.createNode(`Character_${spec.id}_Root`);
  doc.createScene('Scene').addChild(root);

  const furMat = createPbrMaterial(doc, {
    name: `${spec.id}_Fur`,
    baseColorFactor: [...spec.furOrSkinRgb, 1],
    roughnessFactor: 0.65,
    metallicFactor: 0.04,
  });

  const jacketMat = createPbrMaterial(doc, {
    name: `${spec.id}_Jacket`,
    baseColorFactor: [...spec.primaryRgb, 1],
    roughnessFactor: 0.52,
    metallicFactor: 0.1,
  });

  const creamMat = createPbrMaterial(doc, {
    name: `${spec.id}_Cream`,
    baseColorFactor: [0.98, 0.94, 0.85, 1],
    roughnessFactor: 0.72,
  });

  const accentMat = createPbrMaterial(doc, {
    name: `${spec.id}_Accent`,
    baseColorFactor: [...spec.accentRgb, 1],
    roughnessFactor: 0.35,
    metallicFactor: 0.2,
  });

  const secondaryMat = createPbrMaterial(doc, {
    name: `${spec.id}_Secondary`,
    baseColorFactor: [...spec.secondaryRgb, 1],
    roughnessFactor: 0.48,
    metallicFactor: 0.15,
  });

  const darkMat = createPbrMaterial(doc, {
    name: `${spec.id}_Dark`,
    baseColorFactor: [0.08, 0.09, 0.12, 1],
    roughnessFactor: 0.25,
    metallicFactor: 0.2,
  });

  const lensMat = createPbrMaterial(doc, {
    name: `${spec.id}_Lens`,
    baseColorFactor: [0.98, 0.75, 0.15, 1],
    emissiveFactor: [0.22, 0.14, 0.02],
    roughnessFactor: 0.12,
    metallicFactor: 0.4,
  });

  // Hip / Seated pelvis anchor
  const pelvis = doc.createNode('Pelvis');
  root.addChild(pelvis);

  const hipGeom = buildLatheMesh(
    [
      { x: 0.18, y: 0 },
      { x: 0.22, y: 0.1 },
      { x: 0.19, y: 0.2 },
    ],
    14,
  );
  addMeshToNode(doc, pelvis, 'HipMesh', hipGeom, secondaryMat);

  // Seated legs angled forward toward pedals
  for (const side of [-1, 1] as const) {
    const legGeom = buildTubeAlongPath(
      [
        { x: side * 0.12, y: 0.08, z: 0.0 },
        { x: side * 0.15, y: 0.06, z: -0.26 },
        { x: side * 0.14, y: -0.02, z: -0.44 },
      ],
      0.065,
      10,
      false,
    );
    addMeshToNode(doc, pelvis, `Leg_${side < 0 ? 'L' : 'R'}`, legGeom, secondaryMat);

    const bootGeom = buildBoxBeveled(0.11, 0.09, 0.16, 0.03);
    const bootNode = addMeshToNode(
      doc,
      pelvis,
      `Boot_${side < 0 ? 'L' : 'R'}`,
      bootGeom,
      darkMat,
    );
    bootNode.setTranslation([side * 0.14, -0.03, -0.48]);
  }

  // Torso (animated)
  const torso = doc.createNode('Torso').setTranslation([0, 0.18, 0]);
  pelvis.addChild(torso);

  const torsoGeom = buildLatheMesh(
    [
      { x: 0.17, y: 0 },
      { x: 0.24, y: 0.14 },
      { x: 0.25, y: 0.28 },
      { x: 0.19, y: 0.37 },
      { x: 0.1, y: 0.42 },
    ],
    16,
  );
  addMeshToNode(doc, torso, 'TorsoMesh', torsoGeom, jacketMat);

  // Sculpted chest bib & jacket collar
  const chestGeom = buildBoxBeveled(0.22, 0.24, 0.12, 0.04);
  const chestNode = addMeshToNode(doc, torso, 'ChestBib', chestGeom, creamMat);
  chestNode.setTranslation([0, 0.21, -0.17]);

  const collarGeom = buildLatheMesh(
    [
      { x: 0.16, y: 0.35 },
      { x: 0.21, y: 0.39 },
      { x: 0.18, y: 0.45 },
    ],
    14,
  );
  addMeshToNode(doc, torso, 'JacketCollar', collarGeom, accentMat);

  // Flowing scarf tail (animated)
  const scarfTail = doc.createNode('ScarfTail').setTranslation([0.08, 0.38, 0.14]);
  torso.addChild(scarfTail);
  if (spec.hasScarf) {
    const scarfGeom = buildTubeAlongPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 0.06, y: -0.04, z: 0.18 },
        { x: 0.1, y: -0.08, z: 0.36 },
      ],
      0.045,
      8,
      false,
    );
    addMeshToNode(doc, scarfTail, 'ScarfRibbon', scarfGeom, accentMat);
  }

  // Tail (animated)
  const tailBase = doc.createNode('TailBase').setTranslation([0, 0.06, 0.18]);
  pelvis.addChild(tailBase);
  if (spec.hasTail) {
    const tailMainGeom = buildTubeAlongPath(
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0.14, z: 0.24 },
        { x: 0, y: 0.32, z: 0.38 },
      ],
      0.085,
      10,
      false,
    );
    addMeshToNode(doc, tailBase, 'TailBody', tailMainGeom, furMat);

    const tailTipGeom = buildLatheMesh(
      [
        { x: 0.08, y: 0 },
        { x: 0.1, y: 0.08 },
        { x: 0.01, y: 0.19 },
      ],
      10,
    );
    const tailTip = addMeshToNode(doc, tailBase, 'TailTip', tailTipGeom, creamMat);
    tailTip.setTranslation([0, 0.32, 0.38]);
    tailTip.setRotation([0.65, 0, 0, 0.76]);
  }

  // Head assembly (animated)
  const head = doc.createNode('Head').setTranslation([0, 0.44, -0.02]);
  torso.addChild(head);

  const headGeom = buildLatheMesh(
    [
      { x: 0.12, y: 0 },
      { x: 0.22, y: 0.09 },
      { x: 0.23, y: 0.2 },
      { x: 0.19, y: 0.3 },
      { x: 0.09, y: 0.36 },
      { x: 0.01, y: 0.38 },
    ],
    18,
  );
  addMeshToNode(doc, head, 'HeadCranium', headGeom, furMat);

  // Cheek tufts & snout for expressive silhouette
  const snoutGeom = buildLatheMesh(
    [
      { x: 0.11, y: 0 },
      { x: 0.09, y: 0.08 },
      { x: 0.045, y: 0.16 },
      { x: 0.01, y: 0.18 },
    ],
    12,
  );
  const snout = addMeshToNode(doc, head, 'Snout', snoutGeom, creamMat);
  snout.setTranslation([0, 0.14, -0.17]);
  snout.setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);

  const noseGeom = buildBoxBeveled(0.055, 0.04, 0.05, 0.015);
  const nose = addMeshToNode(doc, head, 'Nose', noseGeom, darkMat);
  nose.setTranslation([0, 0.15, -0.35]);

  // Glossy expressive eyes & brows
  for (const side of [-1, 1] as const) {
    const eyeWhite = buildBoxBeveled(0.065, 0.075, 0.04, 0.018);
    const eyeNode = addMeshToNode(
      doc,
      head,
      `Eye_${side < 0 ? 'L' : 'R'}`,
      eyeWhite,
      creamMat,
    );
    eyeNode.setTranslation([side * 0.085, 0.21, -0.21]);

    const pupilGeom = buildBoxBeveled(0.036, 0.048, 0.03, 0.01);
    const pupilNode = addMeshToNode(
      doc,
      head,
      `Pupil_${side < 0 ? 'L' : 'R'}`,
      pupilGeom,
      darkMat,
    );
    pupilNode.setTranslation([side * 0.085, 0.21, -0.228]);

    const browGeom = buildBoxBeveled(0.075, 0.024, 0.035, 0.008);
    const browNode = addMeshToNode(
      doc,
      head,
      `Brow_${side < 0 ? 'L' : 'R'}`,
      browGeom,
      darkMat,
    );
    browNode.setTranslation([side * 0.09, 0.268, -0.215]);
  }

  // Aviator goggles resting on brow
  const goggleStrap = buildTubeAlongPath(
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
  );
  addMeshToNode(doc, head, 'GoggleStrap', goggleStrap, darkMat);

  for (const side of [-1, 1] as const) {
    const rimGeom = buildLatheMesh(
      [
        { x: 0.07, y: 0 },
        { x: 0.075, y: 0.04 },
        { x: 0.055, y: 0.055 },
      ],
      14,
    );
    const rimNode = addMeshToNode(
      doc,
      head,
      `GoggleRim_${side < 0 ? 'L' : 'R'}`,
      rimGeom,
      secondaryMat,
    );
    rimNode.setTranslation([side * 0.095, 0.31, -0.18]);
    rimNode.setRotation([0.55, 0, 0, 0.835]);

    const glassGeom = buildLatheMesh(
      [
        { x: 0.052, y: 0 },
        { x: 0.052, y: 0.035 },
      ],
      14,
    );
    const glassNode = addMeshToNode(
      doc,
      head,
      `GoggleLens_${side < 0 ? 'L' : 'R'}`,
      glassGeom,
      lensMat,
    );
    glassNode.setTranslation([side * 0.095, 0.315, -0.19]);
    glassNode.setRotation([0.55, 0, 0, 0.835]);
  }

  // Articulated ears
  const earProfile = [
    { x: -0.075, y: 0 },
    { x: 0.075, y: 0 },
    { x: 0.025, y: 0.21 },
    { x: -0.02, y: 0.22 },
  ];
  const earGeom = buildExtrudedProfile(earProfile, 0.05, 0.015);
  const earTipGeom = buildExtrudedProfile(
    [
      { x: -0.042, y: 0.14 },
      { x: 0.042, y: 0.14 },
      { x: 0.01, y: 0.23 },
    ],
    0.055,
    0.01,
  );

  const earL = doc.createNode('EarL').setTranslation([-0.13, 0.31, 0.01]);
  earL.setRotation([0, 0, 0.18, 0.983]);
  head.addChild(earL);
  addMeshToNode(doc, earL, 'EarLMesh', earGeom, furMat);
  addMeshToNode(doc, earL, 'EarLTip', earTipGeom, darkMat);

  const earR = doc.createNode('EarR').setTranslation([0.13, 0.31, 0.01]);
  earR.setRotation([0, 0, -0.18, 0.983]);
  head.addChild(earR);
  addMeshToNode(doc, earR, 'EarRMesh', earGeom, furMat);
  addMeshToNode(doc, earR, 'EarRTip', earTipGeom, darkMat);

  // Articulated arms reaching forward toward kart steering wheel
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
  const gloveL = addMeshToNode(doc, armL, 'GloveL', gloveGeom, darkMat);
  gloveL.setTranslation([0.04, -0.08, -0.34]);

  const armR = doc.createNode('ArmR').setTranslation([0.22, 0.31, -0.02]);
  torso.addChild(armR);
  addMeshToNode(doc, armR, 'ArmRMesh', armGeom, jacketMat);
  const gloveR = addMeshToNode(doc, armR, 'GloveR', gloveGeom, darkMat);
  gloveR.setTranslation([-0.04, -0.08, -0.34]);

  // Helper to build all 9 required AnimationClips cleanly
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

  // 1. idle
  buildClip(
    'idle',
    [0, 0.8, 1.6],
    [
      [0.03, 0, 0],
      [-0.02, 0.03, 0],
      [0.03, 0, 0],
    ],
    [
      [0.02, -0.06, 0],
      [-0.03, 0.08, 0],
      [0.02, -0.06, 0],
    ],
    [
      [0, 0, 0],
      [-0.04, 0, 0],
      [0, 0, 0],
    ],
    [
      [0, 0, 0],
      [-0.04, 0, 0],
      [0, 0, 0],
    ],
    [
      [0, 0, 0.18],
      [-0.08, 0, 0.24],
      [0, 0, 0.18],
    ],
    [
      [0, 0, -0.18],
      [-0.06, 0, -0.22],
      [0, 0, -0.18],
    ],
    [
      [0, -0.18, 0],
      [0.05, 0.18, 0],
      [0, -0.18, 0],
    ],
    [
      [0.05, -0.1, 0],
      [-0.05, 0.1, 0],
      [0.05, -0.1, 0],
    ],
  );

  // 2. drive
  buildClip(
    'drive',
    [0, 0.22, 0.44],
    [
      [0.1, 0, 0],
      [0.13, 0, 0.02],
      [0.1, 0, 0],
    ],
    [
      [-0.06, 0, 0],
      [-0.09, 0.02, 0],
      [-0.06, 0, 0],
    ],
    [
      [-0.05, 0, 0],
      [-0.09, 0.03, 0],
      [-0.05, 0, 0],
    ],
    [
      [-0.05, 0, 0],
      [-0.09, -0.03, 0],
      [-0.05, 0, 0],
    ],
    [
      [-0.25, 0, 0.18],
      [-0.32, 0, 0.2],
      [-0.25, 0, 0.18],
    ],
    [
      [-0.25, 0, -0.18],
      [-0.32, 0, -0.2],
      [-0.25, 0, -0.18],
    ],
    [
      [-0.12, -0.15, 0],
      [-0.16, 0.15, 0],
      [-0.12, -0.15, 0],
    ],
    [
      [-0.15, -0.22, 0.05],
      [-0.08, 0.22, -0.05],
      [-0.15, -0.22, 0.05],
    ],
  );

  // 3. turnLeft
  buildClip(
    'turnLeft',
    [0, 0.25, 0.5],
    [
      [0.12, 0.12, 0.22],
      [0.14, 0.15, 0.26],
      [0.12, 0.12, 0.22],
    ],
    [
      [-0.04, 0.28, 0.1],
      [-0.06, 0.32, 0.12],
      [-0.04, 0.28, 0.1],
    ],
    [
      [0.14, 0.1, 0],
      [0.16, 0.12, 0],
      [0.14, 0.1, 0],
    ],
    [
      [-0.22, 0.12, 0],
      [-0.24, 0.14, 0],
      [-0.22, 0.12, 0],
    ],
    [
      [-0.25, 0.1, 0.32],
      [-0.3, 0.12, 0.36],
      [-0.25, 0.1, 0.32],
    ],
    [
      [-0.25, 0.1, -0.08],
      [-0.3, 0.12, -0.05],
      [-0.25, 0.1, -0.08],
    ],
    [
      [-0.1, -0.35, -0.12],
      [-0.12, -0.28, -0.15],
      [-0.1, -0.35, -0.12],
    ],
    [
      [-0.18, -0.32, -0.12],
      [-0.12, -0.4, -0.16],
      [-0.18, -0.32, -0.12],
    ],
  );

  // 4. turnRight
  buildClip(
    'turnRight',
    [0, 0.25, 0.5],
    [
      [0.12, -0.12, -0.22],
      [0.14, -0.15, -0.26],
      [0.12, -0.12, -0.22],
    ],
    [
      [-0.04, -0.28, -0.1],
      [-0.06, -0.32, -0.12],
      [-0.04, -0.28, -0.1],
    ],
    [
      [-0.22, -0.12, 0],
      [-0.24, -0.14, 0],
      [-0.22, -0.12, 0],
    ],
    [
      [0.14, -0.1, 0],
      [0.16, -0.12, 0],
      [0.14, -0.1, 0],
    ],
    [
      [-0.25, -0.1, 0.08],
      [-0.3, -0.12, 0.05],
      [-0.25, -0.1, 0.08],
    ],
    [
      [-0.25, -0.1, -0.32],
      [-0.3, -0.12, -0.36],
      [-0.25, -0.1, -0.32],
    ],
    [
      [-0.1, 0.35, 0.12],
      [-0.12, 0.28, 0.15],
      [-0.1, 0.35, 0.12],
    ],
    [
      [-0.18, 0.32, 0.12],
      [-0.12, 0.4, 0.16],
      [-0.18, 0.32, 0.12],
    ],
  );

  // 5. drift
  buildClip(
    'drift',
    [0, 0.18, 0.36],
    [
      [0.24, 0, 0.28],
      [0.27, 0.04, 0.31],
      [0.24, 0, 0.28],
    ],
    [
      [-0.12, -0.25, -0.08],
      [-0.15, -0.28, -0.1],
      [-0.12, -0.25, -0.08],
    ],
    [
      [-0.18, -0.12, 0.14],
      [-0.24, -0.14, 0.18],
      [-0.18, -0.12, 0.14],
    ],
    [
      [0.12, 0.1, -0.14],
      [0.16, 0.12, -0.18],
      [0.12, 0.1, -0.14],
    ],
    [
      [-0.42, 0, 0.34],
      [-0.5, 0, 0.38],
      [-0.42, 0, 0.34],
    ],
    [
      [-0.42, 0, -0.34],
      [-0.5, 0, -0.38],
      [-0.42, 0, -0.34],
    ],
    [
      [-0.24, -0.32, 0],
      [-0.28, 0.32, 0],
      [-0.24, -0.32, 0],
    ],
    [
      [-0.35, -0.38, 0.14],
      [-0.25, 0.38, -0.14],
      [-0.35, -0.38, 0.14],
    ],
  );

  // 6. hit
  buildClip(
    'hit',
    [0, 0.18, 0.4, 0.65],
    [
      [-0.26, 0.22, -0.18],
      [-0.34, -0.24, 0.22],
      [-0.12, 0.12, -0.08],
      [0.05, 0, 0],
    ],
    [
      [-0.22, -0.3, 0.15],
      [0.18, 0.35, -0.18],
      [-0.08, -0.12, 0.06],
      [0, 0, 0],
    ],
    [
      [0.45, 0, 0.55],
      [0.6, 0.2, 0.72],
      [0.25, 0, 0.25],
      [0, 0, 0],
    ],
    [
      [0.45, 0, -0.55],
      [0.6, -0.2, -0.72],
      [0.25, 0, -0.25],
      [0, 0, 0],
    ],
    [
      [0.25, 0, 0.45],
      [0.35, 0, 0.55],
      [0.1, 0, 0.28],
      [0, 0, 0.18],
    ],
    [
      [0.25, 0, -0.45],
      [0.35, 0, -0.55],
      [0.1, 0, -0.28],
      [0, 0, -0.18],
    ],
    [
      [0.2, 0.4, 0],
      [0.2, -0.4, 0],
      [0.1, 0.2, 0],
      [0, 0, 0],
    ],
    [
      [0.3, 0.3, 0],
      [0.2, -0.3, 0],
      [0.1, 0.15, 0],
      [0, 0, 0],
    ],
  );

  // 7. victory
  buildClip(
    'victory',
    [0, 0.35, 0.7, 1.05],
    [
      [-0.08, 0, 0],
      [-0.14, 0.12, 0.06],
      [-0.06, -0.12, -0.06],
      [-0.08, 0, 0],
    ],
    [
      [0.12, 0, 0],
      [0.2, 0.18, 0],
      [0.16, -0.18, 0],
      [0.12, 0, 0],
    ],
    [
      [0.7, 0.2, 0.45],
      [1.15, 0.25, 0.65],
      [0.82, 0.15, 0.52],
      [0.7, 0.2, 0.45],
    ],
    [
      [0.7, -0.2, -0.45],
      [1.15, -0.25, -0.65],
      [0.82, -0.15, -0.52],
      [0.7, -0.2, -0.45],
    ],
    [
      [0.1, 0, 0.15],
      [0.24, 0, 0.1],
      [0.14, 0, 0.2],
      [0.1, 0, 0.15],
    ],
    [
      [0.1, 0, -0.15],
      [0.24, 0, -0.1],
      [0.14, 0, -0.2],
      [0.1, 0, -0.15],
    ],
    [
      [0.18, -0.42, 0],
      [0.24, 0.42, 0],
      [0.2, -0.35, 0],
      [0.18, -0.42, 0],
    ],
    [
      [0.1, -0.25, 0],
      [0.2, 0.25, 0],
      [0.12, -0.2, 0],
      [0.1, -0.25, 0],
    ],
    [
      [0, 0.18, 0],
      [0, 0.26, 0],
      [0, 0.2, 0],
      [0, 0.18, 0],
    ],
  );

  // 8. defeat
  buildClip(
    'defeat',
    [0, 0.65, 1.3],
    [
      [0.26, 0, 0],
      [0.32, 0.05, 0.04],
      [0.26, 0, 0],
    ],
    [
      [-0.28, -0.14, 0.08],
      [-0.34, 0.14, -0.08],
      [-0.28, -0.14, 0.08],
    ],
    [
      [-0.28, 0, 0.12],
      [-0.34, 0, 0.16],
      [-0.28, 0, 0.12],
    ],
    [
      [-0.28, 0, -0.12],
      [-0.34, 0, -0.16],
      [-0.28, 0, -0.12],
    ],
    [
      [-0.35, 0, 0.55],
      [-0.4, 0, 0.6],
      [-0.35, 0, 0.55],
    ],
    [
      [-0.35, 0, -0.55],
      [-0.4, 0, -0.6],
      [-0.35, 0, -0.55],
    ],
    [
      [-0.38, 0, 0],
      [-0.44, 0.06, 0],
      [-0.38, 0, 0],
    ],
    [
      [-0.2, 0, 0],
      [-0.24, 0.04, 0],
      [-0.2, 0, 0],
    ],
  );

  // 9. podium
  buildClip(
    'podium',
    [0, 0.45, 0.9, 1.35],
    [
      [0, -0.08, 0],
      [-0.08, 0.18, 0.06],
      [-0.04, 0.02, -0.05],
      [0, -0.08, 0],
    ],
    [
      [0.14, -0.1, 0],
      [0.22, 0.15, 0.05],
      [0.18, 0.05, -0.04],
      [0.14, -0.1, 0],
    ],
    [
      [0.95, 0.15, 0.55],
      [1.25, 0.25, 0.72],
      [0.92, 0.12, 0.5],
      [0.95, 0.15, 0.55],
    ],
    [
      [0.32, 0, -0.25],
      [0.75, -0.15, -0.5],
      [0.45, -0.05, -0.35],
      [0.32, 0, -0.25],
    ],
    [
      [0.15, 0, 0.15],
      [0.28, 0, 0.12],
      [0.2, 0, 0.18],
      [0.15, 0, 0.15],
    ],
    [
      [0.15, 0, -0.15],
      [0.28, 0, -0.12],
      [0.2, 0, -0.18],
      [0.15, 0, -0.15],
    ],
    [
      [0.2, -0.35, 0],
      [0.28, 0.35, 0],
      [0.22, -0.28, 0],
      [0.2, -0.35, 0],
    ],
    [
      [0.08, -0.22, 0],
      [0.16, 0.22, 0],
      [0.1, -0.18, 0],
      [0.08, -0.22, 0],
    ],
    [
      [0, 0.18, 0],
      [0, 0.28, 0],
      [0, 0.21, 0],
      [0, 0.18, 0],
    ],
  );

  // Ensure every node is reachable cleanly without unused node lint warnings
  void (root as Node);
  return writeGlb(doc, outPath);
}

export const NILO_BUILD_SPEC: CharacterBuildSpec = {
  id: 'nilo',
  primaryRgb: [0.46, 0.21, 0.1],
  secondaryRgb: [0.16, 0.2, 0.27],
  accentRgb: [0.05, 0.58, 0.54],
  furOrSkinRgb: [0.95, 0.45, 0.12],
  earStyle: 'fox',
  hasTail: true,
  hasScarf: true,
};
