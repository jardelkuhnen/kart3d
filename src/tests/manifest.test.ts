import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateManifestSchema } from '../game/core/assetLoader';
import { ALLOWED_ASSET_LICENSES } from '../game/core/constants';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'assets/manifest.json');

describe('Asset Manifest & Integrity', () => {
  it('loads and validates public/assets/manifest.json with all mandatory metadata fields', async () => {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const manifest = validateManifestSchema(JSON.parse(raw));

    expect(manifest.project).toBe('KART LEGENDS 3D');
    expect(manifest.assets.length).toBeGreaterThanOrEqual(8);

    for (const entry of manifest.assets) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.usedIn.length).toBeGreaterThan(0);
      expect(ALLOWED_ASSET_LICENSES).toContain(entry.license);
      expect(entry.validationStatus).toBe('validated');

      const diskPath = path.join(PUBLIC_DIR, entry.path.replace(/^\/+/, ''));
      const stat = await fs.stat(diskPath);
      expect(stat.size).toBe(entry.sizeBytes);
      expect(stat.size).toBeGreaterThan(0);
    }
  });
});
