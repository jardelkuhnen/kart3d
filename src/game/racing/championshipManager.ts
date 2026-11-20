import { CHARACTERS, getCharacterById } from '../../data/characters';
import { getTracksByCup } from '../../data/tracks';
import type { CharacterId, CupId, Difficulty, KartId, TrackId } from '../core/types';
import type { StandingEntry } from './raceSimulation';

export interface ChampionshipRacerStanding {
  id: string;
  isPlayer: boolean;
  name: string;
  characterId: CharacterId;
  kartId: KartId;
  primaryColor: string;
  totalPoints: number;
  lastRacePoints: number;
  wins: number;
  rank: number;
}

export interface ChampionshipState {
  cupId: CupId;
  difficulty: Difficulty;
  playerCharacterId: CharacterId;
  playerKartId: KartId;
  trackIds: readonly TrackId[];
  currentRaceIndex: number;
  completedRaces: number;
  standings: ChampionshipRacerStanding[];
  finished: boolean;
}

export function createChampionship(
  cupId: CupId,
  difficulty: Difficulty,
  playerCharacterId: CharacterId,
  playerKartId: KartId,
): ChampionshipState {
  const playerChar = getCharacterById(playerCharacterId);
  const aiChars = CHARACTERS.filter((c) => c.id !== playerChar.id).slice(0, 7);
  const trackIds = getTracksByCup(cupId).map((t) => t.id);

  const standings: ChampionshipRacerStanding[] = [
    {
      id: 'racer-player',
      isPlayer: true,
      name: playerChar.name,
      characterId: playerChar.id,
      kartId: playerKartId,
      primaryColor: playerChar.primaryColor,
      totalPoints: 0,
      lastRacePoints: 0,
      wins: 0,
      rank: 1,
    },
    ...aiChars.map((ai, idx) => ({
      id: `racer-ai-${idx + 1}`,
      isPlayer: false,
      name: ai.name,
      characterId: ai.id,
      kartId: ai.defaultKartId,
      primaryColor: ai.primaryColor,
      totalPoints: 0,
      lastRacePoints: 0,
      wins: 0,
      rank: idx + 2,
    })),
  ];

  return {
    cupId,
    difficulty,
    playerCharacterId,
    playerKartId,
    trackIds,
    currentRaceIndex: 0,
    completedRaces: 0,
    standings,
    finished: false,
  };
}

export function getSortedChampionshipStandings(
  standings: readonly ChampionshipRacerStanding[],
): ChampionshipRacerStanding[] {
  const sorted = [...standings].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

export function recordChampionshipRace(
  state: ChampionshipState,
  raceStandings: readonly StandingEntry[],
): ChampionshipState {
  const byChar = new Map(raceStandings.map((r) => [r.characterId, r]));
  const updated = state.standings.map((entry) => {
    const raceRow = byChar.get(entry.characterId);
    const pts = raceRow?.points ?? 0;
    const won = raceRow?.rank === 1 ? 1 : 0;
    return {
      ...entry,
      totalPoints: entry.totalPoints + pts,
      lastRacePoints: pts,
      wins: entry.wins + won,
    };
  });

  const sorted = getSortedChampionshipStandings(updated);
  const nextCompleted = state.completedRaces + 1;
  const finished = nextCompleted >= state.trackIds.length;

  return {
    ...state,
    standings: sorted,
    completedRaces: nextCompleted,
    currentRaceIndex: finished ? state.trackIds.length - 1 : nextCompleted,
    finished,
  };
}

export function getCupTrophy(rank: number): 'gold' | 'silver' | 'bronze' | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}
