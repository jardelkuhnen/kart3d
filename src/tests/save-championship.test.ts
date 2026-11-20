import { describe, expect, it } from 'vitest';
import { createInitialSaveData } from '../game/core/constants';
import {
  createChampionship,
  getCupTrophy,
  recordChampionshipRace,
} from '../game/racing/championshipManager';
import { RaceSimulation } from '../game/racing/raceSimulation';
import {
  SAVE_STORAGE_KEY,
  applyChampionshipCompletionToSave,
  applyRaceResultToSave,
  isCupUnlocked,
  loadSaveData,
  persistSaveData,
  resetSaveData,
} from '../game/save/saveManager';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';

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

describe('Slice 6 — Save Persistence, Corruption Recovery, Unlocks, Championship & 4 Game Modes', () => {
  it('recovers cleanly from missing, malformed JSON, or incompatible save schema versions', () => {
    const storage = new MemoryStorage();

    // Missing save
    const initial = loadSaveData(storage);
    expect(initial.recoveredFromCorruption).toBe(false);
    expect(initial.data.version).toBe(1);
    expect(initial.data.unlockedCharacters).toEqual(['nilo', 'boro', 'lumi', 'kora']);

    // Corrupted JSON
    storage.setItem(SAVE_STORAGE_KEY, '{not-valid-json');
    const recoveredJson = loadSaveData(storage);
    expect(recoveredJson.recoveredFromCorruption).toBe(true);
    expect(recoveredJson.data.unlockedCharacters).toEqual(['nilo', 'boro', 'lumi', 'kora']);

    // Unsupported version
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ version: 99, foo: 'bar' }));
    const recoveredVersion = loadSaveData(storage);
    expect(recoveredVersion.recoveredFromCorruption).toBe(true);
    expect(recoveredVersion.data.version).toBe(1);

    // Partial/tampered valid v1 merges cleanly & preserves settings
    const modified = {
      ...createInitialSaveData(),
      stats: { ...createInitialSaveData().stats, racesCompleted: 4 },
    };
    persistSaveData(modified, storage);
    const reloaded = loadSaveData(storage);
    expect(reloaded.recoveredFromCorruption).toBe(false);
    expect(reloaded.data.stats.racesCompleted).toBe(4);

    const reset = resetSaveData(storage);
    expect(reset.stats.racesCompleted).toBe(0);
  });

  it('evaluates race, time-trial, drift, and cup podium unlock rules accurately', () => {
    let save = createInitialSaveData();

    // 1. Win Aurora Quick Race -> unlocks Tiko & Chave-Mestra GT + sets best records
    const quickWin = applyRaceResultToSave(save, {
      mode: 'quick-race',
      cupId: 'aurora',
      trackId: 'porto-das-lanternas',
      playerRank: 1,
      totalRaceTimeMs: 92_450,
      bestLapMs: 29_100,
      driftsCompleted: 8,
      turbosTriggered: 9,
      itemsUsed: 4,
    });
    save = quickWin.nextSave;
    expect(save.unlockedCharacters).toContain('tiko');
    expect(save.unlockedKarts).toContain('chave-mestra-gt');
    expect(quickWin.isNewBestRace).toBe(true);
    expect(quickWin.isNewBestLap).toBe(true);

    // 2. Practice mode never mutates career stats or records
    const practiceAttempt = applyRaceResultToSave(save, {
      mode: 'practice',
      cupId: 'aurora',
      trackId: 'porto-das-lanternas',
      playerRank: 1,
      totalRaceTimeMs: 1_000,
      bestLapMs: 500,
      driftsCompleted: 50,
      turbosTriggered: 50,
      itemsUsed: 10,
    });
    expect(practiceAttempt.nextSave.stats.racesCompleted).toBe(1);
    expect(practiceAttempt.nextSave.bestRaceTimesMs['porto-das-lanternas']).toBe(92_450);

    // 3. Time Trial + cumulative 20 drifts + 3 official races -> unlocks Lâmina Glacial, Brisa Corsária, Runi
    const tt = applyRaceResultToSave(save, {
      mode: 'time-trial',
      cupId: 'aurora',
      trackId: 'bosque-de-cristal',
      playerRank: 1,
      totalRaceTimeMs: 88_000,
      bestLapMs: 28_500,
      driftsCompleted: 14,
      turbosTriggered: 12,
      itemsUsed: 0,
    });
    save = tt.nextSave;
    expect(save.unlockedKarts).toContain('lamina-glacial');
    expect(save.unlockedKarts).toContain('brisa-corsaria');

    const thirdRace = applyRaceResultToSave(save, {
      mode: 'quick-race',
      cupId: 'aurora',
      trackId: 'vale-dos-moinhos',
      playerRank: 2,
      totalRaceTimeMs: 95_000,
      bestLapMs: 30_200,
      driftsCompleted: 3,
      turbosTriggered: 4,
      itemsUsed: 2,
    });
    save = thirdRace.nextSave;
    expect(save.unlockedCharacters).toContain('runi');

    // 4. Eclipse cup starts locked in official modes until Aurora podium, open in practice
    expect(isCupUnlocked(save, 'eclipse', 'championship')).toBe(false);
    expect(isCupUnlocked(save, 'eclipse', 'practice')).toBe(true);

    const auroraPodium = applyChampionshipCompletionToSave(save, 'aurora', 2);
    save = auroraPodium.nextSave;
    expect(auroraPodium.trophy).toBe('silver');
    expect(save.unlockedCharacters).toContain('mavi');
    expect(save.unlockedKarts).toContain('escorpiao-dourado');
    expect(isCupUnlocked(save, 'eclipse', 'championship')).toBe(true);

    const eclipseWin = applyChampionshipCompletionToSave(save, 'eclipse', 1);
    expect(eclipseWin.trophy).toBe('gold');
    expect(eclipseWin.nextSave.unlockedCharacters).toContain('zera');
    expect(eclipseWin.nextSave.stats.championshipsWon).toBe(1);
  });

  it('tracks 4-race championship points accurately and distinguishes all 4 RaceSimulation modes', () => {
    let champ = createChampionship('aurora', 'normal', 'nilo', 'trilha-raposa');
    expect(champ.trackIds).toHaveLength(4);
    expect(champ.standings).toHaveLength(8);
    expect(getCupTrophy(1)).toBe('gold');
    expect(getCupTrophy(2)).toBe('silver');
    expect(getCupTrophy(3)).toBe('bronze');
    expect(getCupTrophy(4)).toBeNull();

    // Simulate 4 race standings where player consistently places 1st (+15 pts each = 60 pts)
    for (let raceIdx = 0; raceIdx < 4; raceIdx += 1) {
      const sim = new RaceSimulation(
        PORTO_DAS_LANTERNAS_LAYOUT,
        'nilo',
        'trilha-raposa',
        'normal',
        3,
        true,
        'championship',
      );
      const base = sim.buildHudSnapshot().standings;
      const ordered = [base.find((r) => r.isPlayer)!, ...base.filter((r) => !r.isPlayer)];
      const mockStandings = ordered.map((row, idx) => ({
        ...row,
        rank: idx + 1,
        points: [15, 12, 10, 8, 6, 4, 2, 1][idx],
      }));
      champ = recordChampionshipRace(champ, mockStandings);
    }

    expect(champ.finished).toBe(true);
    expect(champ.completedRaces).toBe(4);
    expect(champ.standings[0].isPlayer).toBe(true);
    expect(champ.standings[0].totalPoints).toBe(60);

    // Compare RaceSimulation across all 4 modes
    const quickSim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
      'quick-race',
    );
    expect(quickSim.racers).toHaveLength(8);
    expect(quickSim.items.boxes.length).toBeGreaterThan(0);

    const ttSim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
      'time-trial',
    );
    expect(ttSim.racers).toHaveLength(1);
    expect(ttSim.items.boxes).toHaveLength(0);
    expect(ttSim.tracker.totalLaps).toBe(3);

    const practiceSim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      'nilo',
      'trilha-raposa',
      'normal',
      3,
      true,
      'practice',
    );
    expect(practiceSim.racers).toHaveLength(1);
    expect(practiceSim.items.boxes.length).toBeGreaterThan(0);
    expect(practiceSim.tracker.totalLaps).toBe(99);
  });
});
