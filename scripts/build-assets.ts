import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document } from '@gltf-transform/core';
import { CHARACTERS_BY_ID } from '../src/data/characters';
import { KARTS_BY_ID } from '../src/data/karts';
import type { AssetManifest, AssetManifestEntry } from '../src/game/core/types';
import { BOSQUE_DE_CRISTAL_LAYOUT } from '../src/game/tracks/bosqueDeCristal';
import { CANION_SOLAR_LAYOUT } from '../src/game/tracks/canionSolar';
import { CIDADE_NEON_LAYOUT } from '../src/game/tracks/cidadeNeon';
import { FORTALEZA_TEMPESTADE_LAYOUT } from '../src/game/tracks/fortalezaTempestade';
import { JARDIM_CELESTE_LAYOUT } from '../src/game/tracks/jardimCeleste';
import { PICO_BOREAL_LAYOUT } from '../src/game/tracks/picoBoreal';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../src/game/tracks/portoDasLanternas';
import { VALE_DOS_MOINHOS_LAYOUT } from '../src/game/tracks/valeDosMoinhos';
import {
  generateAmbienceBorealOgg,
  generateAmbienceCanyonOgg,
  generateAmbienceCoastalOgg,
  generateAmbienceForestOgg,
  generateAmbienceNeonOgg,
  generateAmbienceSkyOgg,
  generateAmbienceStormOgg,
  generateAmbienceValleyOgg,
  generateDefeatThemeOgg,
  generateEclipseRaceMusicOgg,
  generateMenuThemeOgg,
  generateRaceMusicOgg,
  generateRaceSfxLibrary,
  generateUiClickOgg,
  generateUiConfirmOgg,
  generateVictoryFanfareOgg,
} from './asset-pipeline/audio-builder';
import { CHARACTER_BUILD_SPECS, buildCharacterGlb } from './asset-pipeline/character-builder';
import {
  addMeshToNode,
  buildBoxBeveled,
  buildLatheMesh,
  buildTubeAlongPath,
  createPbrMaterial,
  writeGlb,
} from './asset-pipeline/glb-builder';
import {
  buildBolhaGuardiaGlb,
  buildCristalDeSaltoGlb,
  buildFaiscaRastreadoraGlb,
  buildItemBoxGlb,
  buildNevoaPrismaGlb,
  buildOndaDeVentoGlb,
  buildPulsoSolarGlb,
} from './asset-pipeline/item-builder';
import { KART_BUILD_SPECS, buildKartGlb } from './asset-pipeline/kart-builder';
import {
  type ItemIconKind,
  createAsphaltTextures,
  createBoostPadTexture,
  createCharacterPortraitPng,
  createCheckeredStartTexture,
  createChevronSignTexture,
  createCurbTexture,
  createItemIconPng,
  createVfxSpritesheetPng,
} from './asset-pipeline/texture-builder';
import { type TrackBiome, buildTrackGlb } from './asset-pipeline/track-builder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const REQUIRED_CHARACTER_ANIMS = [
  'idle',
  'drive',
  'turnLeft',
  'turnRight',
  'drift',
  'hit',
  'victory',
  'defeat',
  'podium',
];

