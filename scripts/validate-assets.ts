import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { validateManifestSchema } from '../src/game/core/assetLoader';
import type { AssetManifestEntry } from '../src/game/core/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

async function collectFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function validateGlbFile(absPath: string, entry: AssetManifestEntry): Promise<string[]> {
  const errors: string[] = [];
  const raw = await fs.readFile(absPath);

  if (raw.byteLength < 12 || raw.subarray(0, 4).toString('ascii') !== 'glTF') {
    errors.push(`[${entry.id}] Assinatura binária GLB ausente ou inválida.`);
    return errors;
  }

  const io = new NodeIO();
  const doc = await io.readBinary(new Uint8Array(raw));
  const root = doc.getRoot();
  const meshes = root.listMeshes();

  if (meshes.length === 0) {
    errors.push(`[${entry.id}] Modelo GLB não contém nenhuma malha.`);
  }

  for (const mesh of meshes) {
    const primitives = mesh.listPrimitives();
    if (primitives.length === 0) {
      errors.push(`[${entry.id}] Malha "${mesh.getName()}" sem primitivas.`);
    }
    for (const prim of primitives) {
      if (!prim.getAttribute('POSITION')) {
        errors.push(`[${entry.id}] Primitiva em "${mesh.getName()}" sem atributo POSITION.`);
      }
      if (!prim.getAttribute('NORMAL')) {
        errors.push(`[${entry.id}] Primitiva em "${mesh.getName()}" sem atributo NORMAL.`);
      }
    }
  }

  if (entry.requiredNodes?.length) {
    const nodeNames = new Set(root.listNodes().map((node) => node.getName()));
    for (const reqNode of entry.requiredNodes) {
      if (!nodeNames.has(reqNode)) {
        errors.push(`[${entry.id}] Nó obrigatório ausente no GLB: "${reqNode}".`);
      }
    }
  }

  if (entry.requiredAnimations?.length) {
    const animMap = new Map(root.listAnimations().map((anim) => [anim.getName(), anim]));
    for (const reqAnim of entry.requiredAnimations) {
      const anim = animMap.get(reqAnim);
      if (!anim) {
        errors.push(`[${entry.id}] Animação obrigatória ausente no GLB: "${reqAnim}".`);
      } else if (anim.listChannels().length === 0 || anim.listSamplers().length === 0) {
        errors.push(`[${entry.id}] Animação "${reqAnim}" sem canais ou samplers válidos.`);
      }
    }
  }

  return errors;
}

async function validatePngFile(absPath: string, entry: AssetManifestEntry): Promise<string[]> {
  const errors: string[] = [];
  const raw = await fs.readFile(absPath);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (raw.byteLength < 8 || !raw.subarray(0, 8).equals(pngSig)) {
    errors.push(`[${entry.id}] Cabeçalho PNG inválido.`);
    return errors;
  }

  const parsed = PNG.sync.read(raw);
  if (parsed.width <= 0 || parsed.height <= 0) {
    errors.push(`[${entry.id}] Dimensões PNG inválidas (${parsed.width}x${parsed.height}).`);
  }
  return errors;
}

async function validateAudioFile(absPath: string, entry: AssetManifestEntry): Promise<string[]> {
  const errors: string[] = [];
  const raw = await fs.readFile(absPath);
  if (raw.byteLength < 16) {
    errors.push(`[${entry.id}] Arquivo de áudio truncado.`);
    return errors;
  }

  if (entry.format === 'ogg' && raw.subarray(0, 4).toString('ascii') !== 'OggS') {
    errors.push(`[${entry.id}] Cabeçalho OggS inválido.`);
  } else if (entry.format === 'mp3') {
    const hasId3 = raw.subarray(0, 3).toString('ascii') === 'ID3';
    const hasMpegSync = raw[0] === 0xff && (raw[1] & 0xe0) === 0xe0;
    if (!hasId3 && !hasMpegSync) {
      errors.push(`[${entry.id}] Cabeçalho MP3 (ID3/MPEG sync) inválido.`);
    }
  } else if (entry.format === 'wav' && raw.subarray(0, 4).toString('ascii') !== 'RIFF') {
    errors.push(`[${entry.id}] Cabeçalho WAV RIFF inválido.`);
  }

  return errors;
}

async function main(): Promise<void> {
  const manifestPath = path.join(ASSETS_DIR, 'manifest.json');
  const rawJson = await fs.readFile(manifestPath, 'utf8');
  const manifest = validateManifestSchema(JSON.parse(rawJson));

  const errors: string[] = [];
  const manifestedPaths = new Set<string>([manifestPath]);

  for (const entry of manifest.assets) {
    const relFromPublic = entry.path.replace(/^\/+/, '');
    const absPath = path.join(PUBLIC_DIR, relFromPublic);
    manifestedPaths.add(absPath);

    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      errors.push(`[${entry.id}] Arquivo ausente em disco: ${entry.path}`);
      continue;
    }

    if (stat.size !== entry.sizeBytes) {
      errors.push(
        `[${entry.id}] Tamanho divergente (manifesto=${entry.sizeBytes}, disco=${stat.size}).`,
      );
    }

    if (entry.validationStatus !== 'validated') {
      errors.push(`[${entry.id}] Status de validação não aprovado: ${entry.validationStatus}`);
    }

    if (entry.format === 'glb') {
      errors.push(...(await validateGlbFile(absPath, entry)));
    } else if (entry.format === 'png') {
      errors.push(...(await validatePngFile(absPath, entry)));
    } else if (entry.format === 'ogg' || entry.format === 'wav' || entry.format === 'mp3') {
      errors.push(...(await validateAudioFile(absPath, entry)));
    }
  }

  const entriesById = new Map(manifest.assets.map((item) => [item.id, item]));
  for (const entry of manifest.assets) {
    if (
      (entry.type === 'audio-music' || entry.type === 'audio-sfx') &&
      entry.format === 'ogg'
    ) {
      const mp3Fallback = entriesById.get(`${entry.id}-mp3`);
      const expectedMp3Path = entry.path.replace(/\.ogg$/, '.mp3');
      if (
        !mp3Fallback ||
        mp3Fallback.format !== 'mp3' ||
        mp3Fallback.validationStatus !== 'validated' ||
        mp3Fallback.path !== expectedMp3Path
      ) {
        errors.push(
          `[${entry.id}] Fallback MP3 iOS/Safari ausente ou inválido (esperado: "${entry.id}-mp3" em ${expectedMp3Path}).`,
        );
      }
    }
  }

  const diskFiles = await collectFilesRecursive(ASSETS_DIR);
  for (const diskFile of diskFiles) {
    if (!manifestedPaths.has(diskFile)) {
      const rel = path.relative(PUBLIC_DIR, diskFile);
      errors.push(`Arquivo órfão não registrado no manifesto: /${rel}`);
    }
  }

  if (errors.length > 0) {
    console.error('FALHA NA VALIDAÇÃO DE ASSETS:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `Validação concluída com sucesso: ${manifest.assets.length} ativos verificados, 0 erros, 0 arquivos órfãos.`,
  );
}

main().catch((err) => {
  console.error('Erro fatal na validação de assets:', err);
  process.exit(1);
});
