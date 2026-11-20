import { describe, expect, it } from 'vitest';
import { joinPublicUrl, publicUrl } from '../game/core/publicUrl';

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
});