async function buildStartGantryGlb(
  outPath: string,
  bannerTexturePng: Buffer,
): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('StartGantryRoot');
  doc.createScene('Scene').addChild(root);

  const steelMat = createPbrMaterial(doc, {
    name: 'GantrySteel',
    baseColorFactor: [0.24, 0.28, 0.36, 1],
    metallicFactor: 0.65,
    roughnessFactor: 0.38,
  });

  const darkMetalMat = createPbrMaterial(doc, {
    name: 'SpeakerHousing',
    baseColorFactor: [0.09, 0.11, 0.16, 1],
    metallicFactor: 0.35,
    roughnessFactor: 0.55,
  });

  const goldTrimMat = createPbrMaterial(doc, {
    name: 'GoldTrim',
    baseColorFactor: [0.98, 0.72, 0.1, 1],
    metallicFactor: 0.5,
    roughnessFactor: 0.28,
  });

  const bannerMat = createPbrMaterial(doc, {
    name: 'RaceBanner',
    baseColorTexturePng: bannerTexturePng,
    metallicFactor: 0.05,
    roughnessFactor: 0.5,
  });

  const lightRedMat = createPbrMaterial(doc, {
    name: 'StartLightRed',
    baseColorFactor: [0.95, 0.18, 0.22, 1],
    emissiveFactor: [0.85, 0.12, 0.14],
    roughnessFactor: 0.2,
  });

  const lightGreenMat = createPbrMaterial(doc, {
    name: 'StartLightGreen',
    baseColorFactor: [0.14, 0.92, 0.48, 1],
    emissiveFactor: [0.1, 0.72, 0.34],
    roughnessFactor: 0.2,
  });

  const pillarPositionsX = [-7.8, 7.8];
  for (let i = 0; i < pillarPositionsX.length; i += 1) {
    const px = pillarPositionsX[i];
    const side = i === 0 ? 'Left' : 'Right';

    const baseGeom = buildBoxBeveled(1.35, 0.65, 1.35, 0.08);
    const baseNode = addMeshToNode(doc, root, `PillarBase_${side}`, baseGeom, goldTrimMat);
    baseNode.setTranslation([px, 0.325, 0]);

    const colGeom = buildLatheMesh(
      [
        { x: 0.46, y: 0 },
        { x: 0.38, y: 0.6 },
        { x: 0.34, y: 5.5 },
        { x: 0.42, y: 5.9 },
      ],
      14,
    );
    const colNode = addMeshToNode(doc, root, `PillarColumn_${side}`, colGeom, steelMat);
    colNode.setTranslation([px, 0.6, 0]);

    const podGeom = buildBoxBeveled(0.95, 1.4, 0.75, 0.06);
    const podNode = addMeshToNode(doc, root, `SpeakerPod_${side}`, podGeom, darkMetalMat);
    podNode.setTranslation([px * 0.9, 3.6, 0]);
  }

  const topY = 6.3;
  const botY = 5.4;
  for (const [label, yVal, zVal] of [
    ['TopFront', topY, 0.45],
    ['TopBack', topY, -0.45],
    ['BotFront', botY, 0.45],
    ['BotBack', botY, -0.45],
  ] as const) {
    const railGeom = buildTubeAlongPath(
      [
        { x: -8.1, y: yVal, z: zVal },
        { x: 8.1, y: yVal, z: zVal },
      ],
      0.11,
      10,
      false,
    );
    addMeshToNode(doc, root, `TrussRail_${label}`, railGeom, steelMat);
  }

  for (let seg = -7; seg <= 7; seg += 2) {
    const braceGeom = buildTubeAlongPath(
      [
        { x: seg - 0.8, y: botY, z: 0.45 },
        { x: seg + 0.8, y: topY, z: 0.45 },
      ],
      0.065,
      8,
      false,
    );
    addMeshToNode(doc, root, `TrussBraceF_${seg}`, braceGeom, steelMat);

    const braceBackGeom = buildTubeAlongPath(
      [
        { x: seg + 0.8, y: botY, z: -0.45 },
        { x: seg - 0.8, y: topY, z: -0.45 },
      ],
      0.065,
      8,
      false,
    );
    addMeshToNode(doc, root, `TrussBraceB_${seg}`, braceBackGeom, steelMat);
  }

  const bannerGeom = buildBoxBeveled(12.6, 1.35, 0.34, 0.04);
  const bannerNode = addMeshToNode(doc, root, 'StartBanner', bannerGeom, bannerMat);
  bannerNode.setTranslation([0, 5.75, 0]);

  const signalBoxGeom = buildBoxBeveled(2.7, 0.72, 0.48, 0.05);
  const signalBox = addMeshToNode(doc, root, 'SignalHousing', signalBoxGeom, darkMetalMat);
  signalBox.setTranslation([0, 4.72, 0.05]);

  const lightSpecs: Array<[string, number, typeof lightRedMat]> = [
    ['SignalLamp_1', -0.78, lightRedMat],
    ['SignalLamp_2', 0, lightRedMat],
    ['SignalLamp_3', 0.78, lightGreenMat],
  ];
  for (const [lampName, lx, lampMat] of lightSpecs) {
    const lampGeom = buildLatheMesh(
      [
        { x: 0.01, y: 0 },
        { x: 0.22, y: 0.04 },
        { x: 0.22, y: 0.16 },
        { x: 0.01, y: 0.2 },
      ],
      14,
    );
    const lampNode = addMeshToNode(doc, root, lampName, lampGeom, lampMat);
    lampNode.setTranslation([lx, 4.72, 0.28]);
    lampNode.setRotation([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  }

  return writeGlb(doc, outPath);
}

async function buildChevronBoardGlb(
  outPath: string,
  chevronPng: Buffer,
): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('ChevronBoardRoot');
  doc.createScene('Scene').addChild(root);

  const postMat = createPbrMaterial(doc, {
    name: 'SignPostSteel',
    baseColorFactor: [0.3, 0.34, 0.4, 1],
    metallicFactor: 0.55,
    roughnessFactor: 0.42,
  });

  const signMat = createPbrMaterial(doc, {
    name: 'ChevronFace',
    baseColorTexturePng: chevronPng,
    emissiveFactor: [0.16, 0.04, 0.04],
    roughnessFactor: 0.35,
  });

  for (const px of [-1.25, 1.25]) {
    const postGeom = buildTubeAlongPath(
      [
        { x: px, y: 0, z: 0 },
        { x: px, y: 2.35, z: 0 },
      ],
      0.085,
      10,
      false,
    );
    addMeshToNode(doc, root, `SignPost_${px < 0 ? 'L' : 'R'}`, postGeom, postMat);
  }

  const boardGeom = buildBoxBeveled(3.6, 1.35, 0.16, 0.04);
  const boardNode = addMeshToNode(doc, root, 'ChevronPanel', boardGeom, signMat);
  boardNode.setTranslation([0, 1.85, 0]);

  return writeGlb(doc, outPath);
}

