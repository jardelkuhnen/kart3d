import { Document, Mesh, Node } from '@gltf-transform/core';
import type { TrackLayoutDef, TrackSplineSample, TrackVec3 } from '../../src/game/tracks/trackGeometry';
import {
  addMeshToNode,
  buildBoxBeveled,
  buildExtrudedProfile,
  buildLatheMesh,
  buildRoadRibbon,
  buildTubeAlongPath,
  computeNormals,
  createPbrMaterial,
  writeGlb,
  type GeometryData,
} from './glb-builder';
import {
  createAsphaltTextures,
  createBoostPadTexture,
  createCheckeredStartTexture,
  createChevronSignTexture,
  createCobbleTexture,
  createCurbTexture,
  createDirtTrackTexture,
  createGrassTurfTexture,
  createIceTexture,
  createSandTexture,
  createTerracottaTexture,
  createWaterTexture,
} from './texture-builder';

function quatY(yaw: number): [number, number, number, number] {
  const half = yaw * 0.5;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

function quatX(pitch: number): [number, number, number, number] {
  const half = pitch * 0.5;
  return [Math.sin(half), 0, 0, Math.cos(half)];
}

function quatZ(roll: number): [number, number, number, number] {
  const half = roll * 0.5;
  return [0, 0, Math.sin(half), Math.cos(half)];
}

function quatFromDirYaw(x: number, z: number): number {
  return Math.atan2(x, z);
}

function buildUvBox(
  width: number,
  height: number,
  depth: number,
  uvRepeatX: number,
  uvRepeatZ: number,
): GeometryData {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hd = depth * 0.5;

  // 24 vertices (4 per face) so top face has exact planar UVs (0..uvRepeatX, 0..uvRepeatZ)
  const positions = new Float32Array([
    // +Y top
    -hw, hh, hd, hw, hh, hd, hw, hh, -hd, -hw, hh, -hd,
    // -Y bottom
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    // +Z front
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
    // -Z back
    hw, -hh, -hd, -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd,
    // +X right
    hw, -hh, hd, hw, -hh, -hd, hw, hh, -hd, hw, hh, hd,
    // -X left
    -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
  ]);

  const uvs = new Float32Array([
    0, 0, uvRepeatX, 0, uvRepeatX, uvRepeatZ, 0, uvRepeatZ,
    0, 0, uvRepeatX, 0, uvRepeatX, uvRepeatZ, 0, uvRepeatZ,
    0, 0, uvRepeatX, 0, uvRepeatX, 1, 0, 1,
    0, 0, uvRepeatX, 0, uvRepeatX, 1, 0, 1,
    0, 0, uvRepeatZ, 0, uvRepeatZ, 1, 0, 1,
    0, 0, uvRepeatZ, 0, uvRepeatZ, 1, 0, 1,
  ]);

  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  return {
    positions,
    normals: computeNormals(positions, indices),
    uvs,
    indices,
  };
}

function buildWallRibbon(
  samples: readonly TrackSplineSample[],
  offsetFromCenter: number,
  wallHeight: number,
  wallThickness: number,
): GeometryData {
  const n = samples.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const innerOffset = offsetFromCenter - (offsetFromCenter > 0 ? wallThickness * 0.5 : -wallThickness * 0.5);
  const outerOffset = offsetFromCenter + (offsetFromCenter > 0 ? wallThickness * 0.5 : -wallThickness * 0.5);

  const ringCount = n + 1;
  for (let i = 0; i < ringCount; i += 1) {
    const sample = samples[i % n];
    const v = i * 0.5;
    const pIB = {
      x: sample.point.x + sample.right.x * innerOffset,
      y: sample.point.y - 0.1,
      z: sample.point.z + sample.right.z * innerOffset,
    };
    const pIT = { ...pIB, y: sample.point.y + wallHeight };
    const pOT = {
      x: sample.point.x + sample.right.x * outerOffset,
      y: sample.point.y + wallHeight,
      z: sample.point.z + sample.right.z * outerOffset,
    };
    const pOB = { ...pOT, y: sample.point.y - 0.1 };

    positions.push(
      pIB.x, pIB.y, pIB.z,
      pIT.x, pIT.y, pIT.z,
      pOT.x, pOT.y, pOT.z,
      pOB.x, pOB.y, pOB.z,
    );
    uvs.push(0, v, 0.35, v, 0.65, v, 1, v);
  }

  for (let i = 0; i < ringCount - 1; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // Inner face, top face, outer face
    for (let f = 0; f < 3; f += 1) {
      const i0 = a + f;
      const i1 = a + f + 1;
      const i2 = b + f;
      const i3 = b + f + 1;
      if (offsetFromCenter > 0) {
        indices.push(i0, i2, i1, i1, i2, i3);
      } else {
        indices.push(i0, i1, i2, i1, i3, i2);
      }
    }
  }

  const posArr = new Float32Array(positions);
  const idxArr = new Uint32Array(indices);
  return {
    positions: posArr,
    normals: computeNormals(posArr, idxArr),
    uvs: new Float32Array(uvs),
    indices: idxArr,
  };
}

function buildTunnelArch(
  samples: readonly TrackSplineSample[],
  sStart: number,
  sEnd: number,
  archRadius: number,
): { shell: GeometryData; lightStrip: GeometryData } {
  const segmentSamples = samples.filter((s) => s.s >= sStart && s.s <= sEnd);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  const lightPts: TrackVec3[] = [];
  const arcSegs = 8;

  for (let i = 0; i < segmentSamples.length; i += 1) {
    const s = segmentSamples[i];
    const v = i / Math.max(1, segmentSamples.length - 1);
    lightPts.push({
      x: s.point.x,
      y: s.point.y + archRadius - 0.35,
      z: s.point.z,
    });

    for (let a = 0; a <= arcSegs; a += 1) {
      const theta = (a / arcSegs) * Math.PI;
      const lateral = -Math.cos(theta) * archRadius;
      const height = Math.sin(theta) * archRadius;
      pos.push(
        s.point.x + s.right.x * lateral,
        s.point.y + height,
        s.point.z + s.right.z * lateral,
      );
      uv.push(a / arcSegs, v * 4);
    }
  }

  const stride = arcSegs + 1;
  for (let i = 0; i < segmentSamples.length - 1; i += 1) {
    for (let a = 0; a < arcSegs; a += 1) {
      const p0 = i * stride + a;
      const p1 = p0 + 1;
      const p2 = (i + 1) * stride + a;
      const p3 = p2 + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }

  const posArr = new Float32Array(pos);
  const idxArr = new Uint32Array(idx);
  return {
    shell: {
      positions: posArr,
      normals: computeNormals(posArr, idxArr),
      uvs: new Float32Array(uv),
      indices: idxArr,
    },
    lightStrip: buildTubeAlongPath(
      lightPts.length >= 2
        ? lightPts
        : [
            { x: 0, y: 5, z: 0 },
            { x: 0, y: 5, z: 1 },
          ],
      0.24,
      6,
      false,
    ),
  };
}

function buildRampMesh(width: number, length: number, height: number): GeometryData {
  // Side profile in XY, extruded across width along X after rotation
  const profile = [
    { x: -length * 0.5, y: 0 },
    { x: length * 0.5, y: 0 },
    { x: length * 0.5, y: height },
    { x: -length * 0.5, y: 0.06 },
  ];
  // Extrusion in XY -> Z; rotate +90deg around Y maps +X -> -Z (uphill forward!)
  return buildExtrudedProfile(profile, width, 0.04);
}

/**
 * Instantiates a prototype sub-hierarchy as lightweight Nodes sharing the same GLTF Meshes.
 */
function instantiatePrototype(
  doc: Document,
  parent: Node,
  protoName: string,
  parts: ReadonlyArray<{
    mesh: Mesh;
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }>,
  placement: { x: number; y: number; z: number; yaw: number; scale: number },
): Node {
  const instance = doc.createNode(protoName);
  instance.setTranslation([placement.x, placement.y, placement.z]);
  instance.setRotation(quatY(placement.yaw));
  instance.setScale([placement.scale, placement.scale, placement.scale]);
  parent.addChild(instance);

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const child = doc.createNode(`${protoName}_p${i}`).setMesh(part.mesh);
    if (part.translation) child.setTranslation(part.translation);
    if (part.rotation) child.setRotation(part.rotation);
    if (part.scale) child.setScale(part.scale);
    instance.addChild(child);
  }
  return instance;
}

export type TrackBiome =
  | 'porto'
  | 'bosque'
  | 'vale'
  | 'canion'
  | 'neon'
  | 'boreal'
  | 'celeste'
  | 'fortaleza';

interface BiomePalette {
  curbA: [number, number, number];
  curbB: [number, number, number];
  wallColor: [number, number, number, number];
  rampColor: [number, number, number, number];
  tunnelColor: [number, number, number, number];
  tunnelLight: [number, number, number];
  foliageColor: [number, number, number, number];
  baseSurface: 'grass' | 'sand' | 'snow' | 'asphalt' | 'cloud';
  waterColor: [number, number, number, number];
  hasWaterPlane: boolean;
}

const BIOME_PALETTES: Record<TrackBiome, BiomePalette> = {
  porto: {
    curbA: [232, 62, 50],
    curbB: [248, 246, 240],
    wallColor: [0.88, 0.84, 0.78, 1],
    rampColor: [0.94, 0.62, 0.16, 1],
    tunnelColor: [0.34, 0.31, 0.36, 1],
    tunnelLight: [1.0, 0.65, 0.18],
    foliageColor: [0.18, 0.58, 0.26, 1],
    baseSurface: 'grass',
    waterColor: [0.22, 0.68, 0.88, 1],
    hasWaterPlane: true,
  },
  bosque: {
    curbA: [45, 212, 191],
    curbB: [236, 253, 245],
    wallColor: [0.32, 0.45, 0.38, 1],
    rampColor: [0.12, 0.72, 0.54, 1],
    tunnelColor: [0.16, 0.24, 0.36, 1],
    tunnelLight: [0.25, 0.92, 0.96],
    foliageColor: [0.09, 0.48, 0.32, 1],
    baseSurface: 'grass',
    waterColor: [0.18, 0.82, 0.78, 1],
    hasWaterPlane: true,
  },
  vale: {
    curbA: [234, 179, 8],
    curbB: [254, 249, 195],
    wallColor: [0.68, 0.62, 0.54, 1],
    rampColor: [0.85, 0.52, 0.16, 1],
    tunnelColor: [0.42, 0.38, 0.34, 1],
    tunnelLight: [1.0, 0.85, 0.42],
    foliageColor: [0.16, 0.56, 0.24, 1],
    baseSurface: 'grass',
    waterColor: [0.24, 0.7, 0.92, 1],
    hasWaterPlane: true,
  },
  canion: {
    curbA: [234, 88, 12],
    curbB: [254, 243, 199],
    wallColor: [0.76, 0.38, 0.22, 1],
    rampColor: [0.95, 0.56, 0.14, 1],
    tunnelColor: [0.58, 0.26, 0.16, 1],
    tunnelLight: [1.0, 0.58, 0.12],
    foliageColor: [0.24, 0.54, 0.24, 1],
    baseSurface: 'sand',
    waterColor: [0.86, 0.62, 0.32, 1],
    hasWaterPlane: false,
  },
  neon: {
    curbA: [56, 189, 248],
    curbB: [236, 72, 153],
    wallColor: [0.14, 0.16, 0.32, 1],
    rampColor: [0.22, 0.82, 0.98, 1],
    tunnelColor: [0.08, 0.1, 0.24, 1],
    tunnelLight: [0.2, 0.88, 1.0],
    foliageColor: [0.15, 0.45, 0.78, 1],
    baseSurface: 'asphalt',
    waterColor: [0.1, 0.14, 0.32, 1],
    hasWaterPlane: false,
  },
  boreal: {
    curbA: [94, 234, 212],
    curbB: [224, 242, 254],
    wallColor: [0.68, 0.86, 0.96, 1],
    rampColor: [0.35, 0.9, 0.95, 1],
    tunnelColor: [0.36, 0.62, 0.84, 1],
    tunnelLight: [0.35, 0.96, 0.88],
    foliageColor: [0.22, 0.52, 0.56, 1],
    baseSurface: 'snow',
    waterColor: [0.26, 0.72, 0.88, 1],
    hasWaterPlane: true,
  },
  celeste: {
    curbA: [244, 114, 182],
    curbB: [254, 249, 195],
    wallColor: [0.94, 0.9, 0.98, 1],
    rampColor: [0.98, 0.76, 0.22, 1],
    tunnelColor: [0.78, 0.72, 0.92, 1],
    tunnelLight: [0.98, 0.86, 0.48],
    foliageColor: [0.18, 0.68, 0.48, 1],
    baseSurface: 'cloud',
    waterColor: [0.85, 0.92, 1.0, 1],
    hasWaterPlane: false,
  },
  fortaleza: {
    curbA: [167, 139, 250],
    curbB: [229, 231, 235],
    wallColor: [0.28, 0.26, 0.34, 1],
    rampColor: [0.68, 0.42, 0.96, 1],
    tunnelColor: [0.18, 0.16, 0.24, 1],
    tunnelLight: [0.68, 0.55, 1.0],
    foliageColor: [0.22, 0.28, 0.32, 1],
    baseSurface: 'asphalt',
    waterColor: [0.18, 0.22, 0.38, 1],
    hasWaterPlane: true,
  },
};

export async function buildPortoDasLanternasGlb(
  layout: TrackLayoutDef,
  outPath: string,
): Promise<number> {
  return buildTrackGlb(layout, 'porto', outPath);
}

export async function buildTrackGlb(
  layout: TrackLayoutDef,
  biome: TrackBiome,
  outPath: string,
): Promise<number> {
  const palette = BIOME_PALETTES[biome];
  const doc = new Document();
  const root = doc.createNode('TrackRoot');
  doc.createScene('Scene').addChild(root);

  // Textures
  const asphalt = createAsphaltTextures(512);
  const curbPng = createCurbTexture(256, palette.curbA, palette.curbB);
  const startLinePng = createCheckeredStartTexture(512);
  const chevronPng = createChevronSignTexture(256);
  const boostPadPng = createBoostPadTexture(256);
  const dirtPng = createDirtTrackTexture(256);
  const sandPng = createSandTexture(256);
  const grassPng = createGrassTurfTexture(256);
  const cobblePng = createCobbleTexture(256);
  const terracottaPng = createTerracottaTexture(256);
  const waterPng = createWaterTexture(256);
  const icePng = createIceTexture(256);

  // Materials
  const roadMat = createPbrMaterial(doc, {
    name: `${biome}_RoadAsphalt`,
    baseColorTexturePng: asphalt.albedo,
    roughnessTexturePng: asphalt.roughness,
    roughnessFactor: biome === 'neon' ? 0.28 : 0.88,
    metallicFactor: biome === 'neon' ? 0.18 : 0.05,
  });

  const iceMat = createPbrMaterial(doc, {
    name: `${biome}_IceMat`,
    baseColorTexturePng: icePng,
    roughnessFactor: 0.14,
    metallicFactor: 0.08,
  });

  const snowGroundMat = createPbrMaterial(doc, {
    name: `${biome}_SnowMat`,
    baseColorFactor: [0.86, 0.93, 0.98, 1],
    roughnessFactor: 0.85,
  });

  const cloudSeaMat = createPbrMaterial(doc, {
    name: `${biome}_CloudSeaMat`,
    baseColorFactor: [0.95, 0.97, 1.0, 1],
    emissiveFactor: [0.14, 0.16, 0.22],
    roughnessFactor: 0.95,
  });

  const curbMat = createPbrMaterial(doc, {
    name: `${biome}_Curb`,
    baseColorTexturePng: curbPng,
    roughnessFactor: 0.7,
  });

  const stoneWallMat = createPbrMaterial(doc, {
    name: `${biome}_StoneWall`,
    baseColorTexturePng: cobblePng,
    baseColorFactor: palette.wallColor,
    roughnessFactor: 0.82,
  });

  const startLineMat = createPbrMaterial(doc, {
    name: 'StartCheckeredMat',
    baseColorTexturePng: startLinePng,
    roughnessFactor: 0.6,
  });

  const dirtMat = createPbrMaterial(doc, {
    name: `${biome}_DirtMat`,
    baseColorTexturePng: dirtPng,
    roughnessFactor: 0.92,
  });

  const sandMat = createPbrMaterial(doc, {
    name: `${biome}_SandMat`,
    baseColorTexturePng: sandPng,
    roughnessFactor: 0.9,
  });

  const grassMat = createPbrMaterial(doc, {
    name: `${biome}_GrassMat`,
    baseColorTexturePng: grassPng,
    roughnessFactor: 0.94,
  });

  const waterMat = createPbrMaterial(doc, {
    name: `${biome}_WaterMat`,
    baseColorTexturePng: waterPng,
    baseColorFactor: palette.waterColor,
    roughnessFactor: 0.18,
    metallicFactor: 0.15,
  });

  const terracottaMat = createPbrMaterial(doc, {
    name: 'TerracottaRoof',
    baseColorTexturePng: terracottaPng,
    roughnessFactor: 0.75,
  });

  const stuccoMaterials = [
    createPbrMaterial(doc, {
      name: 'StuccoCream',
      baseColorFactor: [0.96, 0.9, 0.78, 1],
      roughnessFactor: 0.85,
    }),
    createPbrMaterial(doc, {
      name: 'StuccoCoral',
      baseColorFactor: [0.95, 0.64, 0.48, 1],
      roughnessFactor: 0.82,
    }),
    createPbrMaterial(doc, {
      name: 'StuccoSeafoam',
      baseColorFactor: [0.68, 0.86, 0.84, 1],
      roughnessFactor: 0.82,
    }),
  ];

  const woodMat = createPbrMaterial(doc, {
    name: 'HarborTimber',
    baseColorFactor: [0.54, 0.34, 0.18, 1],
    roughnessFactor: 0.78,
  });

  const ironMat = createPbrMaterial(doc, {
    name: 'WroughtIron',
    baseColorFactor: [0.16, 0.19, 0.25, 1],
    metallicFactor: 0.65,
    roughnessFactor: 0.42,
  });

  const lanternGlowMat = createPbrMaterial(doc, {
    name: 'LanternWarmGlow',
    baseColorFactor: [1, 0.82, 0.35, 1],
    emissiveFactor: palette.tunnelLight,
    roughnessFactor: 0.2,
  });

  const boostDeckMat = createPbrMaterial(doc, {
    name: 'TrackBoostDeck',
    baseColorTexturePng: boostPadPng,
    emissiveFactor: [0.15, 0.58, 0.92],
    roughnessFactor: 0.22,
  });

  const rampMat = createPbrMaterial(doc, {
    name: `${biome}_RampMat`,
    baseColorFactor: palette.rampColor,
    emissiveFactor: [0.16, 0.08, 0.0],
    roughnessFactor: 0.55,
  });

  const chevronMat = createPbrMaterial(doc, {
    name: 'ChevronBoardMat',
    baseColorTexturePng: chevronPng,
    emissiveFactor: [0.15, 0.04, 0.04],
    roughnessFactor: 0.35,
  });

  const leafMat = createPbrMaterial(doc, {
    name: `${biome}_Foliage`,
    baseColorFactor: palette.foliageColor,
    roughnessFactor: 0.82,
  });

  const sailMat = createPbrMaterial(doc, {
    name: 'SailCloth',
    baseColorFactor: [0.98, 0.95, 0.88, 1],
    roughnessFactor: 0.7,
    doubleSided: true,
  });

  const lighthouseRedMat = createPbrMaterial(doc, {
    name: 'LighthouseRed',
    baseColorFactor: [0.88, 0.22, 0.2, 1],
    roughnessFactor: 0.5,
  });

  const rockMat = createPbrMaterial(doc, {
    name: `${biome}_Rock`,
    baseColorFactor: biome === 'canion' ? [0.74, 0.34, 0.2, 1] : [0.46, 0.42, 0.39, 1],
    roughnessFactor: 0.92,
  });

  // 1. Main road ribbon, curbs & outer walls
  const mainPoints = layout.samples.map((s) => s.point);
  const { road, leftCurb, rightCurb } = buildRoadRibbon(mainPoints, layout.halfWidth, 1.15, true);
  addMeshToNode(doc, root, 'MainRoadMesh', road, roadMat);
  addMeshToNode(doc, root, 'LeftCurbMesh', leftCurb, curbMat);
  addMeshToNode(doc, root, 'RightCurbMesh', rightCurb, curbMat);

  const leftWallGeom = buildWallRibbon(layout.samples, -layout.wallMargin, 1.35, 0.9);
  const rightWallGeom = buildWallRibbon(layout.samples, layout.wallMargin, 1.35, 0.9);
  addMeshToNode(doc, root, 'LeftStoneWall', leftWallGeom, stoneWallMat);
  addMeshToNode(doc, root, 'RightStoneWall', rightWallGeom, stoneWallMat);

  // Visual surface overlay patches on road stretches (e.g. Forest Dirt Trail / Canyon Sand Wash / Boreal Ice)
  for (const zone of layout.surfaceZones) {
    if (zone.lateralMin > -layout.halfWidth && zone.lateralMax < layout.halfWidth) continue;
    const zonePts = layout.samples
      .filter((s) => {
        const ds = Math.abs(s.s - zone.centerS);
        return Math.min(ds, layout.totalLength - ds) <= zone.length * 0.5;
      })
      .map((s) => ({ x: s.point.x, y: s.point.y + 0.02, z: s.point.z }));
    if (zonePts.length >= 4) {
      const { road: patchGeom } = buildRoadRibbon(zonePts, layout.halfWidth - 0.15, 0.1, false);
      const patchMat =
        zone.surface === 'ice' ? iceMat : zone.surface === 'sand' ? sandMat : dirtMat;
      addMeshToNode(doc, root, `SurfacePatch_${zone.id}`, patchGeom, patchMat);
    }
  }

  // Start/finish checkered line strip
  const cp0 = layout.checkpoints[0];
  const startStrip = addMeshToNode(
    doc,
    root,
    'StartLineStrip',
    buildUvBox(layout.halfWidth * 1.96, 0.04, 3.6, 1, 1),
    startLineMat,
  );
  startStrip.setTranslation([cp0.position.x, cp0.position.y + 0.025, cp0.position.z]);
  startStrip.setRotation(quatY(cp0.yaw));

  // 2. Shortcut Ribbons
  for (const shortcut of layout.shortcuts) {
    const scPts = shortcut.samples.map((s) => s.point);
    const { road: scRoad } = buildRoadRibbon(scPts, shortcut.halfWidth, 0.45, false);
    const scMat =
      shortcut.surface === 'ice'
        ? iceMat
        : shortcut.surface === 'sand'
          ? sandMat
          : shortcut.surface === 'grass'
            ? grassMat
            : shortcut.surface === 'asphalt'
              ? roadMat
              : dirtMat;
    addMeshToNode(doc, root, `Shortcut_${shortcut.id}`, scRoad, scMat);
  }

  // 3. Biome Terrain Floor & Water Plane (safely beneath minimum road height)
  const minRoadY = layout.samples.reduce((min, s) => Math.min(min, s.point.y), Infinity);
  const floorTopY = biome === 'celeste' ? minRoadY - 6.5 : minRoadY - 0.8;

  if (palette.hasWaterPlane) {
    const waterPlane = addMeshToNode(
      doc,
      root,
      'BayWaterPlane',
      buildUvBox(680, 0.2, 680, 26, 26),
      waterMat,
    );
    waterPlane.setTranslation([0, floorTopY - 0.9, 0]);
  }

  if (biome === 'porto') {
    const landSpecs: Array<{
      name: string;
      pos: [number, number, number];
      size: [number, number, number];
      uv: [number, number];
      mat: typeof grassMat;
    }> = [
      { name: 'LandStartSouth', pos: [15, -1.45, 45], size: [120, 2.0, 155], uv: [14, 18], mat: grassMat },
      { name: 'LandHarborWest', pos: [-145, -1.45, 55], size: [145, 2.0, 175], uv: [16, 20], mat: grassMat },
      { name: 'LandNorthRidge', pos: [-95, -1.45, -145], size: [195, 2.0, 95], uv: [22, 12], mat: grassMat },
      { name: 'LandEastHeadland', pos: [95, -1.45, 95], size: [110, 2.0, 130], uv: [14, 16], mat: grassMat },
      { name: 'SandCoveBeach', pos: [-168, -1.25, 5], size: [58, 2.0, 105], uv: [8, 14], mat: sandMat },
    ];
    for (const land of landSpecs) {
      const node = addMeshToNode(
        doc,
        root,
        land.name,
        buildUvBox(land.size[0], land.size[1], land.size[2], land.uv[0], land.uv[1]),
        land.mat,
      );
      node.setTranslation(land.pos);
    }
  } else {
    const baseMat =
      palette.baseSurface === 'sand'
        ? sandMat
        : palette.baseSurface === 'snow'
          ? snowGroundMat
          : palette.baseSurface === 'asphalt'
            ? ironMat
            : palette.baseSurface === 'cloud'
              ? cloudSeaMat
              : grassMat;
    const basin = addMeshToNode(
      doc,
      root,
      'BiomeGroundBasin',
      buildUvBox(640, 1.4, 640, 28, 28),
      baseMat,
    );
    basin.setTranslation([0, floorTopY - 0.7, 0]);

    if (biome === 'bosque' || biome === 'vale' || biome === 'boreal') {
      const bridgeMid = layout.bridgeRange
        ? layout.samples.find(
            (s) => s.s >= (layout.bridgeRange!.sStart + layout.bridgeRange!.sEnd) * 0.5,
          )
        : null;
      if (bridgeMid) {
        const riverStrip = addMeshToNode(
          doc,
          root,
          'RiverChannelPlane',
          buildUvBox(46, 0.25, 260, 4, 18),
          waterMat,
        );
        riverStrip.setTranslation([bridgeMid.point.x, floorTopY + 0.12, bridgeMid.point.z]);
        riverStrip.setRotation(quatY(quatFromDirYaw(bridgeMid.right.x, bridgeMid.right.z)));
      }
    }
  }

  // 4. Bridge support columns under bridgeRange
  if (layout.bridgeRange) {
    const bridgeSamples = layout.samples.filter(
      (s) => s.s >= layout.bridgeRange!.sStart && s.s <= layout.bridgeRange!.sEnd,
    );
    const pierGeom = buildLatheMesh(
      [
        { x: 1.5, y: 0 },
        { x: 1.2, y: 14.5 },
      ],
      10,
    );
    const tmpHolder = doc.createNode('tmp');
    addMeshToNode(doc, tmpHolder, 'tmpPier', pierGeom, stoneWallMat);
    const createdMesh = tmpHolder.listChildren()[0].getMesh()!;
    tmpHolder.dispose();

    for (let i = 0; i < bridgeSamples.length; i += 5) {
      const s = bridgeSamples[i];
      for (const side of [-1, 1] as const) {
        const pier = doc.createNode(`BridgePier_${i}_${side}`).setMesh(createdMesh);
        pier.setTranslation([
          s.point.x + s.right.x * side * (layout.halfWidth + 0.5),
          s.point.y - 14.4,
          s.point.z + s.right.z * side * (layout.halfWidth + 0.5),
        ]);
        root.addChild(pier);
      }
    }
  }

  // 5. Tunnel Shell & Light Strip
  if (layout.tunnelRange) {
    const tunnel = buildTunnelArch(
      layout.samples,
      layout.tunnelRange.sStart,
      layout.tunnelRange.sEnd,
      layout.halfWidth + 3.0,
    );
    const tunnelMat = createPbrMaterial(doc, {
      name: `${biome}_TunnelRock`,
      baseColorFactor: palette.tunnelColor,
      roughnessFactor: 0.9,
      doubleSided: true,
    });
    addMeshToNode(doc, root, 'CoastalTunnelShell', tunnel.shell, tunnelMat);
    addMeshToNode(doc, root, 'CoastalTunnelLightStrip', tunnel.lightStrip, lanternGlowMat);
  }

  // 6. Start Gantry at Checkpoint 0
  const gantryGroup = doc.createNode('TrackStartGantry');
  gantryGroup.setTranslation([cp0.position.x, cp0.position.y, cp0.position.z]);
  gantryGroup.setRotation(quatY(cp0.yaw));
  root.addChild(gantryGroup);

  for (const side of [-1, 1] as const) {
    const pCol = addMeshToNode(
      doc,
      gantryGroup,
      `GantryPillar_${side}`,
      buildLatheMesh(
        [
          { x: 0.65, y: 0 },
          { x: 0.45, y: 0.8 },
          { x: 0.42, y: 6.4 },
        ],
        12,
      ),
      ironMat,
    );
    pCol.setTranslation([side * (layout.halfWidth + 1.1), 0, 0]);
  }
  const gantryBanner = addMeshToNode(
    doc,
    gantryGroup,
    'GantryBanner',
    buildUvBox(layout.halfWidth * 2 + 1.6, 1.45, 0.45, 2, 1),
    startLineMat,
  );
  gantryBanner.setTranslation([0, 5.9, 0]);

  // 7. Boost Pads & Jump Ramps
  for (const pad of layout.boostPads) {
    const padNode = addMeshToNode(
      doc,
      root,
      `BoostPad_${pad.id}`,
      buildBoxBeveled(pad.width, 0.08, pad.length, 0.02),
      boostDeckMat,
    );
    padNode.setTranslation([pad.position.x, pad.position.y + 0.04, pad.position.z]);
    padNode.setRotation(quatY(pad.yaw));
  }

  for (const ramp of layout.ramps) {
    const rampHolder = doc.createNode(`Ramp_${ramp.id}`);
    rampHolder.setTranslation([ramp.position.x, ramp.position.y, ramp.position.z]);
    rampHolder.setRotation(quatY(ramp.yaw));
    root.addChild(rampHolder);

    const rampMeshNode = addMeshToNode(
      doc,
      rampHolder,
      `RampSlope_${ramp.id}`,
      buildRampMesh(ramp.width, ramp.length, ramp.height),
      rampMat,
    );
    rampMeshNode.setRotation(quatY(Math.PI * 0.5));
  }

  // 8. Scenery Prototypes (Instanced mesh sharing!)
  const sceneryGroup = doc.createNode('SceneryGroup');
  root.addChild(sceneryGroup);

  const makeMesh = (name: string, geom: GeometryData, mat: ReturnType<typeof createPbrMaterial>): Mesh => {
    const tmp = doc.createNode(`proto_${name}`);
    addMeshToNode(doc, tmp, name, geom, mat);
    const mesh = tmp.listChildren()[0].getMesh()!;
    tmp.dispose();
    return mesh;
  };

  // Lantern Post prototype
  const lanternParts = [
    {
      mesh: makeMesh(
        'LanternPole',
        buildTubeAlongPath(
          [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 3.4, z: 0 },
            { x: 0, y: 4.1, z: -0.65 },
          ],
          0.11,
          8,
          false,
        ),
        ironMat,
      ),
    },
    {
      mesh: makeMesh(
        'LanternBody',
        buildLatheMesh(
          [
            { x: 0.14, y: 0 },
            { x: 0.28, y: 0.22 },
            { x: 0.28, y: 0.48 },
            { x: 0.12, y: 0.65 },
          ],
          8,
        ),
        lanternGlowMat,
      ),
      translation: [0, 3.35, -0.65] as [number, number, number],
    },
  ];

  // Chevron Sign prototype
  const chevronParts = [
    {
      mesh: makeMesh(
        'ChevronPostL',
        buildTubeAlongPath(
          [
            { x: -1.1, y: 0, z: 0 },
            { x: -1.1, y: 2.3, z: 0 },
          ],
          0.08,
          8,
          false,
        ),
        ironMat,
      ),
    },
    {
      mesh: makeMesh(
        'ChevronPostR',
        buildTubeAlongPath(
          [
            { x: 1.1, y: 0, z: 0 },
            { x: 1.1, y: 2.3, z: 0 },
          ],
          0.08,
          8,
          false,
        ),
        ironMat,
      ),
    },
    {
      mesh: makeMesh('ChevronFace', buildBoxBeveled(3.4, 1.25, 0.16, 0.03), chevronMat),
      translation: [0, 1.85, 0] as [number, number, number],
    },
  ];

  // House prototypes (3 color variants)
  const roofPrism = buildExtrudedProfile(
    [
      { x: -4.2, y: 0 },
      { x: 4.2, y: 0 },
      { x: 0, y: 2.4 },
    ],
    6.8,
    0.08,
  );
  const roofMesh = makeMesh('HouseRoof', roofPrism, terracottaMat);
  const windowMesh = makeMesh('HouseWindow', buildBoxBeveled(1.1, 1.1, 0.15, 0.03), lanternGlowMat);
  const houseBodyVariants = stuccoMaterials.map((stuccoMat, idx) =>
    makeMesh(`HouseBody_${idx}`, buildBoxBeveled(7.6, 5.4, 6.2, 0.12), stuccoMat),
  );

  // Market Stall prototype
  const marketParts = [
    { mesh: makeMesh('MarketBase', buildBoxBeveled(3.8, 1.2, 2.0, 0.06), woodMat), translation: [0, 0.6, 0] as [number, number, number] },
    { mesh: makeMesh('MarketAwning', buildBoxBeveled(4.2, 0.25, 2.5, 0.05), lighthouseRedMat), translation: [0, 2.8, 0] as [number, number, number], rotation: quatX(0.22) },
    { mesh: makeMesh('MarketPostL', buildBoxBeveled(0.15, 2.9, 0.15, 0.02), woodMat), translation: [-1.75, 1.45, -0.8] as [number, number, number] },
    { mesh: makeMesh('MarketPostR', buildBoxBeveled(0.15, 2.9, 0.15, 0.02), woodMat), translation: [1.75, 1.45, -0.8] as [number, number, number] },
  ];

  // Harbor Sailboat prototype
  const boatHullGeom = buildExtrudedProfile(
    [
      { x: -3.2, y: 0.4 },
      { x: -1.8, y: -0.5 },
      { x: 1.8, y: -0.5 },
      { x: 3.6, y: 0.65 },
      { x: 2.2, y: 0.85 },
      { x: -2.8, y: 0.85 },
    ],
    2.4,
    0.1,
  );
  const boatParts = [
    { mesh: makeMesh('BoatHull', boatHullGeom, woodMat), rotation: quatY(Math.PI * 0.5) },
    {
      mesh: makeMesh(
        'BoatMast',
        buildTubeAlongPath(
          [
            { x: 0, y: 0.7, z: 0 },
            { x: 0, y: 6.4, z: 0 },
          ],
          0.11,
          8,
          false,
        ),
        woodMat,
      ),
    },
    {
      mesh: makeMesh(
        'BoatSail',
        buildExtrudedProfile(
          [
            { x: 0, y: 1.6 },
            { x: 2.6, y: 1.8 },
            { x: 0.1, y: 6.1 },
          ],
          0.08,
          0.01,
        ),
        sailMat,
      ),
      rotation: quatY(Math.PI * 0.5),
    },
  ];

  // Palm Tree prototype (curved trunk + layered frond arch clusters)
  const palmParts = [
    {
      mesh: makeMesh(
        'PalmTrunk',
        buildTubeAlongPath(
          [
            { x: 0, y: 0, z: 0 },
            { x: 0.35, y: 2.4, z: 0.1 },
            { x: 0.8, y: 4.8, z: -0.1 },
            { x: 1.0, y: 6.4, z: -0.2 },
          ],
          0.26,
          8,
          false,
        ),
        woodMat,
      ),
    },
    ...Array.from({ length: 5 }, (_, f) => {
      const a = (f / 5) * Math.PI * 2;
      return {
        mesh: makeMesh(
          `PalmFrond_${f}`,
          buildBoxBeveled(0.7, 0.14, 2.8, 0.04),
          leafMat,
        ),
        translation: [1.0 + Math.sin(a) * 1.15, 6.2, -0.2 + Math.cos(a) * 1.15] as [number, number, number],
        rotation: quatY(a),
      };
    }),
  ];

  // Cypress Tree prototype (multi-tiered sculpted foliage clusters)
  const cypressParts = [
    {
      mesh: makeMesh(
        'CypressTrunk',
        buildLatheMesh(
          [
            { x: 0.32, y: 0 },
            { x: 0.22, y: 2.2 },
          ],
          8,
        ),
        woodMat,
      ),
    },
    {
      mesh: makeMesh(
        'CypressFoliage',
        buildLatheMesh(
          [
            { x: 0.2, y: 1.8 },
            { x: 1.45, y: 2.8 },
            { x: 1.15, y: 4.1 },
            { x: 1.32, y: 5.2 },
            { x: 0.72, y: 6.8 },
            { x: 0.05, y: 8.2 },
          ],
          12,
        ),
        leafMat,
      ),
    },
  ];

  // Rock Pillar prototype
  const rockParts = [
    {
      mesh: makeMesh(
        'CoastalRock',
        buildLatheMesh(
          [
            { x: 3.6, y: 0 },
            { x: 3.2, y: 2.2 },
            { x: 2.4, y: 4.8 },
            { x: 1.3, y: 6.6 },
            { x: 0.4, y: 7.4 },
          ],
          7,
        ),
        rockMat,
      ),
    },
  ];

  // Hero Coastal Lighthouse prototype
  const lighthouseParts = [
    {
      mesh: makeMesh(
        'LighthouseBase',
        buildLatheMesh(
          [
            { x: 4.6, y: 0 },
            { x: 4.2, y: 3.5 },
          ],
          14,
        ),
        stoneWallMat,
      ),
    },
    {
      mesh: makeMesh(
        'LighthouseLower',
        buildLatheMesh(
          [
            { x: 3.8, y: 3.5 },
            { x: 3.2, y: 10.5 },
          ],
          14,
        ),
        stuccoMaterials[0],
      ),
    },
    {
      mesh: makeMesh(
        'LighthouseBand',
        buildLatheMesh(
          [
            { x: 3.2, y: 10.5 },
            { x: 2.7, y: 16.5 },
          ],
          14,
        ),
        lighthouseRedMat,
      ),
    },
    {
      mesh: makeMesh(
        'LighthouseUpper',
        buildLatheMesh(
          [
            { x: 2.7, y: 16.5 },
            { x: 2.4, y: 21.0 },
          ],
          14,
        ),
        stuccoMaterials[0],
      ),
    },
    {
      mesh: makeMesh(
        'LighthouseBeacon',
        buildLatheMesh(
          [
            { x: 1.9, y: 21.0 },
            { x: 2.1, y: 23.6 },
            { x: 0.1, y: 25.5 },
          ],
          14,
        ),
        lanternGlowMat,
      ),
    },
  ];

  // Additional Copa Aurora biome prototypes (Bosque de Cristal, Vale dos Moinhos, Cânion Solar)
  const crystalMatCyan = createPbrMaterial(doc, {
    name: 'CrystalGlowCyan',
    baseColorFactor: [0.35, 0.92, 0.98, 1],
    emissiveFactor: [0.22, 0.72, 0.88],
    roughnessFactor: 0.2,
    metallicFactor: 0.25,
  });
  const crystalMatMagenta = createPbrMaterial(doc, {
    name: 'CrystalGlowMagenta',
    baseColorFactor: [0.85, 0.42, 0.96, 1],
    emissiveFactor: [0.6, 0.22, 0.78],
    roughnessFactor: 0.22,
    metallicFactor: 0.25,
  });
  const giantTreeParts = [
    {
      mesh: makeMesh(
        'GiantTreeTrunk',
        buildLatheMesh(
          [
            { x: 1.85, y: 0 },
            { x: 1.25, y: 3.0 },
            { x: 1.05, y: 9.0 },
            { x: 1.35, y: 11.2 },
          ],
          10,
        ),
        woodMat,
      ),
    },
    {
      mesh: makeMesh(
        'GiantTreeCanopy',
        buildLatheMesh(
          [
            { x: 0.6, y: 9.2 },
            { x: 4.8, y: 11.4 },
            { x: 4.1, y: 14.0 },
            { x: 2.2, y: 16.5 },
            { x: 0.2, y: 17.6 },
          ],
          10,
        ),
        leafMat,
      ),
    },
  ];

  const crystalSpireMesh = [
    makeMesh(
      'CrystalSpireCyan',
      buildLatheMesh(
        [
          { x: 0.85, y: 0 },
          { x: 0.72, y: 2.4 },
          { x: 0.05, y: 4.6 },
        ],
        6,
      ),
      crystalMatCyan,
    ),
    makeMesh(
      'CrystalSpireMagenta',
      buildLatheMesh(
        [
          { x: 0.78, y: 0 },
          { x: 0.65, y: 2.1 },
          { x: 0.05, y: 4.1 },
        ],
        6,
      ),
      crystalMatMagenta,
    ),
  ];

  const waterfallParts = [
    { mesh: makeMesh('CliffMass', buildBoxBeveled(18, 22, 10, 0.3), rockMat), translation: [0, 10.5, 0] as [number, number, number] },
    { mesh: makeMesh('WaterfallCurtain', buildUvBox(8.5, 20.5, 0.8, 2, 5), waterMat), translation: [0, 10.2, 5.1] as [number, number, number] },
  ];

  const mushroomCapMaterials = [crystalMatCyan, crystalMatMagenta, lanternGlowMat];
  const mushroomStemMesh = makeMesh(
    'MushroomStem',
    buildLatheMesh(
      [
        { x: 0.28, y: 0 },
        { x: 0.16, y: 1.2 },
        { x: 0.2, y: 2.4 },
      ],
      8,
    ),
    stuccoMaterials[0],
  );
  const mushroomCapMeshes = mushroomCapMaterials.map((capMat, i) =>
    makeMesh(
      `MushroomCap_${i}`,
      buildLatheMesh(
        [
          { x: 0.92, y: 0 },
          { x: 0.85, y: 0.38 },
          { x: 0.1, y: 0.72 },
        ],
        10,
      ),
      capMat,
    ),
  );

  // Windmill tower parts + reusable blade mesh for animated WindmillBlades_<n>
  const windmillTowerMesh = makeMesh(
    'WindmillTower',
    buildLatheMesh(
      [
        { x: 2.8, y: 0 },
        { x: 2.2, y: 4.5 },
        { x: 1.75, y: 9.2 },
      ],
      10,
    ),
    stuccoMaterials[0],
  );
  const windmillCapMesh = makeMesh(
    'WindmillRoofCap',
    buildLatheMesh(
      [
        { x: 2.0, y: 9.0 },
        { x: 0.05, y: 11.4 },
      ],
      10,
    ),
    terracottaMat,
  );
  const windmillSailMesh = makeMesh('WindmillSailArm', buildBoxBeveled(0.95, 4.6, 0.16, 0.03), sailMat);
  let windmillCounter = 0;

  // Rural barn & hay bale & alpine pine
  const barnParts = [
    { mesh: makeMesh('BarnBody', buildBoxBeveled(8.6, 5.2, 7.2, 0.12), lighthouseRedMat), translation: [0, 2.6, 0] as [number, number, number] },
    { mesh: makeMesh('BarnRoof', roofPrism, woodMat), translation: [0, 5.2, 0] as [number, number, number], scale: [1.12, 1.1, 1.12] as [number, number, number] },
    { mesh: makeMesh('BarnTrimDoor', buildBoxBeveled(2.8, 3.2, 0.2, 0.03), stuccoMaterials[0]), translation: [0, 1.6, 3.65] as [number, number, number] },
  ];
  const hayMat = createPbrMaterial(doc, {
    name: 'GoldenHay',
    baseColorFactor: [0.92, 0.75, 0.28, 1],
    roughnessFactor: 0.92,
  });
  const hayBaleParts = [
    {
      mesh: makeMesh(
        'HayCylinder',
        buildLatheMesh(
          [
            { x: 0.05, y: 0 },
            { x: 0.85, y: 0 },
            { x: 0.85, y: 1.35 },
            { x: 0.05, y: 1.35 },
          ],
          10,
        ),
        hayMat,
      ),
      rotation: quatZ(Math.PI * 0.5),
      translation: [0.68, 0.85, 0] as [number, number, number],
    },
  ];
  const pineTreeParts = [
    { mesh: makeMesh('PineTrunk', buildLatheMesh([{ x: 0.4, y: 0 }, { x: 0.25, y: 2.8 }], 8), woodMat) },
    {
      mesh: makeMesh(
        'PineNeedles',
        buildLatheMesh(
          [
            { x: 2.2, y: 2.2 },
            { x: 0.8, y: 4.5 },
            { x: 1.75, y: 4.4 },
            { x: 0.5, y: 6.8 },
            { x: 1.25, y: 6.7 },
            { x: 0.05, y: 9.2 },
          ],
          9,
        ),
        leafMat,
      ),
    },
  ];

  // Cânion Solar props: Mesa Arch, Ruin Pillar, Cactus, Sun Totem
  const mesaArchParts = [
    { mesh: makeMesh('ArchPierL', buildBoxBeveled(4.6, 13.5, 4.4, 0.25), rockMat), translation: [-12.5, 6.7, 0] as [number, number, number] },
    { mesh: makeMesh('ArchPierR', buildBoxBeveled(4.6, 13.5, 4.4, 0.25), rockMat), translation: [12.5, 6.7, 0] as [number, number, number] },
    { mesh: makeMesh('ArchSpanTop', buildBoxBeveled(30.0, 3.6, 4.6, 0.35), rockMat), translation: [0, 14.2, 0] as [number, number, number] },
  ];
  const ruinPillarParts = [
    { mesh: makeMesh('RuinBase', buildBoxBeveled(3.4, 1.4, 3.4, 0.1), terracottaMat), translation: [0, 0.7, 0] as [number, number, number] },
    { mesh: makeMesh('RuinColumn', buildBoxBeveled(2.2, 8.2, 2.2, 0.12), rockMat), translation: [0, 5.2, 0] as [number, number, number] },
    { mesh: makeMesh('RuinCap', buildBoxBeveled(3.1, 0.9, 3.1, 0.1), terracottaMat), translation: [0, 9.6, 0] as [number, number, number] },
  ];
  const cactusMat = createPbrMaterial(doc, {
    name: 'DesertSaguaro',
    baseColorFactor: [0.18, 0.56, 0.26, 1],
    roughnessFactor: 0.8,
  });
  const cactusParts = [
    {
      mesh: makeMesh(
        'CactusBody',
        buildTubeAlongPath(
          [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 3.8, z: 0 },
          ],
          0.34,
          8,
          true,
        ),
        cactusMat,
      ),
    },
    {
      mesh: makeMesh(
        'CactusArmL',
        buildTubeAlongPath(
          [
            { x: 0, y: 1.7, z: 0 },
            { x: -0.95, y: 1.9, z: 0 },
            { x: -1.0, y: 3.1, z: 0 },
          ],
          0.24,
          8,
          true,
        ),
        cactusMat,
      ),
    },
    {
      mesh: makeMesh(
        'CactusArmR',
        buildTubeAlongPath(
          [
            { x: 0, y: 2.1, z: 0 },
            { x: 0.9, y: 2.3, z: 0 },
            { x: 0.95, y: 3.4, z: 0 },
          ],
          0.22,
          8,
          true,
        ),
        cactusMat,
      ),
    },
  ];
  const sunTotemParts = [
    { mesh: makeMesh('TotemPost', buildBoxBeveled(0.95, 3.8, 0.95, 0.08), rockMat), translation: [0, 1.9, 0] as [number, number, number] },
    { mesh: makeMesh('TotemGem', buildBoxBeveled(0.75, 0.75, 0.75, 0.05), lanternGlowMat), translation: [0, 4.1, 0] as [number, number, number] },
  ];

  // Copa Eclipse Scenery Prototypes (Cidade Neon, Pico Boreal, Jardim Celeste, Fortaleza Tempestade)
  const skyscraperDarkMat = createPbrMaterial(doc, {
    name: 'SkyscraperFacade',
    baseColorFactor: [0.08, 0.1, 0.2, 1],
    metallicFactor: 0.45,
    roughnessFactor: 0.35,
  });
  const neonPinkGlowMat = createPbrMaterial(doc, {
    name: 'NeonPinkGlow',
    baseColorFactor: [0.96, 0.28, 0.65, 1],
    emissiveFactor: [0.95, 0.2, 0.6],
    roughnessFactor: 0.2,
  });
  const neonGoldGlowMat = createPbrMaterial(doc, {
    name: 'NeonGoldGlow',
    baseColorFactor: [0.98, 0.8, 0.22, 1],
    emissiveFactor: [0.95, 0.72, 0.18],
    roughnessFactor: 0.2,
  });

  const towerCoreMesh = makeMesh('SkyscraperBody', buildBoxBeveled(11.5, 36, 11.5, 0.15), skyscraperDarkMat);
  const skyscraperTrimMeshes = [crystalMatCyan, neonPinkGlowMat, neonGoldGlowMat].map((glowMat, i) =>
    makeMesh(`SkyscraperBand_${i}`, buildBoxBeveled(11.9, 1.1, 11.9, 0.05), glowMat),
  );
  const skyscraperVariants = skyscraperTrimMeshes.map((bandMesh) => [
    { mesh: towerCoreMesh, translation: [0, 18, 0] as [number, number, number] },
    { mesh: bandMesh, translation: [0, 12, 0] as [number, number, number] },
    { mesh: bandMesh, translation: [0, 24, 0] as [number, number, number] },
    { mesh: bandMesh, translation: [0, 35, 0] as [number, number, number] },
  ]);

  const neonArchBeamMeshes = [crystalMatCyan, neonPinkGlowMat].map((glowMat, i) => ({
    post: makeMesh(`NeonArchPost_${i}`, buildBoxBeveled(0.55, 7.2, 0.55, 0.05), glowMat),
    top: makeMesh(`NeonArchTop_${i}`, buildBoxBeveled(layout.halfWidth * 2 + 3.2, 0.65, 0.65, 0.05), glowMat),
  }));
  const neonArchVariants = neonArchBeamMeshes.map((m) => [
    { mesh: m.post, translation: [-(layout.halfWidth + 1.4), 3.6, 0] as [number, number, number] },
    { mesh: m.post, translation: [layout.halfWidth + 1.4, 3.6, 0] as [number, number, number] },
    { mesh: m.top, translation: [0, 7.2, 0] as [number, number, number] },
  ]);

  const billboardPostMesh = makeMesh(
    'BillboardPost',
    buildBoxBeveled(0.55, 5.4, 0.55, 0.04),
    ironMat,
  );
  const billboardPanelMeshes = [crystalMatCyan, neonPinkGlowMat, crystalMatMagenta].map((glowMat, i) =>
    makeMesh(`BillboardPanel_${i}`, buildBoxBeveled(6.4, 2.8, 0.35, 0.04), glowMat),
  );

  // Pico Boreal Props
  const glacierSpireParts = [
    {
      mesh: makeMesh(
        'GlacierMainSpire',
        buildLatheMesh(
          [
            { x: 4.8, y: 0 },
            { x: 3.2, y: 6.0 },
            { x: 1.6, y: 12.5 },
            { x: 0.2, y: 17.5 },
          ],
          6,
        ),
        iceMat,
      ),
    },
  ];
  const snowMat = createPbrMaterial(doc, {
    name: 'SnowFoliageCap',
    baseColorFactor: [0.92, 0.96, 1.0, 1],
    roughnessFactor: 0.72,
  });
  const snowPineParts = [
    { mesh: pineTreeParts[0].mesh },
    { mesh: pineTreeParts[1].mesh },
    {
      mesh: makeMesh(
        'SnowCapCone',
        buildLatheMesh(
          [
            { x: 1.25, y: 6.7 },
            { x: 0.05, y: 9.3 },
          ],
          9,
        ),
        snowMat,
      ),
    },
  ];
  const auroraPostMesh = makeMesh(
    'AuroraPostBase',
    buildLatheMesh(
      [
        { x: 0.48, y: 0 },
        { x: 0.32, y: 4.2 },
      ],
      8,
    ),
    iceMat,
  );
  const auroraCapMeshes = [crystalMatCyan, crystalMatMagenta].map((glowMat, i) =>
    makeMesh(`AuroraCrystalOrb_${i}`, buildBoxBeveled(0.75, 0.95, 0.75, 0.08), glowMat),
  );

  // Jardim Celeste Props
  const cloudIslandParts = [
    {
      mesh: makeMesh(
        'CloudBase',
        buildLatheMesh(
          [
            { x: 0.4, y: -5.5 },
            { x: 4.5, y: -2.0 },
            { x: 9.5, y: 0.0 },
            { x: 8.8, y: 1.8 },
            { x: 0.2, y: 2.2 },
          ],
          10,
        ),
        cloudSeaMat,
      ),
    },
    {
      mesh: makeMesh(
        'IslandTurfTop',
        buildLatheMesh(
          [
            { x: 8.4, y: 1.9 },
            { x: 7.5, y: 2.8 },
            { x: 0.1, y: 3.1 },
          ],
          10,
        ),
        grassMat,
      ),
    },
  ];
  const marbleMat = createPbrMaterial(doc, {
    name: 'SkyMarble',
    baseColorFactor: [0.96, 0.95, 0.98, 1],
    roughnessFactor: 0.42,
  });
  const skyGazeboParts = [
    { mesh: makeMesh('GazeboFloor', buildLatheMesh([{ x: 4.2, y: 0 }, { x: 4.2, y: 0.5 }], 8), marbleMat) },
    { mesh: makeMesh('GazeboCol1', buildLatheMesh([{ x: 0.25, y: 0.5 }, { x: 0.22, y: 4.5 }], 8), marbleMat), translation: [2.8, 0, 2.8] as [number, number, number] },
    { mesh: makeMesh('GazeboCol2', buildLatheMesh([{ x: 0.25, y: 0.5 }, { x: 0.22, y: 4.5 }], 8), marbleMat), translation: [-2.8, 0, 2.8] as [number, number, number] },
    { mesh: makeMesh('GazeboCol3', buildLatheMesh([{ x: 0.25, y: 0.5 }, { x: 0.22, y: 4.5 }], 8), marbleMat), translation: [2.8, 0, -2.8] as [number, number, number] },
    { mesh: makeMesh('GazeboCol4', buildLatheMesh([{ x: 0.25, y: 0.5 }, { x: 0.22, y: 4.5 }], 8), marbleMat), translation: [-2.8, 0, -2.8] as [number, number, number] },
    { mesh: makeMesh('GazeboDome', buildLatheMesh([{ x: 4.4, y: 4.5 }, { x: 3.2, y: 6.4 }, { x: 0.1, y: 7.4 }], 10), neonGoldGlowMat) },
  ];
  const skyRingParts = [
    { mesh: makeMesh('SkyRingLeft', buildTubeAlongPath([{ x: -9.8, y: 0, z: 0 }, { x: -7.5, y: 6.5, z: 0 }, { x: 0, y: 8.8, z: 0 }, { x: 7.5, y: 6.5, z: 0 }, { x: 9.8, y: 0, z: 0 }], 0.42, 10, false), neonGoldGlowMat) },
  ];

  // Fortaleza Tempestade Props
  const fortressStoneMat = createPbrMaterial(doc, {
    name: 'FortressSlate',
    baseColorFactor: [0.24, 0.24, 0.3, 1],
    roughnessFactor: 0.88,
  });
  const castleTowerParts = [
    {
      mesh: makeMesh(
        'CastleKeep',
        buildLatheMesh(
          [
            { x: 4.2, y: 0 },
            { x: 3.8, y: 12 },
            { x: 4.4, y: 14.5 },
            { x: 0.2, y: 19.5 },
          ],
          8,
        ),
        fortressStoneMat,
      ),
    },
    {
      mesh: makeMesh('CastleBrazier', buildBoxBeveled(1.2, 1.2, 1.2, 0.08), crystalMatMagenta),
      translation: [0, 20.2, 0] as [number, number, number],
    },
  ];
  const stormArchParts = [
    { mesh: makeMesh('StormArchL', buildBoxBeveled(2.2, 10.5, 2.6, 0.15), fortressStoneMat), translation: [-(layout.halfWidth + 1.8), 5.2, 0] as [number, number, number] },
    { mesh: makeMesh('StormArchR', buildBoxBeveled(2.2, 10.5, 2.6, 0.15), fortressStoneMat), translation: [layout.halfWidth + 1.8, 5.2, 0] as [number, number, number] },
    { mesh: makeMesh('StormArchTop', buildBoxBeveled(layout.halfWidth * 2 + 5.6, 2.4, 2.8, 0.15), fortressStoneMat), translation: [0, 10.2, 0] as [number, number, number] },
  ];
  const lightningSpireParts = [
    { mesh: makeMesh('SpireBase', buildBoxBeveled(1.0, 5.2, 1.0, 0.06), ironMat), translation: [0, 2.6, 0] as [number, number, number] },
    { mesh: makeMesh('SpireOrb', buildBoxBeveled(0.8, 0.8, 0.8, 0.08), crystalMatCyan), translation: [0, 5.6, 0] as [number, number, number] },
  ];

  layout.scenery.forEach((item, index) => {
    const p = { x: item.position.x, y: item.position.y, z: item.position.z, yaw: item.yaw, scale: item.scale };
    switch (item.kind) {
      case 'lantern-post':
        instantiatePrototype(doc, sceneryGroup, `Lantern_${index}`, lanternParts, p);
        break;
      case 'chevron-board':
        instantiatePrototype(doc, sceneryGroup, `Chevron_${index}`, chevronParts, p);
        break;
      case 'house': {
        const variant = (item.variant ?? 0) % houseBodyVariants.length;
        instantiatePrototype(
          doc,
          sceneryGroup,
          `House_${index}`,
          [
            { mesh: houseBodyVariants[variant], translation: [0, 2.7, 0] },
            { mesh: roofMesh, translation: [0, 5.4, 0] },
            { mesh: windowMesh, translation: [-1.8, 3.3, 3.12] },
            { mesh: windowMesh, translation: [1.8, 3.3, 3.12] },
          ],
          p,
        );
        break;
      }
      case 'market-stall':
        instantiatePrototype(doc, sceneryGroup, `Market_${index}`, marketParts, p);
        break;
      case 'boat':
        instantiatePrototype(doc, sceneryGroup, `Boat_${index}`, boatParts, p);
        break;
      case 'palm-tree':
        instantiatePrototype(doc, sceneryGroup, `Palm_${index}`, palmParts, p);
        break;
      case 'cypress-tree':
        instantiatePrototype(doc, sceneryGroup, `Cypress_${index}`, cypressParts, p);
        break;
      case 'rock-pillar':
        instantiatePrototype(doc, sceneryGroup, `Rock_${index}`, rockParts, p);
        break;
      case 'lighthouse':
        instantiatePrototype(doc, sceneryGroup, `Lighthouse_${index}`, lighthouseParts, p);
        break;
      case 'giant-tree':
        instantiatePrototype(doc, sceneryGroup, `GiantTree_${index}`, giantTreeParts, p);
        break;
      case 'crystal-cluster': {
        const cMesh = crystalSpireMesh[(item.variant ?? 0) % crystalSpireMesh.length];
        instantiatePrototype(
          doc,
          sceneryGroup,
          `Crystal_${index}`,
          [
            { mesh: cMesh, scale: [1.1, 1.35, 1.1] },
            { mesh: cMesh, translation: [1.0, 0, 0.5], rotation: quatZ(-0.28), scale: [0.85, 0.95, 0.85] },
            { mesh: cMesh, translation: [-0.9, 0, -0.4], rotation: quatZ(0.32), scale: [0.75, 0.85, 0.75] },
          ],
          p,
        );
        break;
      }
      case 'waterfall-cliff':
        instantiatePrototype(doc, sceneryGroup, `Waterfall_${index}`, waterfallParts, p);
        break;
      case 'mushroom-lamp': {
        const capMesh = mushroomCapMeshes[(item.variant ?? 0) % mushroomCapMeshes.length];
        instantiatePrototype(
          doc,
          sceneryGroup,
          `Mushroom_${index}`,
          [
            { mesh: mushroomStemMesh },
            { mesh: capMesh, translation: [0, 2.3, 0] },
          ],
          p,
        );
        break;
      }
      case 'windmill': {
        const wmRoot = instantiatePrototype(
          doc,
          sceneryGroup,
          `Windmill_${index}`,
          [{ mesh: windmillTowerMesh }, { mesh: windmillCapMesh }],
          p,
        );
        const bladeHub = doc.createNode(`WindmillBlades_${windmillCounter++}`);
        bladeHub.setTranslation([0, 7.6, 2.15]);
        wmRoot.addChild(bladeHub);
        for (let b = 0; b < 4; b += 1) {
          const armAngle = (b * Math.PI) / 2;
          const armNode = doc.createNode(`WindmillArm_${index}_${b}`).setMesh(windmillSailMesh);
          armNode.setRotation(quatZ(armAngle));
          armNode.setTranslation([Math.sin(-armAngle) * 2.4, Math.cos(-armAngle) * 2.4, 0]);
          bladeHub.addChild(armNode);
        }
        break;
      }
      case 'barn':
        instantiatePrototype(doc, sceneryGroup, `Barn_${index}`, barnParts, p);
        break;
      case 'hay-bale':
        instantiatePrototype(doc, sceneryGroup, `Hay_${index}`, hayBaleParts, p);
        break;
      case 'pine-tree':
        instantiatePrototype(doc, sceneryGroup, `Pine_${index}`, pineTreeParts, p);
        break;
      case 'mesa-arch':
        instantiatePrototype(doc, sceneryGroup, `MesaArch_${index}`, mesaArchParts, p);
        break;
      case 'ruin-pillar':
        instantiatePrototype(doc, sceneryGroup, `RuinPillar_${index}`, ruinPillarParts, p);
        break;
      case 'cactus':
        instantiatePrototype(doc, sceneryGroup, `Cactus_${index}`, cactusParts, p);
        break;
      case 'sun-totem':
        instantiatePrototype(doc, sceneryGroup, `SunTotem_${index}`, sunTotemParts, p);
        break;
      case 'skyscraper':
        instantiatePrototype(
          doc,
          sceneryGroup,
          `Skyscraper_${index}`,
          skyscraperVariants[(item.variant ?? 0) % skyscraperVariants.length],
          p,
        );
        break;
      case 'neon-arch':
        instantiatePrototype(
          doc,
          sceneryGroup,
          `NeonArch_${index}`,
          neonArchVariants[(item.variant ?? 0) % neonArchVariants.length],
          p,
        );
        break;
      case 'neon-billboard':
        instantiatePrototype(
          doc,
          sceneryGroup,
          `NeonBoard_${index}`,
          [
            { mesh: billboardPostMesh },
            {
              mesh: billboardPanelMeshes[(item.variant ?? 0) % billboardPanelMeshes.length],
              translation: [0, 5.2, 0],
            },
          ],
          p,
        );
        break;
      case 'glacier-spire':
        instantiatePrototype(doc, sceneryGroup, `Glacier_${index}`, glacierSpireParts, p);
        break;
      case 'snow-pine':
        instantiatePrototype(doc, sceneryGroup, `SnowPine_${index}`, snowPineParts, p);
        break;
      case 'aurora-pillar':
        instantiatePrototype(
          doc,
          sceneryGroup,
          `AuroraPillar_${index}`,
          [
            { mesh: auroraPostMesh },
            { mesh: auroraCapMeshes[(item.variant ?? 0) % auroraCapMeshes.length], translation: [0, 4.4, 0] },
          ],
          p,
        );
        break;
      case 'cloud-island':
        instantiatePrototype(doc, sceneryGroup, `CloudIsland_${index}`, cloudIslandParts, p);
        break;
      case 'sky-gazebo':
        instantiatePrototype(doc, sceneryGroup, `SkyGazebo_${index}`, skyGazeboParts, p);
        break;
      case 'sky-ring':
        instantiatePrototype(doc, sceneryGroup, `SkyRing_${index}`, skyRingParts, p);
        break;
      case 'castle-tower':
        instantiatePrototype(doc, sceneryGroup, `CastleTower_${index}`, castleTowerParts, p);
        break;
      case 'storm-arch':
        instantiatePrototype(doc, sceneryGroup, `StormArch_${index}`, stormArchParts, p);
        break;
      case 'lightning-spire':
        instantiatePrototype(doc, sceneryGroup, `LightningSpire_${index}`, lightningSpireParts, p);
        break;
    }
  });

  return writeGlb(doc, outPath);
}
