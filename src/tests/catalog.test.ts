import { describe, expect, it } from 'vitest';
import { CHARACTERS, CHARACTERS_BY_ID } from '../data/characters';
import { ITEMS, ITEMS_BY_ID } from '../data/items';
import { KARTS, KARTS_BY_ID, getKartAttributeTotal } from '../data/karts';
import { CUPS, TRACKS, TRACKS_BY_ID, getTracksByCup } from '../data/tracks';

describe('Game Catalogs (Characters, Karts, Tracks, Items)', () => {
  it('defines 8 unique original characters with distinct IDs and valid default karts', () => {
    expect(CHARACTERS).toHaveLength(8);
    expect(Object.keys(CHARACTERS_BY_ID)).toHaveLength(8);
    for (const character of CHARACTERS) {
      expect(KARTS_BY_ID[character.defaultKartId]).toBeDefined();
      expect(character.name.length).toBeGreaterThan(1);
    }
  });

  it('defines 8 competitively balanced karts with distinct attribute profiles', () => {
    expect(KARTS).toHaveLength(8);
    expect(Object.keys(KARTS_BY_ID)).toHaveLength(8);

    const attributeSignatures = new Set<string>();
    for (const kart of KARTS) {
      const total = getKartAttributeTotal(kart.attributes);
      expect(total).toBeGreaterThanOrEqual(54);
      expect(total).toBeLessThanOrEqual(58);
      attributeSignatures.add(JSON.stringify(kart.attributes));
    }
    expect(attributeSignatures.size).toBe(8);
  });

  it('defines 8 unique tracks organized cleanly into Copa Aurora and Copa Eclipse', () => {
    expect(CUPS).toHaveLength(2);
    expect(TRACKS).toHaveLength(8);
    expect(Object.keys(TRACKS_BY_ID)).toHaveLength(8);

    const auroraTracks = getTracksByCup('aurora');
    const eclipseTracks = getTracksByCup('eclipse');
    expect(auroraTracks).toHaveLength(4);
    expect(eclipseTracks).toHaveLength(4);
    expect(auroraTracks.every((t) => t.laps === 3)).toBe(true);
    expect(eclipseTracks.every((t) => t.laps === 3)).toBe(true);
  });

  it('defines 6 original items with valid 8-rank drop weights', () => {
    expect(ITEMS).toHaveLength(6);
    expect(Object.keys(ITEMS_BY_ID)).toHaveLength(6);
    for (const item of ITEMS) {
      expect(item.positionWeights).toHaveLength(8);
      expect(item.durationSeconds).toBeGreaterThan(0);
    }
  });
});
