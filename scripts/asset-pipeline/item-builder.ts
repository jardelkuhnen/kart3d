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

function quatAxis(ax: number, ay: number, az: number, rad: number): [number, number, number, number] {
  const half = rad * 0.5;
  const s = Math.sin(half);
  const len = Math.hypot(ax, ay, az) || 1;
  return [(ax / len) * s, (ay / len) * s, (az / len) * s, Math.cos(half)];
}

export async function buildItemBoxGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('ItemBoxRoot');
  doc.createScene('Scene').addChild(root);

  const shellMat = createPbrMaterial(doc, {
    name: 'ItemBoxCrystalShell',
    baseColorFactor: [0.35, 0.82, 1.0, 0.85],
    emissiveFactor: [0.15, 0.45, 0.85],
    metallicFactor: 0.2,
    roughnessFactor: 0.15,
  });

  const rimMat = createPbrMaterial(doc, {
    name: 'ItemBoxGoldTrim',
    baseColorFactor: [1.0, 0.78, 0.12, 1],
    emissiveFactor: [0.25, 0.16, 0.02],
    metallicFactor: 0.65,
    roughnessFactor: 0.25,
  });

  const coreMat = createPbrMaterial(doc, {
    name: 'ItemBoxCoreStar',
    baseColorFactor: [1, 0.94, 0.45, 1],
    emissiveFactor: [0.95, 0.72, 0.15],
    roughnessFactor: 0.2,
  });

  const shellNode = addMeshToNode(
    doc,
    root,
    'ItemBoxShell',
    buildBoxBeveled(1.15, 1.15, 1.15, 0.14),
    shellMat,
  );
  shellNode.setRotation(quatAxis(1, 1, 0, 0.55));

  // Decorative orbital frame ring
  const ringPts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: Math.cos(a) * 0.88, y: 0, z: Math.sin(a) * 0.88 };
  });
  const ringNode = addMeshToNode(
    doc,
    root,
    'ItemBoxRing',
    buildTubeAlongPath(ringPts, 0.055, 8, true),
    rimMat,
  );
  ringNode.setRotation(quatAxis(1, 0, 0.4, 0.65));

  const coreNode = addMeshToNode(
    doc,
    root,
    'ItemBoxCore',
    buildLatheMesh(
      [
        { x: 0.01, y: -0.38 },
        { x: 0.28, y: 0 },
        { x: 0.01, y: 0.38 },
      ],
      6,
    ),
    coreMat,
  );
  void (coreNode as Node);

  return writeGlb(doc, outPath);
}

export async function buildPulsoSolarGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('PulsoSolarRoot');
  doc.createScene('Scene').addChild(root);

  const sunMat = createPbrMaterial(doc, {
    name: 'SolarCoreMat',
    baseColorFactor: [1.0, 0.68, 0.08, 1],
    emissiveFactor: [0.95, 0.52, 0.06],
    roughnessFactor: 0.2,
  });
  const flareMat = createPbrMaterial(doc, {
    name: 'SolarFlareMat',
    baseColorFactor: [1.0, 0.92, 0.35, 1],
    emissiveFactor: [0.9, 0.72, 0.12],
    roughnessFactor: 0.25,
  });

  addMeshToNode(
    doc,
    root,
    'SolarCore',
    buildLatheMesh(
      [
        { x: 0.01, y: -0.32 },
        { x: 0.32, y: 0 },
        { x: 0.01, y: 0.32 },
      ],
      14,
    ),
    sunMat,
  );
  const ringPts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: Math.cos(a) * 0.48, y: 0, z: Math.sin(a) * 0.48 };
  });
  const ring = addMeshToNode(
    doc,
    root,
    'SolarRing',
    buildTubeAlongPath(ringPts, 0.055, 8, true),
    flareMat,
  );
  ring.setRotation(quatAxis(1, 0, 0.5, 0.65));

  return writeGlb(doc, outPath);
}

export async function buildBolhaGuardiaGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('BolhaGuardiaRoot');
  doc.createScene('Scene').addChild(root);

  const shieldMat = createPbrMaterial(doc, {
    name: 'GuardianShieldMat',
    baseColorFactor: [0.22, 0.78, 1.0, 1],
    emissiveFactor: [0.1, 0.45, 0.85],
    roughnessFactor: 0.12,
    metallicFactor: 0.2,
  });
  const coreMat = createPbrMaterial(doc, {
    name: 'GuardianCoreMat',
    baseColorFactor: [0.85, 0.96, 1.0, 1],
    emissiveFactor: [0.45, 0.85, 1.0],
    roughnessFactor: 0.2,
  });

  const ringPts = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return { x: Math.cos(a) * 0.46, y: 0, z: Math.sin(a) * 0.46 };
  });
  addMeshToNode(doc, root, 'ShieldEquator', buildTubeAlongPath(ringPts, 0.06, 8, true), shieldMat);
  const meridian = addMeshToNode(
    doc,
    root,
    'ShieldMeridian',
    buildTubeAlongPath(ringPts, 0.05, 8, true),
    coreMat,
  );
  meridian.setRotation(quatAxis(1, 0, 0, Math.PI * 0.5));
  addMeshToNode(
    doc,
    root,
    'ShieldEmblem',
    buildBoxBeveled(0.32, 0.36, 0.14, 0.04),
    coreMat,
  );

  return writeGlb(doc, outPath);
}

