import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAudioSources, validateManifestSchema } from '../game/core/assetLoader';
import { joinPublicUrl, publicUrl } from '../game/core/publicUrl';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('public URL base joining', () => {
  it('keeps root-absolute public paths when the app is served at /', () => {
    expect(joinPublicUrl('/', '/assets/manifest.json')).toBe('/assets/manifest.json');
    expect(joinPublicUrl('/', 'assets/audio/sfx/ui_click.ogg')).toBe(
      '/assets/audio/sfx/ui_click.ogg',
    );
  });

  it('prefixes the GitHub Pages subpath without producing a double slash', () => {
    expect(joinPublicUrl('/kart3d/', '/assets/tracks/porto_das_lanternas.glb')).toBe(
      '/kart3d/assets/tracks/porto_das_lanternas.glb',
    );
    expect(joinPublicUrl('/kart3d', '/assets/audio/music/menu_theme.mp3')).toBe(
      '/kart3d/assets/audio/music/menu_theme.mp3',
    );
    expect(joinPublicUrl('/kart3d/', '/manifest.webmanifest')).toBe(
      '/kart3d/manifest.webmanifest',
    );
  });

  it('uses the Vite base injected for this test run', () => {
    const base = import.meta.env.BASE_URL || '/';
    expect(publicUrl('/assets/manifest.json')).toBe(joinPublicUrl(base, '/assets/manifest.json'));
  });

  it('prefixes both OGG and MP3 fallback audio sources with BASE_URL (CRÍTICO-02)', () => {
    vi.stubEnv('BASE_URL', '/kart3d/');
    const rawManifest = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/assets/manifest.json'), 'utf8'),
    );
    const manifest = validateManifestSchema(rawManifest);

    const sources = resolveAudioSources(manifest, 'music-menu');
    expect(sources).toEqual([
      '/kart3d/assets/audio/music/menu_theme.ogg',
      '/kart3d/assets/audio/music/menu_theme.mp3',
    ]);

    const sfxSources = resolveAudioSources(manifest, 'sfx-ui-click');
    expect(sfxSources).toEqual([
      '/kart3d/assets/audio/sfx/ui_click.ogg',
      '/kart3d/assets/audio/sfx/ui_click.mp3',
    ]);
  });
});