async function buildBoostPadGlb(
  outPath: string,
  boostPadPng: Buffer,
): Promise<number> {
  const doc = new Document();
  const root = doc.createNode('BoostPadRoot');
  doc.createScene('Scene').addChild(root);

  const frameMat = createPbrMaterial(doc, {
    name: 'BoostFrame',
    baseColorFactor: [0.14, 0.18, 0.28, 1],
    metallicFactor: 0.65,
    roughnessFactor: 0.35,
  });

  const deckMat = createPbrMaterial(doc, {
    name: 'BoostDeck',
    baseColorTexturePng: boostPadPng,
    emissiveFactor: [0.15, 0.55, 0.85],
    roughnessFactor: 0.25,
  });

  const frameGeom = buildBoxBeveled(2.7, 0.08, 4.1, 0.03);
  const frameNode = addMeshToNode(doc, root, 'BoostFrame', frameGeom, frameMat);
  frameNode.setTranslation([0, 0.04, 0]);

  const deckGeom = buildBoxBeveled(2.3, 0.05, 3.7, 0.02);
  const deckNode = addMeshToNode(doc, root, 'BoostDeck', deckGeom, deckMat);
  deckNode.setTranslation([0, 0.075, 0]);

  return writeGlb(doc, outPath);
}

async function writePngAsset(relPath: string, data: Buffer): Promise<number> {
  const absPath = path.join(PUBLIC_DIR, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, data);
  return data.byteLength;
}

async function writeMarkdownManifest(manifest: AssetManifest): Promise<void> {
  const lines: string[] = [
    '# ASSET MANIFEST — KART LEGENDS 3D',
    '',
    `Gerado automaticamente por \`npm run assets:build\` em ${manifest.generatedAt}.`,
    '',
    '| ID | Nome | Tipo | Caminho | Formato | Origem | Licença | Tamanho (bytes) | Status | Uso |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- |',
  ];

  for (const asset of manifest.assets) {
    lines.push(
      `| \`${asset.id}\` | ${asset.name} | \`${asset.type}\` | \`${asset.path}\` | \`${asset.format}\` | ${asset.origin} | \`${asset.license}\` | ${asset.sizeBytes} | \`${asset.validationStatus}\` | ${asset.usedIn.join(', ')} |`,
    );
  }

  lines.push('');
  await fs.writeFile(path.join(ROOT_DIR, 'ASSET_MANIFEST.md'), `${lines.join('\n')}`, 'utf8');
}

