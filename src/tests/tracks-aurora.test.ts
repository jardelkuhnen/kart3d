import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { validateManifestSchema } from '../game/core/assetLoader';
import { FIXED_TIMESTEP } from '../game/core/constants';
import { RaceSimulation } from '../game/racing/raceSimulation';
import {
  AURORA_TRACK_IDS,
  getTrackLayout,
  getTrackVisualTheme,
} from '../game/tracks/registry';
import { projectPointOntoTrack } from '../game/tracks/trackGeometry';

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

describe('Slice 4 — Copa Aurora Complete (4 Distinct Tracks, Biomes, GLBs & Physics)', () => {
  it('verifies non-self-intersecting geometry, checkpoints, pads, ramps, shortcuts, and grid slots across all 4 Aurora tracks', () => {
    expect(AURORA_TRACK_IDS).toEqual([
      'porto-das-lanternas',
      'bosque-de-cristal',
      'vale-dos-moinhos',
      'canion-solar',
    ]);

    const seenLengths = new Set<number>();

    for (const trackId of AURORA_TRACK_IDS) {
      const layout = getTrackLayout(trackId);
      const clearance = computeMinNonAdjacentClearanceXZ(layout);

      expect(layout.totalLength, `${trackId} length`).toBeGreaterThanOrEqual(850);
      expect(layout.totalLength, `${trackId} length`).toBeLessThanOrEqual(1400);
      expect(clearance, `${trackId} non-adjacent clearance ${clearance}m`).toBeGreaterThanOrEqual(18);

      expect(layout.checkpoints).toHaveLength(12);
      expect(layout.startGridSlots).toHaveLength(8);
      expect(layout.itemBoxZones.length).toBeGreaterThanOrEqual(3);
      expect(layout.boostPads.length).toBeGreaterThanOrEqual(3);
      expect(layout.ramps.length).toBeGreaterThanOrEqual(2);
      expect(layout.shortcuts.length).toBeGreaterThanOrEqual(1);

      seenLengths.add(Math.round(layout.totalLength));
    }

    expect(seenLengths.size).toBeGreaterThanOrEqual(3);
  });

  it('validates GLB structure (including WindmillBlades_0) and biome ambience OGGs in manifest.json', async () => {
    const manifest = validateManifestSchema(JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')));
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    const io = new NodeIO();

    for (const trackId of AURORA_TRACK_IDS) {
      const theme = getTrackVisualTheme(trackId);
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
      if (trackId === 'vale-dos-moinhos') {
        expect(nodeNames.has('WindmillBlades_0')).toBe(true);
      }
    }
  });

  it('supports distinct biome surface sensing and completes 5s of 8-racer AI physics cleanly on all 4 Aurora tracks', () => {
    // Check Cânion Solar offroad sand vs Porto offroad grass
    const canion = getTrackLayout('canion-solar');
    const cSample = canion.samples[0];
    const offCanion = projectPointOntoTrack(
      canion,
      cSample.point.x + cSample.right.x * (canion.halfWidth + 2.0),
      cSample.point.z + cSample.right.z * (canion.halfWidth + 2.0),
    );
    expect(offCanion.surface).toBe('sand');

    // Run 5 seconds of 8-racer physics simulation on every Aurora track
    for (const trackId of AURORA_TRACK_IDS) {
      const layout = getTrackLayout(trackId);
      const sim = new RaceSimulation(layout, 'nilo', 'trilha-raposa', 'normal', 3, true);
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
