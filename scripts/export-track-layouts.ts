import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOSQUE_DE_CRISTAL_LAYOUT } from '../src/game/tracks/bosqueDeCristal';
import { CANION_SOLAR_LAYOUT } from '../src/game/tracks/canionSolar';
import { CIDADE_NEON_LAYOUT } from '../src/game/tracks/cidadeNeon';
import { FORTALEZA_TEMPESTADE_LAYOUT } from '../src/game/tracks/fortalezaTempestade';
import { JARDIM_CELESTE_LAYOUT } from '../src/game/tracks/jardimCeleste';
import { PICO_BOREAL_LAYOUT } from '../src/game/tracks/picoBoreal';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../src/game/tracks/portoDasLanternas';
import { VALE_DOS_MOINHOS_LAYOUT } from '../src/game/tracks/valeDosMoinhos';
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
} from './asset-pipeline/texture-builder';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'blender', '.cache');

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Export reusable procedural textures for Blender track materials
  const asphalt = createAsphaltTextures(512);
  const textures: Record<string, Buffer> = {
    asphalt_albedo: asphalt.albedo,
    asphalt_roughness: asphalt.roughness,
    start_line: createCheckeredStartTexture(512),
    chevron: createChevronSignTexture(256),
    boost_pad: createBoostPadTexture(256),
    dirt: createDirtTrackTexture(256),
    sand: createSandTexture(256),
    grass: createGrassTurfTexture(256),
    cobble: createCobbleTexture(256),
    terracotta: createTerracottaTexture(256),
    water: createWaterTexture(256),
    ice: createIceTexture(256),
    curb_porto: createCurbTexture(256, [232, 62, 50], [248, 246, 240]),
    curb_bosque: createCurbTexture(256, [45, 212, 191], [236, 253, 245]),
    curb_vale: createCurbTexture(256, [234, 179, 8], [254, 249, 195]),
    curb_canion: createCurbTexture(256, [234, 88, 12], [254, 243, 199]),
    curb_neon: createCurbTexture(256, [56, 189, 248], [236, 72, 153]),
    curb_boreal: createCurbTexture(256, [94, 234, 212], [224, 242, 254]),
    curb_celeste: createCurbTexture(256, [244, 114, 182], [254, 249, 195]),
    curb_fortaleza: createCurbTexture(256, [167, 139, 250], [229, 231, 235]),
  };

  for (const [name, buf] of Object.entries(textures)) {
    await fs.writeFile(path.join(OUT_DIR, `${name}.png`), buf);
  }

  const tracks = [
    { id: 'porto-das-lanternas', file: 'porto_das_lanternas.glb', biome: 'porto', layout: PORTO_DAS_LANTERNAS_LAYOUT },
    { id: 'bosque-de-cristal', file: 'bosque_de_cristal.glb', biome: 'bosque', layout: BOSQUE_DE_CRISTAL_LAYOUT },
    { id: 'vale-dos-moinhos', file: 'vale_dos_moinhos.glb', biome: 'vale', layout: VALE_DOS_MOINHOS_LAYOUT },
    { id: 'canion-solar', file: 'canion_solar.glb', biome: 'canion', layout: CANION_SOLAR_LAYOUT },
    { id: 'cidade-neon', file: 'cidade_neon.glb', biome: 'neon', layout: CIDADE_NEON_LAYOUT },
    { id: 'pico-boreal', file: 'pico_boreal.glb', biome: 'boreal', layout: PICO_BOREAL_LAYOUT },
    { id: 'jardim-celeste', file: 'jardim_celeste.glb', biome: 'celeste', layout: JARDIM_CELESTE_LAYOUT },
    { id: 'fortaleza-tempestade', file: 'fortaleza_tempestade.glb', biome: 'fortaleza', layout: FORTALEZA_TEMPESTADE_LAYOUT },
  ];

  await fs.writeFile(path.join(OUT_DIR, 'tracks_data.json'), JSON.stringify(tracks), 'utf8');
  console.log(`Exported ${tracks.length} track layouts & ${Object.keys(textures).length} textures to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
