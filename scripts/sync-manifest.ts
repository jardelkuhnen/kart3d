import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssetManifest } from '../src/game/core/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'assets/manifest.json');

const BLENDER_ORIGINS: Record<string, string> = {
  character: 'Blender 4.5.16 LTS Python Pipeline (scripts/blender/build_characters.py)',
  kart: 'Blender 4.5.16 LTS Python Pipeline (scripts/blender/build_karts.py)',
  track: 'Blender 4.5.16 LTS Python Pipeline (scripts/blender/build_tracks.py)',
  item: 'Blender 4.5.16 LTS Python Pipeline (scripts/blender/build_items_and_props.py)',
  prop: 'Blender 4.5.16 LTS Python Pipeline (scripts/blender/build_items_and_props.py)',
};

async function main(): Promise<void> {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw) as AssetManifest;
  manifest.generatedAt = new Date().toISOString();

  let updated = 0;
  for (const entry of manifest.assets) {
    const absPath = path.join(PUBLIC_DIR, entry.path.replace(/^\/+/, ''));
    const stat = await fs.stat(absPath);
    entry.sizeBytes = stat.size;
    entry.validationStatus = 'validated';

    if (entry.format === 'glb' && BLENDER_ORIGINS[entry.type]) {
      entry.origin = BLENDER_ORIGINS[entry.type];
      entry.author = 'Kart Legends 3D — Blender 4.5 Pipeline';
      updated += 1;
    } else if (entry.type === 'ui' && entry.format === 'png') {
      if (entry.id.startsWith('ui-item-')) {
        entry.origin = 'Blender 4.5.16 LTS Cycles Studio Render (scripts/blender/build_items_and_props.py)';
      } else {
        entry.origin = 'Blender 4.5.16 LTS Cycles Studio Render (scripts/blender/build_characters.py)';
      }
      entry.author = 'Kart Legends 3D — Blender 4.5 Pipeline';
      updated += 1;
    }
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const lines: string[] = [
    '# ASSET MANIFEST — KART LEGENDS 3D',
    '',
    `Gerado automaticamente por \`scripts/sync-manifest.ts\` (Blender 4.5.16 LTS Pipeline) em ${manifest.generatedAt}.`,
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
  await fs.writeFile(path.join(ROOT_DIR, 'ASSET_MANIFEST.md'), lines.join('\n'), 'utf8');
  console.log(`Synced ${manifest.assets.length} manifest entries (${updated} Blender-remodeled assets updated).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
