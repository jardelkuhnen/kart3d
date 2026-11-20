import { Howl, Howler } from 'howler';
import { resolveAssetPath } from '../core/assetLoader';
import type { AssetManifest, AudioSettings } from '../core/types';

export type MusicTrackId =
  | 'music-menu'
  | 'music-race-aurora'
  | 'music-race-eclipse'
  | 'music-victory'
  | 'music-defeat';

export type SfxId =
  | 'sfx-ui-click'
  | 'sfx-ui-confirm'
  | 'sfx-countdown-beep'
  | 'sfx-countdown-go'
  | 'sfx-drift-spark'
  | 'sfx-turbo-boost'
  | 'sfx-collision-hit'
  | 'sfx-jump-launch'
  | 'sfx-land-thud'
  | 'sfx-item-pickup'
  | 'sfx-item-use'
  | 'sfx-lap-complete'
  | 'sfx-race-finish';

export type AmbienceId =
  | 'sfx-ambience-coastal'
  | 'sfx-ambience-forest'
  | 'sfx-ambience-valley'
  | 'sfx-ambience-canyon'
  | 'sfx-ambience-neon'
  | 'sfx-ambience-boreal'
  | 'sfx-ambience-sky'
  | 'sfx-ambience-storm';

interface EngineSynthNodes {
  ctx: AudioContext;
  ownsContext: boolean;
  oscMain: OscillatorNode;
  oscHarmonic: OscillatorNode;
  noiseSrc: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  engineGain: GainNode;
  driftFilter: BiquadFilterNode;
  driftGain: GainNode;
}

export class GameAudioEngine {
  private manifest: AssetManifest | null = null;
  private settings: AudioSettings;
  private readonly sfxPool = new Map<string, Howl>();
  private activeMusic: { id: MusicTrackId; howl: Howl } | null = null;
  private activeAmbience: { id: AmbienceId; howl: Howl } | null = null;
  private engineNodes: EngineSynthNodes | null = null;
  private unlocked = false;
  private disposed = false;

  constructor(initialSettings: AudioSettings) {
    this.settings = { ...initialSettings };
  }

