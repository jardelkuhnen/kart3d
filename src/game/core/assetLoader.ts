import * as THREE from 'three';
import { ALLOWED_ASSET_LICENSES } from './constants';
import { publicUrl } from './publicUrl';
import type { AssetManifest, AssetManifestEntry } from './types';

let cachedManifest: AssetManifest | null = null;

const REQUIRED_MANIFEST_KEYS: ReadonlyArray<keyof AssetManifestEntry> = [
  'id',
  'name',
  'type',
  'path',
  'format',
  'origin',
  'author',
  'license',
  'sizeBytes',
  'validationStatus',
  'usedIn',
];

export function validateManifestSchema(manifest: unknown): AssetManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifesto de assets inválido: objeto raiz ausente.');
  }

  const candidate = manifest as Partial<AssetManifest>;
  if (typeof candidate.version !== 'number' || !Array.isArray(candidate.assets)) {
    throw new Error('Manifesto de assets inválido: campos version ou assets ausentes.');
  }

  const seenIds = new Set<string>();
  for (const entry of candidate.assets) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Entrada inválida no manifesto de assets.');
    }

    for (const key of REQUIRED_MANIFEST_KEYS) {
      const value = entry[key];
      if (value === undefined || value === null || value === '') {
        throw new Error(`Asset "${entry.id ?? 'desconhecido'}" sem campo obrigatório: ${String(key)}`);
      }
    }

    if (seenIds.has(entry.id)) {
      throw new Error(`ID duplicado no manifesto de assets: ${entry.id}`);
    }
    seenIds.add(entry.id);

    if (entry.sizeBytes <= 0) {
      throw new Error(`Asset "${entry.id}" possui sizeBytes inválido (${entry.sizeBytes}).`);
    }

    if (
      !ALLOWED_ASSET_LICENSES.includes(
        entry.license as (typeof ALLOWED_ASSET_LICENSES)[number],
      )
    ) {
      throw new Error(`Licença não autorizada para "${entry.id}": ${entry.license}`);
    }

    if (!entry.path.startsWith('/assets/')) {
      throw new Error(`Caminho inválido para "${entry.id}": ${entry.path}`);
    }
  }

  return candidate as AssetManifest;
}

export async function loadAssetManifest(forceRefresh = false): Promise<AssetManifest> {
  if (cachedManifest && !forceRefresh) {
    return cachedManifest;
  }

  const manifestUrl = publicUrl('/assets/manifest.json');
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${manifestUrl} (HTTP ${response.status}).`);
  }

  const raw: unknown = await response.json();
  cachedManifest = validateManifestSchema(raw);
  return cachedManifest;
}

export function getManifestEntry(manifest: AssetManifest, assetId: string): AssetManifestEntry {
  const entry = manifest.assets.find((item) => item.id === assetId);
  if (!entry) {
    throw new Error(`Asset obrigatório não encontrado no manifesto: "${assetId}".`);
  }
  if (entry.validationStatus !== 'validated') {
    throw new Error(
      `Asset "${assetId}" não está validado (status atual: ${entry.validationStatus}).`,
    );
  }
  return entry;
}

export function resolveAssetPath(manifest: AssetManifest, assetId: string): string {
  return publicUrl(getManifestEntry(manifest, assetId).path);
}

export function resolveAudioSources(manifest: AssetManifest, assetId: string): string[] {
  const primary = resolveAssetPath(manifest, assetId);
  const mp3Id = `${assetId}-mp3`;
  const mp3Entry = manifest.assets.find(
    (item) => item.id === mp3Id && item.validationStatus === 'validated',
  );
  return mp3Entry ? [primary, publicUrl(mp3Entry.path)] : [primary];
}

export function disposeClonedMaterialsOnly(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      if (Array.isArray(obj.material)) {
        for (const mat of obj.material) {
          mat.dispose();
        }
      } else if (obj.material) {
        obj.material.dispose();
      }
    }
  });
}

export function disposeMaterial(material: THREE.Material): void {
  const textureProps = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
    'aoMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
  ] as const;

  const record = material as unknown as Record<string, unknown>;
  for (const prop of textureProps) {
    const tex = record[prop];
    if (tex instanceof THREE.Texture) {
      tex.dispose();
    }
  }

  material.dispose();
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        for (const mat of obj.material) {
          disposeMaterial(mat);
        }
      } else if (obj.material) {
        disposeMaterial(obj.material);
      }
    }
  });
}
