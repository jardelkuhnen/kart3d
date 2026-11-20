import { describe, expect, it } from 'vitest';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { DEFAULT_SETTINGS } from '../game/core/constants';

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

    // Safe invocation in headless test environment
    expect(() => {
      engine.unlock();
      engine.playSfx('sfx-ui-confirm');
      engine.playMusic('music-race-aurora');
      engine.updateEngineTelemetry(80, true, false, 1, true, false, true);
      engine.dispose();
    }).not.toThrow();
  });
});
