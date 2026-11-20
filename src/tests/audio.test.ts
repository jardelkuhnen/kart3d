import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { validateManifestSchema } from '../game/core/assetLoader';
import { DEFAULT_SETTINGS } from '../game/core/constants';

const MANIFEST_PATH = path.resolve(import.meta.dirname, '../../public/assets/manifest.json');

describe('Audio Engine Channel Controls & Autoplay-Safe Lifecycle', () => {
  it('computes independent music, sfx and ambient volumes and zeros all channels when muted', () => {
    const engine = new GameAudioEngine({
      musicVolume: 0.7,
      sfxVolume: 0.9,
      ambientVolume: 0.4,
      muted: false,
    });

    expect(engine.getEffectiveChannelVolume('music')).toBeCloseTo(0.7, 5);
    expect(engine.getEffectiveChannelVolume('sfx')).toBeCloseTo(0.9, 5);
    expect(engine.getEffectiveChannelVolume('ambient')).toBeCloseTo(0.4, 5);

    engine.applySettings({
      ...DEFAULT_SETTINGS.audio,
      musicVolume: 0.25,
      sfxVolume: 0.85,
      ambientVolume: 0.5,
      muted: true,
    });

    expect(engine.getEffectiveChannelVolume('music')).toBe(0);
    expect(engine.getEffectiveChannelVolume('sfx')).toBe(0);
    expect(engine.getEffectiveChannelVolume('ambient')).toBe(0);

    // Safe invocation in headless test environment & idempotent unlock for iOS gestures
    expect(() => {
      engine.unlock();
      engine.unlock();
      expect(engine.isUnlocked()).toBe(true);
      engine.playSfx('sfx-ui-confirm');
      engine.playMusic('music-race-aurora');
      engine.updateEngineTelemetry(80, true, false, 1, true, false, true);
      engine.dispose();
    }).not.toThrow();
  });

  it('resolves ordered [ogg, mp3] sources for Howler.js playback on Android & iOS Safari/Chrome', async () => {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const manifest = validateManifestSchema(JSON.parse(raw));
    const engine = new GameAudioEngine(DEFAULT_SETTINGS.audio);
    engine.setManifest(manifest);

    expect(engine.resolveSources('music-menu')).toEqual([
      '/assets/audio/music/menu_theme.ogg',
      '/assets/audio/music/menu_theme.mp3',
    ]);
    expect(engine.resolveSources('sfx-ui-click')).toEqual([
      '/assets/audio/sfx/ui_click.ogg',
      '/assets/audio/sfx/ui_click.mp3',
    ]);
    engine.dispose();
  });
});