  public setManifest(manifest: AssetManifest | null): void {
    this.manifest = manifest;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public getEffectiveChannelVolume(channel: 'music' | 'sfx' | 'ambient'): number {
    if (this.settings.muted) return 0;
    switch (channel) {
      case 'music':
        return Math.max(0, Math.min(1, this.settings.musicVolume));
      case 'sfx':
        return Math.max(0, Math.min(1, this.settings.sfxVolume));
      case 'ambient':
        return Math.max(0, Math.min(1, this.settings.ambientVolume));
    }
  }

  public applySettings(next: AudioSettings): void {
    this.settings = { ...next };
    try {
      Howler.mute(this.settings.muted);
    } catch {
      // Ignore in headless/non-DOM environments
    }

    if (this.activeMusic) {
      this.activeMusic.howl.volume(this.getEffectiveChannelVolume('music') * 0.65);
    }
    if (this.activeAmbience) {
      this.activeAmbience.howl.volume(this.getEffectiveChannelVolume('ambient') * 0.55);
    }
    if (this.engineNodes && this.settings.muted) {
      const now = this.engineNodes.ctx.currentTime;
      this.engineNodes.engineGain.gain.setTargetAtTime(0, now, 0.04);
      this.engineNodes.driftGain.gain.setTargetAtTime(0, now, 0.04);
    }
  }

  public unlock(): void {
    if (this.disposed || this.unlocked) return;
    this.unlocked = true;

    try {
      // Engine synth creates its own AudioContext isolated from Howler's internal _unlockAudio()
      this.ensureEngineSynth();
    } catch {
      // Web Audio unavailable in pure test environment
    }
  }

  private ensureEngineSynth(): void {
    if (this.engineNodes || typeof window === 'undefined') return;
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;

    const ownsContext = true;
    const ctx = new AudioCtxCtor();
    if (ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sawtooth';
    oscMain.frequency.value = 62;

    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.value = 124;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 2.2;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    oscMain.connect(filter);
    oscHarmonic.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);

    oscMain.start();
    oscHarmonic.start();

    // Filtered noise buffer for tire drift screech
    const bufferLen = Math.floor(ctx.sampleRate * 1.0);
    const noiseBuf = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferLen; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const driftFilter = ctx.createBiquadFilter();
    driftFilter.type = 'bandpass';
    driftFilter.frequency.value = 1150;
    driftFilter.Q.value = 3.5;

    const driftGain = ctx.createGain();
    driftGain.gain.value = 0;

    noiseSrc.connect(driftFilter);
    driftFilter.connect(driftGain);
    driftGain.connect(ctx.destination);
    noiseSrc.start();

    this.engineNodes = {
      ctx,
      ownsContext,
      oscMain,
      oscHarmonic,
      noiseSrc,
      filter,
      engineGain,
      driftFilter,
      driftGain,
    };
  }

  private resolveSrc(id: string): string | null {
    if (!this.manifest) return null;
    try {
      return resolveAssetPath(this.manifest, id);
    } catch {
      return null;
    }
  }

  public playSfx(id: SfxId, rate = 1.0): void {
    if (this.disposed || this.settings.muted || typeof window === 'undefined') return;
    const src = this.resolveSrc(id);
    if (!src) return;

    try {
      let howl = this.sfxPool.get(id);
      if (!howl) {
        howl = new Howl({ src: [src], preload: true });
        this.sfxPool.set(id, howl);
      }
      const vol = this.getEffectiveChannelVolume('sfx') * 0.8;
      if (vol <= 0.001) return;
      howl.volume(vol);
      howl.rate(rate);
      howl.play();
    } catch {
      // Safe fallback in environments without audio output
    }
  }

  public playMusic(id: MusicTrackId, loop = true): void {
    if (this.disposed || typeof window === 'undefined') return;
    if (this.activeMusic?.id === id && this.activeMusic.howl.playing()) return;

    this.stopMusic();
    const src = this.resolveSrc(id);
    if (!src) return;

    try {
      const howl = new Howl({
        src: [src],
        loop,
        volume: this.getEffectiveChannelVolume('music') * 0.65,
      });
      this.activeMusic = { id, howl };
      howl.play();
    } catch {
      // Safe fallback
    }
  }

  public stopMusic(): void {
    if (!this.activeMusic) return;
    try {
      this.activeMusic.howl.stop();
      this.activeMusic.howl.unload();
    } catch {
      // Ignore cleanup errors
    }
    this.activeMusic = null;
  }

  public playAmbience(id: AmbienceId): void {
    if (this.disposed || typeof window === 'undefined') return;
    if (this.activeAmbience?.id === id && this.activeAmbience.howl.playing()) return;

    this.stopAmbience();
    const src = this.resolveSrc(id);
    if (!src) return;

    try {
      const howl = new Howl({
        src: [src],
        loop: true,
        volume: this.getEffectiveChannelVolume('ambient') * 0.55,
      });
      this.activeAmbience = { id, howl };
      howl.play();
    } catch {
      // Safe fallback
    }
  }

  public stopAmbience(): void {
    if (!this.activeAmbience) return;
    try {
      this.activeAmbience.howl.stop();
      this.activeAmbience.howl.unload();
    } catch {
      // Ignore cleanup errors
    }
    this.activeAmbience = null;
  }

  public updateEngineTelemetry(
    speedKmh: number,
    throttle: boolean,
    braking: boolean,
    driftTier: 0 | 1 | 2 | 3,
    driftActive: boolean,
    boostActive: boolean,
    active = true,
  ): void {
    if (this.disposed || !this.engineNodes) return;
    const { ctx, oscMain, oscHarmonic, filter, engineGain, driftFilter, driftGain } =
      this.engineNodes;
    const now = ctx.currentTime;
    const sfxVol = this.getEffectiveChannelVolume('sfx');

    if (!active || sfxVol <= 0.001) {
      engineGain.gain.setTargetAtTime(0, now, 0.05);
      driftGain.gain.setTargetAtTime(0, now, 0.04);
      return;
    }

    const speedRatio = Math.min(1.3, Math.max(0, speedKmh / 135));
    const baseFreq = 58 + speedRatio * 145 + (boostActive ? 34 : 0) + (braking ? -12 : 0);
    oscMain.frequency.setTargetAtTime(Math.max(45, baseFreq), now, 0.04);
    oscHarmonic.frequency.setTargetAtTime(Math.max(90, baseFreq * 2.02), now, 0.04);
    filter.frequency.setTargetAtTime(320 + speedRatio * 950 + (throttle ? 240 : 0), now, 0.05);

    const targetEngineGain = sfxVol * (0.04 + (throttle ? 0.035 : 0.01) + speedRatio * 0.025);
    engineGain.gain.setTargetAtTime(targetEngineGain, now, 0.05);

    if (driftActive && speedKmh > 25) {
      const tierFreq = 980 + driftTier * 320;
      driftFilter.frequency.setTargetAtTime(tierFreq, now, 0.04);
      driftGain.gain.setTargetAtTime(sfxVol * (0.045 + driftTier * 0.015), now, 0.04);
    } else {
      driftGain.gain.setTargetAtTime(0, now, 0.04);
    }
  }

  public stopRaceAudio(): void {
    this.stopMusic();
    this.stopAmbience();
    if (this.engineNodes) {
      const now = this.engineNodes.ctx.currentTime;
      this.engineNodes.engineGain.gain.setTargetAtTime(0, now, 0.03);
      this.engineNodes.driftGain.gain.setTargetAtTime(0, now, 0.03);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stopRaceAudio();
    for (const howl of this.sfxPool.values()) {
      try {
        howl.unload();
      } catch {
        // Ignore
      }
    }
    this.sfxPool.clear();
    if (this.engineNodes) {
      try {
        this.engineNodes.oscMain.stop();
        this.engineNodes.oscHarmonic.stop();
        this.engineNodes.noiseSrc.stop();
        this.engineNodes.engineGain.disconnect();
        this.engineNodes.driftGain.disconnect();
        if (this.engineNodes.ownsContext && this.engineNodes.ctx.state !== 'closed') {
          void this.engineNodes.ctx.close();
        }
      } catch {
        // Ignore
      }
      this.engineNodes = null;
    }
  }
}
