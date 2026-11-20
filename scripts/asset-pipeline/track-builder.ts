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

export async function buildPortoDasLanternasGlb(
  layout: TrackLayoutDef,
  outPath: string,
): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('TrackRoot');
  doc.createScene('Scene').addChild(root);

  // Textures
  const asphalt = createAsphaltTextures(512);
  const curbPng = createCurbTexture(256, [232, 62, 50], [248, 246, 240]);
  const startLinePng = createCheckeredStartTexture(512);
  const chevronPng = createChevronSignTexture(256);
  const boostPadPng = createBoostPadTexture(256);
  const dirtPng = createDirtTrackTexture(256);
  const sandPng = createSandTexture(256);
  const grassPng = createGrassTurfTexture(256);
  const cobblePng = createCobbleTexture(256);
  const terracottaPng = createTerracottaTexture(256);
  const waterPng = createWaterTexture(256);

  // Materials
  const roadMat = createPbrMaterial(doc, {
    name: 'PortoRoadAsphalt',
    baseColorTexturePng: asphalt.albedo,
    roughnessTexturePng: asphalt.roughness,
    roughnessFactor: 0.88,
    metallicFactor: 0.05,
  });

  const curbMat = createPbrMaterial(doc, {
    name: 'PortoCurb',
    baseColorTexturePng: curbPng,
    roughnessFactor: 0.7,
  });

  const stoneWallMat = createPbrMaterial(doc, {
    name: 'CoastalStoneWall',
    baseColorTexturePng: cobblePng,
    baseColorFactor: [0.88, 0.84, 0.78, 1],
    roughnessFactor: 0.82,
  });

  const startLineMat = createPbrMaterial(doc, {
    name: 'StartCheckeredMat',
    baseColorTexturePng: startLinePng,
    roughnessFactor: 0.6,
  });

  const dirtMat = createPbrMaterial(doc, {
    name: 'HarborDirtMat',
    baseColorTexturePng: dirtPng,
    roughnessFactor: 0.92,
  });

  const sandMat = createPbrMaterial(doc, {
    name: 'CoastalSandMat',
    baseColorTexturePng: sandPng,
    roughnessFactor: 0.9,
  });

  const grassMat = createPbrMaterial(doc, {
    name: 'CoastalGrassMat',
    baseColorTexturePng: grassPng,
    roughnessFactor: 0.94,
  });

  const waterMat = createPbrMaterial(doc, {
    name: 'BayWaterMat',
    baseColorTexturePng: waterPng,
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
    emissiveFactor: [1.0, 0.65, 0.18],
    roughnessFactor: 0.2,
  });

  const boostDeckMat = createPbrMaterial(doc, {
    name: 'TrackBoostDeck',
    baseColorTexturePng: boostPadPng,
    emissiveFactor: [0.15, 0.58, 0.92],
    roughnessFactor: 0.22,
  });

  const rampMat = createPbrMaterial(doc, {
    name: 'BoardwalkRampMat',
    baseColorFactor: [0.94, 0.62, 0.16, 1],
    emissiveFactor: [0.18, 0.08, 0.0],
    roughnessFactor: 0.55,
  });

  const chevronMat = createPbrMaterial(doc, {
    name: 'ChevronBoardMat',
    baseColorTexturePng: chevronPng,
    emissiveFactor: [0.15, 0.04, 0.04],
    roughnessFactor: 0.35,
  });

  const leafMat = createPbrMaterial(doc, {
    name: 'CoastalFoliage',
    baseColorFactor: [0.18, 0.58, 0.26, 1],
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
    name: 'CoastalCliffRock',
    baseColorFactor: [0.46, 0.42, 0.39, 1],
    roughnessFactor: 0.92,
  });

  // 1. Main road ribbon, curbs & outer coastal stone walls
  const mainPoints = layout.samples.map((s) => s.point);
  const { road, leftCurb, rightCurb } = buildRoadRibbon(mainPoints, layout.halfWidth, 1.15, true);
  addMeshToNode(doc, root, 'MainRoadMesh', road, roadMat);
  addMeshToNode(doc, root, 'LeftCurbMesh', leftCurb, curbMat);
  addMeshToNode(doc, root, 'RightCurbMesh', rightCurb, curbMat);

  const leftWallGeom = buildWallRibbon(layout.samples, -layout.wallMargin, 1.35, 0.9);
  const rightWallGeom = buildWallRibbon(layout.samples, layout.wallMargin, 1.35, 0.9);
  addMeshToNode(doc, root, 'LeftStoneWall', leftWallGeom, stoneWallMat);
  addMeshToNode(doc, root, 'RightStoneWall', rightWallGeom, stoneWallMat);

  // Start/finish checkered line strip (UVs mapped cleanly across road width & depth)
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

  // 2. Dirt Harbor Shortcut Ribbon
  for (const shortcut of layout.shortcuts) {
    const scPts = shortcut.samples.map((s) => s.point);
    const { road: scRoad } = buildRoadRibbon(scPts, shortcut.halfWidth, 0.45, false);
    addMeshToNode(doc, root, `Shortcut_${shortcut.id}`, scRoad, dirtMat);
  }

  // 3. Coastal Bay Water & Land Terraces (top surfaces kept cleanly below road Y = 0!)
  const waterPlane = addMeshToNode(
    doc,
    root,
    'BayWaterPlane',
    buildUvBox(640, 0.2, 640, 24, 24),
    waterMat,
  );
  waterPlane.setTranslation([-40, -1.85, -10]);

  // Sculpted island landmasses & sandy cove sitting neatly beneath road/curb decks
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

  // 4. Bridge support columns under bridgeRange
  if (layout.bridgeRange) {
    const bridgeSamples = layout.samples.filter(
      (s) => s.s >= layout.bridgeRange!.sStart && s.s <= layout.bridgeRange!.sEnd,
    );
    const pierGeom = buildLatheMesh(
      [
        { x: 1.5, y: 0 },
        { x: 1.2, y: 8.5 },
      ],
      10,
    );
    const pierMesh = doc.createMesh('BridgePierMesh');
    const tmpHolder = doc.createNode('tmp');
    addMeshToNode(doc, tmpHolder, 'tmpPier', pierGeom, stoneWallMat);
    const createdMesh = tmpHolder.listChildren()[0].getMesh()!;
    pierMesh.addPrimitive(createdMesh.listPrimitives()[0]);
    tmpHolder.dispose();

    for (let i = 0; i < bridgeSamples.length; i += 5) {
      const s = bridgeSamples[i];
      for (const side of [-1, 1] as const) {
        const pier = doc.createNode(`BridgePier_${i}_${side}`).setMesh(createdMesh);
        pier.setTranslation([
          s.point.x + s.right.x * side * (layout.halfWidth + 0.5),
          -2.2,
          s.point.z + s.right.z * side * (layout.halfWidth + 0.5),
        ]);
        root.addChild(pier);
      }
    }
  }

  // 5. Coastal Rock Tunnel
  if (layout.tunnelRange) {
    const tunnel = buildTunnelArch(
      layout.samples,
      layout.tunnelRange.sStart,
      layout.tunnelRange.sEnd,
      layout.halfWidth + 3.0,
    );
    const tunnelMat = createPbrMaterial(doc, {
      name: 'CoastalTunnelRock',
      baseColorFactor: [0.34, 0.31, 0.36, 1],
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
    }
  });

  return writeGlb(doc, outPath);
}