export async function buildNevoaPrismaGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('NevoaPrismaRoot');
  doc.createScene('Scene').addChild(root);

  const pinkMat = createPbrMaterial(doc, {
    name: 'PrismCloudPink',
    baseColorFactor: [0.95, 0.32, 0.65, 1],
    emissiveFactor: [0.65, 0.12, 0.42],
    roughnessFactor: 0.35,
  });
  const violetMat = createPbrMaterial(doc, {
    name: 'PrismShardViolet',
    baseColorFactor: [0.65, 0.28, 0.96, 1],
    emissiveFactor: [0.35, 0.12, 0.72],
    roughnessFactor: 0.25,
  });

  const offsets: Array<[number, number, number, number]> = [
    [0, 0.35, 0, 1.0],
    [-0.45, 0.22, 0.32, 0.75],
    [0.48, 0.26, -0.28, 0.8],
    [0.12, 0.24, 0.48, 0.7],
    [-0.36, 0.24, -0.4, 0.72],
  ];
  offsets.forEach(([x, y, z, s], idx) => {
    const shard = addMeshToNode(
      doc,
      root,
      `PrismShard_${idx}`,
      buildLatheMesh(
        [
          { x: 0.28 * s, y: 0 },
          { x: 0.36 * s, y: 0.25 * s },
          { x: 0.02, y: 0.72 * s },
        ],
        6,
      ),
      idx % 2 === 0 ? pinkMat : violetMat,
    );
    shard.setTranslation([x, y, z]);
  });

  return writeGlb(doc, outPath);
}

export async function buildFaiscaRastreadoraGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('FaiscaRastreadoraRoot');
  doc.createScene('Scene').addChild(root);

  const crimsonMat = createPbrMaterial(doc, {
    name: 'SeekerCrimson',
    baseColorFactor: [0.96, 0.2, 0.25, 1],
    emissiveFactor: [0.75, 0.1, 0.12],
    roughnessFactor: 0.25,
  });
  const goldMat = createPbrMaterial(doc, {
    name: 'SeekerGold',
    baseColorFactor: [1.0, 0.82, 0.18, 1],
    emissiveFactor: [0.45, 0.32, 0.05],
    metallicFactor: 0.55,
    roughnessFactor: 0.25,
  });

  // Torpedo projectile body oriented along -Z forward
  const body = addMeshToNode(
    doc,
    root,
    'SeekerBody',
    buildLatheMesh(
      [
        { x: 0.12, y: -0.55 },
        { x: 0.32, y: -0.25 },
        { x: 0.36, y: 0.15 },
        { x: 0.02, y: 0.65 },
      ],
      14,
    ),
    crimsonMat,
  );
  body.setRotation(quatAxis(1, 0, 0, -Math.PI * 0.5));

  // Swept stabilizer fins
  const finGeom = buildExtrudedProfile(
    [
      { x: -0.35, y: 0 },
      { x: 0.35, y: 0 },
      { x: 0.12, y: 0.38 },
      { x: -0.18, y: 0.38 },
    ],
    0.08,
    0.015,
  );
  for (let i = 0; i < 3; i += 1) {
    const fin = addMeshToNode(doc, root, `SeekerFin_${i}`, finGeom, goldMat);
    fin.setTranslation([0, 0, 0.2]);
    fin.setRotation(quatAxis(0, 0, 1, (i * Math.PI * 2) / 3));
  }

  return writeGlb(doc, outPath);
}

export async function buildOndaDeVentoGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('OndaDeVentoRoot');
  doc.createScene('Scene').addChild(root);

  const tealMat = createPbrMaterial(doc, {
    name: 'WindTealMat',
    baseColorFactor: [0.18, 0.88, 0.78, 1],
    emissiveFactor: [0.12, 0.62, 0.55],
    roughnessFactor: 0.22,
  });

  for (let r = 0; r < 3; r += 1) {
    const radius = 0.24 + r * 0.14;
    const pts = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return { x: Math.cos(a) * radius, y: (r - 1) * 0.16, z: Math.sin(a) * radius };
    });
    addMeshToNode(doc, root, `WindRing_${r}`, buildTubeAlongPath(pts, 0.05, 8, true), tealMat);
  }

  return writeGlb(doc, outPath);
}

export async function buildCristalDeSaltoGlb(outPath: string): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('CristalDeSaltoRoot');
  doc.createScene('Scene').addChild(root);

  const amethystMat = createPbrMaterial(doc, {
    name: 'JumpCrystalMat',
    baseColorFactor: [0.68, 0.34, 0.98, 1],
    emissiveFactor: [0.42, 0.16, 0.82],
    metallicFactor: 0.25,
    roughnessFactor: 0.15,
  });

  addMeshToNode(
    doc,
    root,
    'JumpCrystalSpire',
    buildLatheMesh(
      [
        { x: 0.02, y: -0.52 },
        { x: 0.28, y: -0.14 },
        { x: 0.26, y: 0.22 },
        { x: 0.02, y: 0.58 },
      ],
      6,
    ),
    amethystMat,
  );

  return writeGlb(doc, outPath);
}