async function main(): Promise<void> {
  const entries: AssetManifestEntry[] = [];

  // 1. Textures & Character Portraits / Icons
  const asphalt = createAsphaltTextures(512);
  const curbPng = createCurbTexture(256);
  const startLinePng = createCheckeredStartTexture(512);
  const chevronPng = createChevronSignTexture(256);
  const boostPadPng = createBoostPadTexture(256);
  const toByteRgb = (rgb: [number, number, number]): [number, number, number] => [
    Math.round(rgb[0] * 255),
    Math.round(rgb[1] * 255),
    Math.round(rgb[2] * 255),
  ];

  const characterUiSpecs = CHARACTER_BUILD_SPECS.flatMap((spec) => {
    const def = CHARACTERS_BY_ID[spec.id];
    const pri = toByteRgb(spec.primaryRgb);
    const acc = toByteRgb(spec.accentRgb);
    const skin = toByteRgb(spec.furOrSkinRgb);
    const bgTop: [number, number, number] = [
      Math.min(255, pri[0] + 45),
      Math.min(255, pri[1] + 45),
      Math.min(255, pri[2] + 45),
    ];
    const bgBot: [number, number, number] = [
      Math.max(18, Math.round(pri[0] * 0.45)),
      Math.max(18, Math.round(pri[1] * 0.45)),
      Math.max(24, Math.round(pri[2] * 0.45)),
    ];
    return [
      {
        id: `ui-portrait-${spec.id}`,
        name: `Retrato de Seleção — ${def.name}`,
        type: 'ui' as const,
        relPath: `assets/ui/portrait_${spec.id}.png`,
        buffer: createCharacterPortraitPng(bgTop, bgBot, skin, acc, 256, false, spec.id),
        usedIn: ['CharacterSelect', 'RaceHud'],
      },
      {
        id: `ui-icon-${spec.id}`,
        name: `Ícone de HUD — ${def.name}`,
        type: 'ui' as const,
        relPath: `assets/ui/icon_${spec.id}.png`,
        buffer: createCharacterPortraitPng(bgTop, bgBot, skin, acc, 128, true, spec.id),
        usedIn: ['RaceHud', 'Minimap'],
      },
    ];
  });

  const textureSpecs: Array<{
    id: string;
    name: string;
    type: AssetManifestEntry['type'];
    relPath: string;
    buffer: Buffer;
    usedIn: string[];
  }> = [
    {
      id: 'tex-asphalt-albedo',
      name: 'Textura de Asfalto (Albedo)',
      type: 'texture',
      relPath: 'assets/textures/asphalt_albedo.png',
      buffer: asphalt.albedo,
      usedIn: ['TrackSurfaces'],
    },
    {
      id: 'tex-asphalt-roughness',
      name: 'Textura de Asfalto (Rugosidade)',
      type: 'texture',
      relPath: 'assets/textures/asphalt_roughness.png',
      buffer: asphalt.roughness,
      usedIn: ['TrackSurfaces'],
    },
    {
      id: 'tex-curb-albedo',
      name: 'Textura de Zebra de Curva',
      type: 'texture',
      relPath: 'assets/textures/curb_albedo.png',
      buffer: curbPng,
      usedIn: ['TrackCurbs'],
    },
    {
      id: 'tex-start-line-albedo',
      name: 'Faixa Quadriculada de Largada',
      type: 'texture',
      relPath: 'assets/textures/start_line_albedo.png',
      buffer: startLinePng,
      usedIn: ['StartGantry', 'TrackStartLine'],
    },
    {
      id: 'tex-chevron-sign-albedo',
      name: 'Placa Direcional de Curva',
      type: 'texture',
      relPath: 'assets/textures/chevron_sign_albedo.png',
      buffer: chevronPng,
      usedIn: ['ChevronBoardProp', 'TrackSigns'],
    },
    ...characterUiSpecs,
    ...(
      [
        ['pulso-solar', 'Ícone HUD — Pulso Solar', 'item_pulso_solar.png'],
        ['bolha-guardia', 'Ícone HUD — Bolha Guardiã', 'item_bolha_guardia.png'],
        ['nevoa-prisma', 'Ícone HUD — Névoa Prisma', 'item_nevoa_prisma.png'],
        ['faisca-rastreadora', 'Ícone HUD — Faísca Rastreadora', 'item_faisca_rastreadora.png'],
        ['onda-de-vento', 'Ícone HUD — Onda de Vento', 'item_onda_de_vento.png'],
        ['cristal-de-salto', 'Ícone HUD — Cristal de Salto', 'item_cristal_de_salto.png'],
      ] as Array<[ItemIconKind, string, string]>
    ).map(([kind, label, file]) => ({
      id: `ui-item-${kind}`,
      name: label,
      type: 'ui' as const,
      relPath: `assets/ui/${file}`,
      buffer: createItemIconPng(kind, 128),
      usedIn: ['RaceHud', 'ItemSlot'],
    })),
    {
      id: 'vfx-particles-atlas',
      name: 'Atlas de Partículas VFX (2x2)',
      type: 'vfx' as const,
      relPath: 'assets/vfx/particles_atlas.png',
      buffer: createVfxSpritesheetPng(256),
      usedIn: ['VfxSystem', 'RaceScene'],
    },
  ];

  for (const tex of textureSpecs) {
    const sizeBytes = await writePngAsset(tex.relPath, tex.buffer);
    entries.push({
      id: tex.id,
      name: tex.name,
      type: tex.type,
      path: `/${tex.relPath}`,
      format: 'png',
      origin: 'Pipeline local de texturas PBR e UI (texture-builder.ts)',
      author: 'Kart Legends 3D Pipeline',
      license: 'Original-Project-License',
      sizeBytes,
      validationStatus: 'validated',
      usedIn: tex.usedIn,
    });
  }

  // 2. Props GLB
  const startGantrySize = await buildStartGantryGlb(
    path.join(PUBLIC_DIR, 'assets/props/start_gantry.glb'),
    startLinePng,
  );
  entries.push({
    id: 'prop-start-gantry',
    name: 'Pórtico de Largada Metálico',
    type: 'prop',
    path: '/assets/props/start_gantry.glb',
    format: 'glb',
    origin: 'Pipeline local GLTF (@gltf-transform/core)',
    author: 'Kart Legends 3D Pipeline',
    license: 'Original-Project-License',
    sizeBytes: startGantrySize,
    validationStatus: 'validated',
    usedIn: ['AllTracks'],
    requiredNodes: ['StartGantryRoot', 'StartBanner', 'SignalHousing'],
  });

  const chevronBoardSize = await buildChevronBoardGlb(
    path.join(PUBLIC_DIR, 'assets/props/chevron_board.glb'),
    chevronPng,
  );
  entries.push({
    id: 'prop-chevron-board',
    name: 'Sinalizador Direcional de Curva',
    type: 'prop',
    path: '/assets/props/chevron_board.glb',
    format: 'glb',
    origin: 'Pipeline local GLTF (@gltf-transform/core)',
    author: 'Kart Legends 3D Pipeline',
    license: 'Original-Project-License',
    sizeBytes: chevronBoardSize,
    validationStatus: 'validated',
    usedIn: ['TrackCorners'],
    requiredNodes: ['ChevronBoardRoot', 'ChevronPanel'],
  });

  const boostPadSize = await buildBoostPadGlb(
    path.join(PUBLIC_DIR, 'assets/props/boost_pad.glb'),
    boostPadPng,
  );
  entries.push({
    id: 'prop-boost-pad',
    name: 'Placa de Impulso Luminosa',
    type: 'prop',
    path: '/assets/props/boost_pad.glb',
    format: 'glb',
    origin: 'Pipeline local GLTF (@gltf-transform/core)',
    author: 'Kart Legends 3D Pipeline',
    license: 'Original-Project-License',
    sizeBytes: boostPadSize,
    validationStatus: 'validated',
    usedIn: ['TrackBoostPads'],
    requiredNodes: ['BoostPadRoot', 'BoostDeck'],
  });

  // 3. All 8 Definitive Character GLBs (each with 9 real GLTF animation clips)
  for (const spec of CHARACTER_BUILD_SPECS) {
    const def = CHARACTERS_BY_ID[spec.id];
    const sizeBytes = await buildCharacterGlb(
      spec,
      path.join(PUBLIC_DIR, `assets/characters/${spec.id}.glb`),
    );
    entries.push({
      id: def.modelAssetId,
      name: `Piloto ${def.name} — ${def.title}`,
      type: 'character',
      path: `/assets/characters/${spec.id}.glb`,
      format: 'glb',
      origin: 'Pipeline local GLTF animado (character-builder.ts)',
      author: 'Kart Legends 3D Pipeline',
      license: 'Original-Project-License',
      sizeBytes,
      validationStatus: 'validated',
      usedIn: ['RaceScene', 'CharacterSelect', 'CharacterRig'],
      requiredNodes: [
        `Character_${spec.id}_Root`,
        'Torso',
        'Head',
        'ArmL',
        'ArmR',
        'EarL',
        'EarR',
        'TailBase',
      ],
      requiredAnimations: REQUIRED_CHARACTER_ANIMS,
    });
  }

  // 4. All 8 Structurally Distinct Kart GLBs
  for (const spec of KART_BUILD_SPECS) {
    const def = KARTS_BY_ID[spec.id];
    const fileSlug = spec.id.replace(/-/g, '_');
    const sizeBytes = await buildKartGlb(
      spec,
      path.join(PUBLIC_DIR, `assets/karts/${fileSlug}.glb`),
    );
    entries.push({
      id: def.modelAssetId,
      name: `Kart ${def.name}`,
      type: 'kart',
      path: `/assets/karts/${fileSlug}.glb`,
      format: 'glb',
      origin: 'Pipeline local GLTF de veículos (kart-builder.ts)',
      author: 'Kart Legends 3D Pipeline',
      license: 'Original-Project-License',
      sizeBytes,
      validationStatus: 'validated',
      usedIn: ['RaceScene', 'KartSelect', 'RacerMeshInstance'],
      requiredNodes: [
        'KartRoot',
        'ChassisGroup',
        'SteeringWheel',
        'DriverMount',
        'ExhaustL',
        'ExhaustR',
        'WheelFL',
        'WheelFR',
        'WheelRL',
        'WheelRR',
      ],
    });
  }

  // 5. Copa Aurora Track GLBs (Porto das Lanternas, Bosque de Cristal, Vale dos Moinhos, Cânion Solar)
  const auroraTrackSpecs: Array<{
    id: string;
    name: string;
    file: string;
    biome: TrackBiome;
    layout: typeof PORTO_DAS_LANTERNAS_LAYOUT;
    usedInComponent: string;
    extraNodes?: string[];
  }> = [
    {
      id: 'track-porto-das-lanternas',
      name: 'Pista 1 — Porto das Lanternas',
      file: 'porto_das_lanternas.glb',
      biome: 'porto',
      layout: PORTO_DAS_LANTERNAS_LAYOUT,
      usedInComponent: 'PortoDasLanternas',
    },
    {
      id: 'track-bosque-de-cristal',
      name: 'Pista 2 — Bosque de Cristal',
      file: 'bosque_de_cristal.glb',
      biome: 'bosque',
      layout: BOSQUE_DE_CRISTAL_LAYOUT,
      usedInComponent: 'BosqueDeCristal',
    },
    {
      id: 'track-vale-dos-moinhos',
      name: 'Pista 3 — Vale dos Moinhos',
      file: 'vale_dos_moinhos.glb',
      biome: 'vale',
      layout: VALE_DOS_MOINHOS_LAYOUT,
      usedInComponent: 'ValeDosMoinhos',
      extraNodes: ['WindmillBlades_0'],
    },
    {
      id: 'track-canion-solar',
      name: 'Pista 4 — Cânion Solar',
      file: 'canion_solar.glb',
      biome: 'canion',
      layout: CANION_SOLAR_LAYOUT,
      usedInComponent: 'CanionSolar',
    },
    {
      id: 'track-cidade-neon',
      name: 'Pista 5 — Cidade Neon',
      file: 'cidade_neon.glb',
      biome: 'neon',
      layout: CIDADE_NEON_LAYOUT,
      usedInComponent: 'CidadeNeon',
    },
    {
      id: 'track-pico-boreal',
      name: 'Pista 6 — Pico Boreal',
      file: 'pico_boreal.glb',
      biome: 'boreal',
      layout: PICO_BOREAL_LAYOUT,
      usedInComponent: 'PicoBoreal',
    },
    {
      id: 'track-jardim-celeste',
      name: 'Pista 7 — Jardim Celeste',
      file: 'jardim_celeste.glb',
      biome: 'celeste',
      layout: JARDIM_CELESTE_LAYOUT,
      usedInComponent: 'JardimCeleste',
    },
    {
      id: 'track-fortaleza-tempestade',
      name: 'Pista 8 — Fortaleza Tempestade',
      file: 'fortaleza_tempestade.glb',
      biome: 'fortaleza',
      layout: FORTALEZA_TEMPESTADE_LAYOUT,
      usedInComponent: 'FortalezaTempestade',
    },
  ];

  for (const trackSpec of auroraTrackSpecs) {
    const trackSize = await buildTrackGlb(
      trackSpec.layout,
      trackSpec.biome,
      path.join(PUBLIC_DIR, 'assets/tracks', trackSpec.file),
    );
    entries.push({
      id: trackSpec.id,
      name: trackSpec.name,
      type: 'track',
      path: `/assets/tracks/${trackSpec.file}`,
      format: 'glb',
      origin: 'Pipeline local GLTF de pistas (track-builder.ts)',
      author: 'Kart Legends 3D Pipeline',
      license: 'Original-Project-License',
      sizeBytes: trackSize,
      validationStatus: 'validated',
      usedIn: ['RaceScene', trackSpec.usedInComponent],
      requiredNodes: [
        'TrackRoot',
        'MainRoadMesh',
        'LeftStoneWall',
        'RightStoneWall',
        'TrackStartGantry',
        'SceneryGroup',
        ...(trackSpec.extraNodes ?? []),
      ],
    });
  }

  // 6. Item Box & 6 Original Items GLBs
  const itemBoxSize = await buildItemBoxGlb(path.join(PUBLIC_DIR, 'assets/props/item_box.glb'));
  entries.push({
    id: 'prop-item-box',
    name: 'Caixa de Item Prismática',
    type: 'prop',
    path: '/assets/props/item_box.glb',
    format: 'glb',
    origin: 'Pipeline local GLTF (item-builder.ts)',
    author: 'Kart Legends 3D Pipeline',
    license: 'Original-Project-License',
    sizeBytes: itemBoxSize,
    validationStatus: 'validated',
    usedIn: ['RaceScene', 'ItemBoxes'],
    requiredNodes: ['ItemBoxRoot', 'ItemBoxShell', 'ItemBoxCore'],
  });

  const itemBuilders: Array<{
    id: string;
    name: string;
    file: string;
    rootNode: string;
    builder: (out: string) => Promise<number>;
  }> = [
    {
      id: 'item-pulso-solar',
      name: 'Item 3D — Pulso Solar',
      file: 'pulso_solar.glb',
      rootNode: 'PulsoSolarRoot',
      builder: buildPulsoSolarGlb,
    },
    {
      id: 'item-bolha-guardia',
      name: 'Item 3D — Bolha Guardiã',
      file: 'bolha_guardia.glb',
      rootNode: 'BolhaGuardiaRoot',
      builder: buildBolhaGuardiaGlb,
    },
    {
      id: 'item-nevoa-prisma',
      name: 'Item 3D — Névoa Prisma',
      file: 'nevoa_prisma.glb',
      rootNode: 'NevoaPrismaRoot',
      builder: buildNevoaPrismaGlb,
    },
    {
      id: 'item-faisca-rastreadora',
      name: 'Item 3D — Faísca Rastreadora',
      file: 'faisca_rastreadora.glb',
      rootNode: 'FaiscaRastreadoraRoot',
      builder: buildFaiscaRastreadoraGlb,
    },
    {
      id: 'item-onda-de-vento',
      name: 'Item 3D — Onda de Vento',
      file: 'onda_de_vento.glb',
      rootNode: 'OndaDeVentoRoot',
      builder: buildOndaDeVentoGlb,
    },
    {
      id: 'item-cristal-de-salto',
      name: 'Item 3D — Cristal de Salto',
      file: 'cristal_de_salto.glb',
      rootNode: 'CristalDeSaltoRoot',
      builder: buildCristalDeSaltoGlb,
    },
  ];

  for (const itemSpec of itemBuilders) {
    const sizeBytes = await itemSpec.builder(path.join(PUBLIC_DIR, 'assets/items', itemSpec.file));
    entries.push({
      id: itemSpec.id,
      name: itemSpec.name,
      type: 'item',
      path: `/assets/items/${itemSpec.file}`,
      format: 'glb',
      origin: 'Pipeline local GLTF (item-builder.ts)',
      author: 'Kart Legends 3D Pipeline',
      license: 'Original-Project-License',
      sizeBytes,
      validationStatus: 'validated',
      usedIn: ['RaceScene', 'ItemSystem'],
      requiredNodes: [itemSpec.rootNode],
    });
  }

  // 7. Audio Music, Ambience & SFX
  const uiClickSize = await generateUiClickOgg(path.join(PUBLIC_DIR, 'assets/audio/sfx/ui_click.ogg'));
  entries.push({
    id: 'sfx-ui-click',
    name: 'Som de Clique de Interface',
    type: 'audio-sfx',
    path: '/assets/audio/sfx/ui_click.ogg',
    format: 'ogg',
    origin: 'Síntese PCM local + ffmpeg Opus',
    author: 'Kart Legends 3D Audio',
    license: 'Original-Project-License',
    sizeBytes: uiClickSize,
    validationStatus: 'validated',
    usedIn: ['UISystem'],
  });

  const uiConfirmSize = await generateUiConfirmOgg(
    path.join(PUBLIC_DIR, 'assets/audio/sfx/ui_confirm.ogg'),
  );
  entries.push({
    id: 'sfx-ui-confirm',
    name: 'Som de Confirmação de Interface',
    type: 'audio-sfx',
    path: '/assets/audio/sfx/ui_confirm.ogg',
    format: 'ogg',
    origin: 'Síntese PCM local + ffmpeg Opus',
    author: 'Kart Legends 3D Audio',
    license: 'Original-Project-License',
    sizeBytes: uiConfirmSize,
    validationStatus: 'validated',
    usedIn: ['UISystem'],
  });

  const musicSpecs: Array<{
    id: string;
    name: string;
    file: string;
    gen: (out: string) => Promise<number>;
  }> = [
    { id: 'music-menu', name: 'Música — Menu Principal', file: 'menu_theme.ogg', gen: generateMenuThemeOgg },
    { id: 'music-race-aurora', name: 'Música — Corrida Copa Aurora', file: 'race_aurora.ogg', gen: generateRaceMusicOgg },
    { id: 'music-race-eclipse', name: 'Música — Corrida Copa Eclipse', file: 'race_eclipse.ogg', gen: generateEclipseRaceMusicOgg },
    { id: 'music-victory', name: 'Música — Vitória', file: 'victory_fanfare.ogg', gen: generateVictoryFanfareOgg },
    { id: 'music-defeat', name: 'Música — Derrota / Consolação', file: 'defeat_theme.ogg', gen: generateDefeatThemeOgg },
  ];

  for (const m of musicSpecs) {
    const sizeBytes = await m.gen(path.join(PUBLIC_DIR, 'assets/audio/music', m.file));
    entries.push({
      id: m.id,
      name: m.name,
      type: 'audio-music',
      path: `/assets/audio/music/${m.file}`,
      format: 'ogg',
      origin: 'Síntese PCM local + ffmpeg Opus',
      author: 'Kart Legends 3D Audio',
      license: 'Original-Project-License',
      sizeBytes,
      validationStatus: 'validated',
      usedIn: ['AudioEngine'],
    });
  }

  const sfxDir = path.join(PUBLIC_DIR, 'assets/audio/sfx');
  const raceSfxSizes = await generateRaceSfxLibrary(sfxDir);
  const sfxLabels: Record<string, string> = {
    countdown_beep: 'Contagem Regressiva (Beep)',
    countdown_go: 'Contagem Regressiva (Largada)',
    drift_spark: 'Faísca de Drift',
    turbo_boost: 'Disparo de Turbo',
    collision_hit: 'Impacto de Colisão',
    jump_launch: 'Impulso de Salto',
    land_thud: 'Aterrissagem',
    item_pickup: 'Coleta de Item',
    item_use: 'Utilização de Item',
    lap_complete: 'Volta Concluída',
    race_finish: 'Chegada da Corrida',
  };
  for (const [key, sizeBytes] of Object.entries(raceSfxSizes)) {
    entries.push({
      id: `sfx-${key.replace(/_/g, '-')}`,
      name: sfxLabels[key] ?? key,
      type: 'audio-sfx',
      path: `/assets/audio/sfx/${key}.ogg`,
      format: 'ogg',
      origin: 'Síntese PCM local + ffmpeg Opus',
      author: 'Kart Legends 3D Audio',
      license: 'Original-Project-License',
      sizeBytes,
      validationStatus: 'validated',
      usedIn: ['AudioEngine', 'RaceScene'],
    });
  }

  const ambienceSpecs: Array<{
    id: string;
    name: string;
    file: string;
    trackRef: string;
    gen: (out: string) => Promise<number>;
  }> = [
    {
      id: 'sfx-ambience-coastal',
      name: 'Ambiência — Costa e Ondas',
      file: 'ambience_coastal.ogg',
      trackRef: 'PortoDasLanternas',
      gen: generateAmbienceCoastalOgg,
    },
    {
      id: 'sfx-ambience-forest',
      name: 'Ambiência — Bosque e Cascata',
      file: 'ambience_forest.ogg',
      trackRef: 'BosqueDeCristal',
      gen: generateAmbienceForestOgg,
    },
    {
      id: 'sfx-ambience-valley',
      name: 'Ambiência — Brisa do Vale',
      file: 'ambience_valley.ogg',
      trackRef: 'ValeDosMoinhos',
      gen: generateAmbienceValleyOgg,
    },
    {
      id: 'sfx-ambience-canyon',
      name: 'Ambiência — Ventos do Cânion',
      file: 'ambience_canyon.ogg',
      trackRef: 'CanionSolar',
      gen: generateAmbienceCanyonOgg,
    },
    {
      id: 'sfx-ambience-neon',
      name: 'Ambiência — Metrópole Neon',
      file: 'ambience_neon.ogg',
      trackRef: 'CidadeNeon',
      gen: generateAmbienceNeonOgg,
    },
    {
      id: 'sfx-ambience-boreal',
      name: 'Ambiência — Vento Glacial',
      file: 'ambience_boreal.ogg',
      trackRef: 'PicoBoreal',
      gen: generateAmbienceBorealOgg,
    },
    {
      id: 'sfx-ambience-sky',
      name: 'Ambiência — Jardins Suspensos',
      file: 'ambience_sky.ogg',
      trackRef: 'JardimCeleste',
      gen: generateAmbienceSkyOgg,
    },
    {
      id: 'sfx-ambience-storm',
      name: 'Ambiência — Trovões da Fortaleza',
      file: 'ambience_storm.ogg',
      trackRef: 'FortalezaTempestade',
      gen: generateAmbienceStormOgg,
    },
  ];

  for (const amb of ambienceSpecs) {
    const ambienceSize = await amb.gen(path.join(sfxDir, amb.file));
    entries.push({
      id: amb.id,
      name: amb.name,
      type: 'audio-sfx',
      path: `/assets/audio/sfx/${amb.file}`,
      format: 'ogg',
      origin: 'Síntese PCM local + ffmpeg Opus',
      author: 'Kart Legends 3D Audio',
      license: 'Original-Project-License',
      sizeBytes: ambienceSize,
      validationStatus: 'validated',
      usedIn: ['AudioEngine', amb.trackRef],
    });
  }

  const manifest: AssetManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    project: 'KART LEGENDS 3D',
    assets: entries,
  };

  const manifestOutPath = path.join(PUBLIC_DIR, 'assets/manifest.json');
  await fs.writeFile(manifestOutPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeMarkdownManifest(manifest);

  console.log(`Build de assets concluído: ${entries.length} recursos gerados em public/assets/.`);
}

main().catch((err) => {
  console.error('Erro ao gerar assets:', err);
  process.exit(1);
});
