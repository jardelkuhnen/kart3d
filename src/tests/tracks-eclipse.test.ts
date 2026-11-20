import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { validateManifestSchema } from '../game/core/assetLoader';
import { FIXED_TIMESTEP } from '../game/core/constants';
import { RaceSimulation } from '../game/racing/raceSimulation';
import {
  ECLIPSE_TRACK_IDS,
  getTrackLayout,
  getTrackVisualTheme,
} from '../game/tracks/registry';
import {
  evaluateMovingHazardPos,
  getSampleAtDistance,
  projectPointOntoTrack,
} from '../game/tracks/trackGeometry';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'assets/manifest.json');

function computeMinNonAdjacentClearanceXZ(
  layout: ReturnType<typeof getTrackLayout>,
): number {
  const samples = layout.samples;
  const n = samples.length;
  let minDist = Infinity;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const idxDelta = Math.min(j - i, n - (j - i));
      if (idxDelta < Math.round(n * 0.12)) continue;
      const distXZ = Math.hypot(
        samples[i].point.x - samples[j].point.x,
        samples[i].point.z - samples[j].point.z,
      );
      if (distXZ < minDist) minDist = distXZ;
    }
  }
  return minDist;
}

describe('Slice 5 — Copa Eclipse Complete (4 Tracks, Ice Surface, Moving Hazards & Physics)', () => {
  it('verifies non-self-intersecting geometry, checkpoints, pads, ramps, shortcuts, and start slots across all 4 Eclipse tracks', () => {
    expect(ECLIPSE_TRACK_IDS).toEqual([
      'cidade-neon',
      'pico-boreal',
      'jardim-celeste',
      'fortaleza-tempestade',
    ]);

    for (const trackId of ECLIPSE_TRACK_IDS) {
      const layout = getTrackLayout(trackId);
      const clearance = computeMinNonAdjacentClearanceXZ(layout);

      expect(layout.totalLength, `${trackId} length`).toBeGreaterThanOrEqual(850);
      expect(layout.totalLength, `${trackId} length`).toBeLessThanOrEqual(1450);
      expect(clearance, `${trackId} non-adjacent clearance ${clearance}m`).toBeGreaterThanOrEqual(18);

      expect(layout.checkpoints).toHaveLength(12);
      expect(layout.startGridSlots).toHaveLength(8);
      expect(layout.itemBoxZones.length).toBeGreaterThanOrEqual(3);
      expect(layout.boostPads.length).toBeGreaterThanOrEqual(3);
      expect(layout.ramps.length).toBeGreaterThanOrEqual(2);
      expect(layout.shortcuts.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('validates all 4 Eclipse GLBs, Eclipse music, and 4 biome ambience OGGs in manifest.json', async () => {
    const manifest = validateManifestSchema(JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')));
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    const io = new NodeIO();

    for (const trackId of ECLIPSE_TRACK_IDS) {
      const theme = getTrackVisualTheme(trackId);
      expect(theme.musicAssetId).toBe('music-race-eclipse');
      expect(byId.get(theme.musicAssetId)?.validationStatus).toBe('validated');
      expect(byId.get(theme.ambienceAssetId)?.validationStatus).toBe('validated');

      const glbEntry = byId.get(`track-${trackId}`);
      expect(glbEntry?.validationStatus).toBe('validated');

      const raw = await fs.readFile(path.join(PUBLIC_DIR, glbEntry!.path.replace(/^\/+/, '')));
      const doc = await io.readBinary(new Uint8Array(raw));
      const nodeNames = new Set(doc.getRoot().listNodes().map((n) => n.getName()));

      expect(nodeNames.has('TrackRoot')).toBe(true);
      expect(nodeNames.has('MainRoadMesh')).toBe(true);
      expect(nodeNames.has('TrackStartGantry')).toBe(true);
      expect(nodeNames.has('SceneryGroup')).toBe(true);
    }
  });

  it('detects icy road surface on Pico Boreal and triggers moving hazard hits on Cidade Neon / Fortaleza Tempestade', () => {
    const boreal = getTrackLayout('pico-boreal');
    const iceZoneSample = getSampleAtDistance(
      boreal.samples,
      boreal.totalLength,
      boreal.totalLength * 0.24,
    );
    const iceQuery = projectPointOntoTrack(boreal, iceZoneSample.point.x, iceZoneSample.point.z);
    expect(iceQuery.surface).toBe('ice');

    // Moving hazard oscillates laterally across the road and collides cleanly
    const neon = getTrackLayout('cidade-neon');
    expect(neon.movingHazards.length).toBeGreaterThanOrEqual(2);
    const p0 = evaluateMovingHazardPos(neon.movingHazards[0], 0);
    const p1 = evaluateMovingHazardPos(neon.movingHazards[0], 0.8);
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(1.0);

    const fortaleza = getTrackLayout('fortaleza-tempestade');
    expect(fortaleza.movingHazards.length).toBeGreaterThanOrEqual(2);

    const sim = new RaceSimulation(fortaleza, 'nilo', 'trilha-raposa', 'normal', 3, true);
    sim.tracker.phase = 'racing';
    const hazardPos = evaluateMovingHazardPos(
      fortaleza.movingHazards[0],
      sim.tracker.raceElapsedMs * 0.001,
    );
    sim.racers[0].sim.x = hazardPos.x;
    sim.racers[0].sim.y = hazardPos.y;
    sim.racers[0].sim.z = hazardPos.z;
    sim.racers[0].sim.forwardSpeed = 24;

    const events = sim.step(FIXED_TIMESTEP, {
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
      useItem: false,
      recover: false,
    });
    expect(events.playerCollision).toBe(true);
    expect(sim.racers[0].sim.hitTimer).toBeGreaterThan(0.5);
  });

  it('runs 5 seconds of 8-racer AI physics cleanly across all 4 Eclipse tracks', () => {
    for (const trackId of ECLIPSE_TRACK_IDS) {
      const layout = getTrackLayout(trackId);
      const sim = new RaceSimulation(layout, 'zera', 'lamina-glacial', 'normal', 3, true);
      sim.tracker.phase = 'racing';
      const starts = sim.racers.map((r) => ({ x: r.sim.x, z: r.sim.z }));

      for (let i = 0; i < 300; i += 1) {
        sim.step(FIXED_TIMESTEP, {
          throttle: 0.72,
          brake: 0,
          steer: 0,
          drift: false,
          useItem: false,
          recover: false,
        });
      }

      for (let idx = 0; idx < sim.racers.length; idx += 1) {
        const racer = sim.racers[idx];
        expect(Number.isFinite(racer.sim.x)).toBe(true);
        expect(Number.isFinite(racer.sim.z)).toBe(true);
        const moved = Math.hypot(racer.sim.x - starts[idx].x, racer.sim.z - starts[idx].z);
        expect(moved, `${trackId} racer ${idx} moved ${moved}m`).toBeGreaterThan(35);
      }
    }
  });
});
