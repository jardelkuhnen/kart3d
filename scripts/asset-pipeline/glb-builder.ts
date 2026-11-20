import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Accessor,
  Animation,
  Document,
  Material,
  Node,
  NodeIO,
  Primitive,
  Skin,
} from '@gltf-transform/core';

export interface GeometryData {
  positions: Float32Array<ArrayBuffer>;
  normals: Float32Array<ArrayBuffer>;
  uvs: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MaterialOptions {
  name: string;
  baseColorFactor?: [number, number, number, number];
  metallicFactor?: number;
  roughnessFactor?: number;
  emissiveFactor?: [number, number, number];
  doubleSided?: boolean;
  baseColorTexturePng?: Buffer;
  roughnessTexturePng?: Buffer;
}

export interface KeyframeTrackSpec {
  targetNode: Node;
  path: 'translation' | 'rotation' | 'scale';
  times: Float32Array<ArrayBuffer>;
  values: Float32Array<ArrayBuffer>;
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-8) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function computeNormals(
  positions: Float32Array<ArrayBuffer>,
  indices: Uint32Array<ArrayBuffer>,
): Float32Array<ArrayBuffer> {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const ax = positions[i1] - positions[i0];
    const ay = positions[i1 + 1] - positions[i0 + 1];
    const az = positions[i1 + 2] - positions[i0 + 2];

    const bx = positions[i2] - positions[i0];
    const by = positions[i2 + 1] - positions[i0 + 1];
    const bz = positions[i2 + 2] - positions[i0 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i0] += nx;
    normals[i0 + 1] += ny;
    normals[i0 + 2] += nz;

    normals[i1] += nx;
    normals[i1 + 1] += ny;
    normals[i1 + 2] += nz;

    normals[i2] += nx;
    normals[i2 + 1] += ny;
    normals[i2 + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len > 1e-8) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    } else {
      normals[i] = 0;
      normals[i + 1] = 1;
      normals[i + 2] = 0;
    }
  }

  return normals;
}

/**
 * Chamfered / beveled box builder (never raw un-beveled cubes).
 * Uses subdivided beveled rings along Y so every edge catches specular highlights.
 */
