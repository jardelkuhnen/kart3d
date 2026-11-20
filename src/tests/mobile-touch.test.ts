import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateManifestSchema } from '../game/core/assetLoader';
import { DEFAULT_BINDINGS, DEFAULT_SETTINGS, createInitialSaveData } from '../game/core/constants';
import {
  clampCanvasDpr,
  getRecommendedInitialQuality,
  resolveTouchControlsVisible,
} from '../game/core/mobile';
import { InputManager, mergeKartInputs } from '../game/input/inputManager';
import { SAVE_STORAGE_KEY, loadSaveData, persistSaveData } from '../game/save/saveManager';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'assets/manifest.json');

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  public get length(): number {
    return this.store.size;
  }
  public clear(): void {
    this.store.clear();
  }
  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  public key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  public removeItem(key: string): void {
    this.store.delete(key);
  }
  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('Slice 8 — Mobile Support, Multitouch Input, Auto-Accelerate & MP3 Fallbacks', () => {
  it('handles multitouch virtual input, sensitivity clamping, auto-accelerate & brake override', () => {
    const manager = new InputManager(DEFAULT_BINDINGS, 1.0, 0.14);

    // Concurrent touch actions: steer left + hold drift + trigger item
    manager.setVirtualInput({ steer: -0.75, drift: true, useItem: true });
    manager.setAutoAccelerate(true);

    let frame = manager.poll();
    expect(frame.anyKeyActive).toBe(true);
    expect(frame.kart.steer).toBeCloseTo(-0.75, 5);
    expect(frame.kart.throttle).toBe(1);
    expect(frame.kart.brake).toBe(0);
    expect(frame.kart.drift).toBe(true);
    expect(frame.kart.useItem).toBe(true);

    // Holding brake suppresses auto-accelerate cleanly
    manager.setVirtualInput({ brake: 1, useItem: false });
    frame = manager.poll();
    expect(frame.kart.brake).toBe(1);
    expect(frame.kart.throttle).toBe(0);
    expect(frame.kart.drift).toBe(true);

    // Steering clamps cleanly above 1.0 and resets on resetVirtualInput()
    manager.updateConfig(DEFAULT_BINDINGS, 1.5, 0.14);
    manager.setVirtualInput({ steer: 0.9 });
    expect(manager.pollKartOnly().steer).toBe(1);

    manager.resetVirtualInput();
    manager.setAutoAccelerate(false);
    const cleared = manager.poll();
    expect(cleared.anyKeyActive).toBe(false);
    expect(cleared.kart.steer).toBe(0);
    expect(cleared.kart.brake).toBe(0);
    expect(cleared.kart.drift).toBe(false);

    // Direct merge helper combines keyboard/gamepad/virtual touch inputs cleanly
    const merged = mergeKartInputs(
      { throttle: 0, brake: 0, steer: 0.3, drift: false, useItem: false, recover: false },
      { throttle: 0, brake: 0, steer: 0, drift: false, useItem: true, recover: false },
      { steer: -0.8, throttle: 0, brake: 0, drift: true, useItem: false, recover: true },
      1.0,
      true,
    );
    expect(merged.steer).toBeCloseTo(-0.8, 5);
    expect(merged.throttle).toBe(1);
    expect(merged.drift).toBe(true);
    expect(merged.useItem).toBe(true);
    expect(merged.recover).toBe(true);
  });

  it('caps mobile DPR <= 1.5, recommends low preset on mobile, and resolves touch visibility modes', () => {
    expect(getRecommendedInitialQuality(true)).toBe('low');
    expect(getRecommendedInitialQuality(false)).toBe('high');

    expect(clampCanvasDpr([1, 2], true)).toEqual([1, 1.5]);
    expect(clampCanvasDpr([1.6, 2.2], true)).toEqual([1.5, 1.5]);
    expect(clampCanvasDpr([1, 1], true)).toEqual([1, 1]);

    expect(resolveTouchControlsVisible('auto', true)).toBe(true);
    expect(resolveTouchControlsVisible('auto', false)).toBe(false);
    expect(resolveTouchControlsVisible('on', false)).toBe(true);
    expect(resolveTouchControlsVisible('off', true)).toBe(false);
  });

  it('defaults mobile initial save to low quality & migrates legacy v1 saves missing touch config', () => {
    const storage = new MemoryStorage();
    const mobileFresh = loadSaveData(storage, true);
    expect(mobileFresh.recoveredFromCorruption).toBe(false);
    expect(mobileFresh.data.settings.quality).toBe('low');
    expect(mobileFresh.data.settings.touch).toEqual({ mode: 'auto', autoAccelerate: true });

    // Legacy v1 save without touch block should migrate without triggering corruption notice
    const legacy = createInitialSaveData();
    const { touch: _removed, ...legacySettings } = DEFAULT_SETTINGS;
    void _removed;
    persistSaveData(
      {
        ...legacy,
        settings: legacySettings as typeof DEFAULT_SETTINGS,
      },
      storage,
    );
    const rawWithoutTouch = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as Record<string, unknown>;
    delete (rawWithoutTouch.settings as Record<string, unknown>).touch;
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(rawWithoutTouch));

    const migrated = loadSaveData(storage, false);
    expect(migrated.recoveredFromCorruption).toBe(false);
    expect(migrated.data.settings.touch).toEqual({ mode: 'auto', autoAccelerate: true });
  });

  it('bundles validated .mp3 iOS/Safari fallbacks on disk for every .ogg audio asset', async () => {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const manifest = validateManifestSchema(JSON.parse(raw));
    const byId = new Map(manifest.assets.map((entry) => [entry.id, entry]));

    const oggAudioEntries = manifest.assets.filter(
      (entry) =>
        (entry.type === 'audio-music' || entry.type === 'audio-sfx') && entry.format === 'ogg',
    );
    expect(oggAudioEntries.length).toBe(26);

    for (const oggEntry of oggAudioEntries) {
      const mp3Entry = byId.get(`${oggEntry.id}-mp3`);
      expect(mp3Entry).toBeDefined();
      expect(mp3Entry?.format).toBe('mp3');
      expect(mp3Entry?.path).toBe(oggEntry.path.replace(/\.ogg$/, '.mp3'));
      expect(mp3Entry?.validationStatus).toBe('validated');

      const mp3Disk = path.join(PUBLIC_DIR, mp3Entry!.path.replace(/^\/+/, ''));
      const bytes = await fs.readFile(mp3Disk);
      const hasId3 = bytes.subarray(0, 3).toString('ascii') === 'ID3';
      const hasMpegSync = bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0;
      expect(hasId3 || hasMpegSync).toBe(true);
    }
  });
});