export function buildBoxBeveled(
  width: number,
  height: number,
  depth: number,
  bevel = 0.04,
): GeometryData {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hd = depth * 0.5;
  const b = Math.min(bevel, hw * 0.35, hh * 0.35, hd * 0.35);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rings: Array<{ y: number; sx: number; sz: number; v: number }> = [
    { y: -hh, sx: hw - b, sz: hd - b, v: 0 },
    { y: -hh + b, sx: hw, sz: hd, v: 0.15 },
    { y: hh - b, sx: hw, sz: hd, v: 0.85 },
    { y: hh, sx: hw - b, sz: hd - b, v: 1 },
  ];

  // Octagonal cross-section with chamfered corners
  const makeProfile = (sx: number, sz: number): Array<[number, number]> => [
    [-sx + b, sz],
    [sx - b, sz],
    [sx, sz - b],
    [sx, -sz + b],
    [sx - b, -sz],
    [-sx + b, -sz],
    [-sx, -sz + b],
    [-sx, sz - b],
  ];

  const ringCount = rings.length;
  const segCount = 8;

  for (let r = 0; r < ringCount; r += 1) {
    const ring = rings[r];
    const pts = makeProfile(ring.sx, ring.sz);
    for (let s = 0; s <= segCount; s += 1) {
      const [px, pz] = pts[s % segCount];
      positions.push(px, ring.y, pz);
      uvs.push(s / segCount, ring.v);
    }
  }

  const stride = segCount + 1;
  for (let r = 0; r < ringCount - 1; r += 1) {
    for (let s = 0; s < segCount; s += 1) {
      const a = r * stride + s;
      const bIdx = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      indices.push(a, bIdx, d, a, d, c);
    }
  }

  // Top cap
  const topCenterIdx = positions.length / 3;
  positions.push(0, hh, 0);
  uvs.push(0.5, 0.5);
  const topPts = makeProfile(hw - b, hd - b);
  const topRingStart = positions.length / 3;
  for (let s = 0; s < segCount; s += 1) {
    positions.push(topPts[s][0], hh, topPts[s][1]);
    uvs.push(topPts[s][0] / Math.max(width, 0.01) + 0.5, topPts[s][1] / Math.max(depth, 0.01) + 0.5);
  }
  for (let s = 0; s < segCount; s += 1) {
    indices.push(topCenterIdx, topRingStart + s, topRingStart + ((s + 1) % segCount));
  }

  // Bottom cap
  const botCenterIdx = positions.length / 3;
  positions.push(0, -hh, 0);
  uvs.push(0.5, 0.5);
  const botRingStart = positions.length / 3;
  for (let s = 0; s < segCount; s += 1) {
    positions.push(topPts[s][0], -hh, topPts[s][1]);
    uvs.push(topPts[s][0] / Math.max(width, 0.01) + 0.5, topPts[s][1] / Math.max(depth, 0.01) + 0.5);
  }
  for (let s = 0; s < segCount; s += 1) {
    indices.push(botCenterIdx, botRingStart + ((s + 1) % segCount), botRingStart + s);
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

/**
 * Revolved lathe mesh around Y axis. Profile points are (radius, y) from bottom to top.
 */
export function buildLatheMesh(
  profile: readonly Vec2[],
  radialSegments = 20,
  capBottom = true,
  capTop = true,
): GeometryData {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rows = profile.length;
  for (let r = 0; r < rows; r += 1) {
    const p = profile[r];
    const v = r / Math.max(1, rows - 1);
    for (let s = 0; s <= radialSegments; s += 1) {
      const u = s / radialSegments;
      const angle = u * Math.PI * 2;
      const x = Math.cos(angle) * p.x;
      const z = Math.sin(angle) * p.x;
      positions.push(x, p.y, z);
      uvs.push(u, v);
    }
  }

  const stride = radialSegments + 1;
  for (let r = 0; r < rows - 1; r += 1) {
    for (let s = 0; s < radialSegments; s += 1) {
      const a = r * stride + s;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, c, a, c, b);
    }
  }

  if (capBottom && profile[0].x > 1e-4) {
    const center = positions.length / 3;
    positions.push(0, profile[0].y, 0);
    uvs.push(0.5, 0);
    for (let s = 0; s < radialSegments; s += 1) {
      indices.push(center, s, s + 1);
    }
  }

  if (capTop && profile[rows - 1].x > 1e-4) {
    const center = positions.length / 3;
    positions.push(0, profile[rows - 1].y, 0);
    uvs.push(0.5, 1);
    const start = (rows - 1) * stride;
    for (let s = 0; s < radialSegments; s += 1) {
      indices.push(center, start + s + 1, start + s);
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

/**
 * Extrudes a closed 2D CCW polygon in XY along Z from -depth/2 to +depth/2 with beveled edges.
 */
export function buildExtrudedProfile(
  polygon: readonly Vec2[],
  depth: number,
  bevelSize = 0.03,
): GeometryData {
  const n = polygon.length;
  if (n < 3) {
    throw new Error('buildExtrudedProfile requer ao menos 3 vértices.');
  }

  let cx = 0;
  let cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

  const hd = depth * 0.5;
  const b = Math.min(bevelSize, hd * 0.4);
  const inset = 0.94;

  const shrink = (p: Vec2, factor: number): Vec2 => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
  });

  const slices: Array<{ z: number; scale: number; v: number }> = [
    { z: -hd, scale: inset, v: 0 },
    { z: -hd + b, scale: 1, v: 0.15 },
    { z: hd - b, scale: 1, v: 0.85 },
    { z: hd, scale: inset, v: 1 },
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const slice of slices) {
    for (let i = 0; i <= n; i += 1) {
      const pt = shrink(polygon[i % n], slice.scale);
      positions.push(pt.x, pt.y, slice.z);
      uvs.push(i / n, slice.v);
    }
  }

  const stride = n + 1;
  for (let s = 0; s < slices.length - 1; s += 1) {
    for (let i = 0; i < n; i += 1) {
      const a = s * stride + i;
      const bIdx = a + 1;
      const c = (s + 1) * stride + i;
      const d = c + 1;
      indices.push(a, c, d, a, d, bIdx);
    }
  }

  // Front cap (+hd)
  const frontCenter = positions.length / 3;
  positions.push(cx, cy, hd);
  uvs.push(0.5, 0.5);
  const frontStart = positions.length / 3;
  for (let i = 0; i < n; i += 1) {
    const pt = shrink(polygon[i], inset);
    positions.push(pt.x, pt.y, hd);
    uvs.push(0.5 + (pt.x - cx) * 0.5, 0.5 + (pt.y - cy) * 0.5);
  }
  for (let i = 0; i < n; i += 1) {
    indices.push(frontCenter, frontStart + i, frontStart + ((i + 1) % n));
  }

  // Back cap (-hd)
  const backCenter = positions.length / 3;
  positions.push(cx, cy, -hd);
  uvs.push(0.5, 0.5);
  const backStart = positions.length / 3;
  for (let i = 0; i < n; i += 1) {
    const pt = shrink(polygon[i], inset);
    positions.push(pt.x, pt.y, -hd);
    uvs.push(0.5 + (pt.x - cx) * 0.5, 0.5 + (pt.y - cy) * 0.5);
  }
  for (let i = 0; i < n; i += 1) {
    indices.push(backCenter, backStart + ((i + 1) % n), backStart + i);
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

/**
 * Parallel-transport tubular sweep along a 3D polyline. Ideal for roll cages, exhausts, branches, scarves.
 */
export function buildTubeAlongPath(
  points: readonly Vec3[],
  radius: number,
  radialSegments = 10,
  closed = false,
): GeometryData {
  if (points.length < 2) {
    throw new Error('buildTubeAlongPath requer ao menos 2 pontos.');
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const count = points.length;
  const tangents: Vec3[] = [];
  for (let i = 0; i < count; i += 1) {
    const prev = points[i === 0 ? (closed ? count - 1 : 0) : i - 1];
    const next = points[i === count - 1 ? (closed ? 0 : count - 1) : i + 1];
    tangents.push(normalize3(sub3(next, prev)));
  }

  let normal: Vec3 =
    Math.abs(tangents[0].y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  normal = normalize3(cross3(tangents[0], normal));

  const ringCount = closed ? count + 1 : count;
  for (let i = 0; i < ringCount; i += 1) {
    const idx = i % count;
    const t = tangents[idx];
    if (i > 0) {
      const proj = dot3(normal, t);
      normal = normalize3(sub3(normal, scale3(t, proj)));
    }
    const binormal = normalize3(cross3(t, normal));
    const center = points[idx];
    const v = i / Math.max(1, ringCount - 1);

    for (let s = 0; s <= radialSegments; s += 1) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2;
      const radialDir = add3(
        scale3(normal, Math.cos(theta)),
        scale3(binormal, Math.sin(theta)),
      );
      const pos = add3(center, scale3(radialDir, radius));
      positions.push(pos.x, pos.y, pos.z);
      uvs.push(u, v);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < ringCount - 1; i += 1) {
    for (let s = 0; s < radialSegments; s += 1) {
      const a = i * stride + s;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, c, a, c, b);
    }
  }

  if (!closed) {
    // End caps
    const startCenter = positions.length / 3;
    positions.push(points[0].x, points[0].y, points[0].z);
    uvs.push(0.5, 0);
    for (let s = 0; s < radialSegments; s += 1) {
      indices.push(startCenter, s + 1, s);
    }

    const endCenter = positions.length / 3;
    const last = points[count - 1];
    positions.push(last.x, last.y, last.z);
    uvs.push(0.5, 1);
    const endRing = (ringCount - 1) * stride;
    for (let s = 0; s < radialSegments; s += 1) {
      indices.push(endCenter, endRing + s, endRing + s + 1);
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

/**
 * Banked UV-mapped road ribbon + raised curbs along a 3D centerline spline.
 */
export function buildRoadRibbon(
  centerPoints: readonly Vec3[],
  halfWidth: number,
  curbWidth = 1.1,
  closed = true,
): { road: GeometryData; leftCurb: GeometryData; rightCurb: GeometryData } {
  const n = centerPoints.length;
  if (n < 3) {
    throw new Error('buildRoadRibbon requer ao menos 3 pontos.');
  }

  const roadPos: number[] = [];
  const roadUv: number[] = [];
  const roadIdx: number[] = [];

  const leftPos: number[] = [];
  const leftUv: number[] = [];
  const leftIdx: number[] = [];

  const rightPos: number[] = [];
  const rightUv: number[] = [];
  const rightIdx: number[] = [];

  let accumDist = 0;
  const ringCount = closed ? n + 1 : n;

  for (let i = 0; i < ringCount; i += 1) {
    const currIdx = i % n;
    const prev = centerPoints[(currIdx - 1 + n) % n];
    const curr = centerPoints[currIdx];
    const next = centerPoints[(currIdx + 1) % n];

    if (i > 0) {
      accumDist += Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z);
    }

    const forward = normalize3(sub3(next, prev));
    const right = normalize3(cross3(forward, { x: 0, y: 1, z: 0 }));
    const vCoord = accumDist / (halfWidth * 2);

    // Road left and right vertices
    const rL = add3(curr, scale3(right, -halfWidth));
    const rR = add3(curr, scale3(right, halfWidth));
    roadPos.push(rL.x, rL.y, rL.z, rR.x, rR.y, rR.z);
    roadUv.push(0, vCoord, 1, vCoord);

    // Raised left curb (outer -> inner)
    const cLO = add3(curr, scale3(right, -(halfWidth + curbWidth)));
    const cLI = add3(curr, scale3(right, -halfWidth));
    leftPos.push(cLO.x, cLO.y + 0.16, cLO.z, cLI.x, cLI.y + 0.04, cLI.z);
    leftUv.push(0, vCoord * 1.5, 1, vCoord * 1.5);

    // Raised right curb (inner -> outer)
    const cRI = add3(curr, scale3(right, halfWidth));
    const cRO = add3(curr, scale3(right, halfWidth + curbWidth));
    rightPos.push(cRI.x, cRI.y + 0.04, cRI.z, cRO.x, cRO.y + 0.16, cRO.z);
    rightUv.push(0, vCoord * 1.5, 1, vCoord * 1.5);
  }

  for (let i = 0; i < ringCount - 1; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    roadIdx.push(a, c, b, b, c, d);
    leftIdx.push(a, c, b, b, c, d);
    rightIdx.push(a, c, b, b, c, d);
  }

  const finalize = (pos: number[], uv: number[], idx: number[]): GeometryData => {
    const pArr = new Float32Array(pos);
    const iArr = new Uint32Array(idx);
    return {
      positions: pArr,
      normals: computeNormals(pArr, iArr),
      uvs: new Float32Array(uv),
      indices: iArr,
    };
  };

  return {
    road: finalize(roadPos, roadUv, roadIdx),
    leftCurb: finalize(leftPos, leftUv, leftIdx),
    rightCurb: finalize(rightPos, rightUv, rightIdx),
  };
}

export function embedPngTexture(doc: Document, name: string, pngBuffer: Buffer) {
  return doc.createTexture(name).setMimeType('image/png').setImage(new Uint8Array(pngBuffer));
}

export function createPbrMaterial(doc: Document, opts: MaterialOptions): Material {
  const mat = doc
    .createMaterial(opts.name)
    .setBaseColorFactor(opts.baseColorFactor ?? [1, 1, 1, 1])
    .setMetallicFactor(opts.metallicFactor ?? 0.08)
    .setRoughnessFactor(opts.roughnessFactor ?? 0.65)
    .setDoubleSided(opts.doubleSided ?? false);

  if (opts.emissiveFactor) {
    mat.setEmissiveFactor(opts.emissiveFactor);
  }
  if (opts.baseColorTexturePng) {
    mat.setBaseColorTexture(
      embedPngTexture(doc, `${opts.name}_albedo`, opts.baseColorTexturePng),
    );
  }
  if (opts.roughnessTexturePng) {
    mat.setMetallicRoughnessTexture(
      embedPngTexture(doc, `${opts.name}_roughness`, opts.roughnessTexturePng),
    );
  }

  return mat;
}

export function addMeshToNode(
  doc: Document,
  parentNode: Node,
  name: string,
  geom: GeometryData,
  material: Material,
): Node {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer('main');

  const posAcc = doc
    .createAccessor(`${name}_pos`)
    .setType(Accessor.Type.VEC3)
    .setArray(geom.positions)
    .setBuffer(buffer);

  const normAcc = doc
    .createAccessor(`${name}_norm`)
    .setType(Accessor.Type.VEC3)
    .setArray(geom.normals)
    .setBuffer(buffer);

  const uvAcc = doc
    .createAccessor(`${name}_uv`)
    .setType(Accessor.Type.VEC2)
    .setArray(geom.uvs)
    .setBuffer(buffer);

  const idxAcc = doc
    .createAccessor(`${name}_idx`)
    .setType(Accessor.Type.SCALAR)
    .setArray(geom.indices)
    .setBuffer(buffer);

  const prim = doc
    .createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', posAcc)
    .setAttribute('NORMAL', normAcc)
    .setAttribute('TEXCOORD_0', uvAcc)
    .setIndices(idxAcc)
    .setMaterial(material);

  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh);
  parentNode.addChild(node);
  return node;
}

export function createSkinnedRig(
  doc: Document,
  rootNode: Node,
  jointSpecs: ReadonlyArray<{
    name: string;
    parentIndex: number;
    translation: [number, number, number];
  }>,
): { skin: Skin; joints: Node[] } {
  const joints: Node[] = [];
  for (let i = 0; i < jointSpecs.length; i += 1) {
    const spec = jointSpecs[i];
    const joint = doc.createNode(spec.name).setTranslation(spec.translation);
    joints.push(joint);
    if (spec.parentIndex < 0) {
      rootNode.addChild(joint);
    } else {
      joints[spec.parentIndex].addChild(joint);
    }
  }

  const skin = doc.createSkin('RigSkin');
  for (const joint of joints) {
    skin.addJoint(joint);
  }
  return { skin, joints };
}

export function addAnimationClip(
  doc: Document,
  clipName: string,
  tracks: readonly KeyframeTrackSpec[],
): Animation {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer('main');
  const anim = doc.createAnimation(clipName);

  for (let i = 0; i < tracks.length; i += 1) {
    const spec = tracks[i];
    const input = doc
      .createAccessor(`${clipName}_t_${i}`)
      .setType(Accessor.Type.SCALAR)
      .setArray(spec.times)
      .setBuffer(buffer);

    const outputType =
      spec.path === 'rotation' ? Accessor.Type.VEC4 : Accessor.Type.VEC3;
    const output = doc
      .createAccessor(`${clipName}_v_${i}`)
      .setType(outputType)
      .setArray(spec.values)
      .setBuffer(buffer);

    const sampler = doc
      .createAnimationSampler()
      .setInput(input)
      .setOutput(output)
      .setInterpolation(spec.interpolation ?? 'LINEAR');

    const channel = doc
      .createAnimationChannel()
      .setTargetNode(spec.targetNode)
      .setTargetPath(spec.path)
      .setSampler(sampler);

    anim.addSampler(sampler).addChannel(channel);
  }

  return anim;
}

export async function writeGlb(doc: Document, outPath: string): Promise<number> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const io = new NodeIO();
  const binary = await io.writeBinary(doc);
  await fs.writeFile(outPath, binary);
  return binary.byteLength;
}
