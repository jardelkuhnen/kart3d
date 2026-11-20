import { useGameStore } from '../../app/store';
import { CHARACTERS, getCharacterById } from '../../data/characters';
import { KARTS, getKartById } from '../../data/karts';
import { CUPS, getTracksByCup } from '../../data/tracks';
import { resolveAssetPath } from '../../game/core/assetLoader';
import { publicUrl } from '../../game/core/publicUrl';
import { DIFFICULTY_CONFIG, SURFACE_PROPERTIES } from '../../game/core/constants';
import type { Difficulty, KartAttributes } from '../../game/core/types';
import { formatDrivingBindingsSummary } from '../../game/input/keyLabels';
import { formatRaceTimeMs } from '../../game/racing/raceManager';
import { isCupUnlocked } from '../../game/save/saveManager';

const STAT_ROWS: Array<{ key: keyof KartAttributes; label: string }> = [
  { key: 'topSpeed', label: 'Velocidade' },
  { key: 'acceleration', label: 'Aceleração' },
  { key: 'braking', label: 'Frenagem' },
  { key: 'handling', label: 'Curva' },
  { key: 'grip', label: 'Aderência' },
  { key: 'mass', label: 'Massa' },
  { key: 'driftEfficiency', label: 'Drift' },
  { key: 'recovery', label: 'Recuperação' },
];

export function CharacterSelectScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const manifest = useGameStore((s) => s.manifest);
  const mode = useGameStore((s) => s.mode);
  const saveData = useGameStore((s) => s.saveData);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const setSelectedCharacterId = useGameStore((s) => s.setSelectedCharacterId);
  const setScreen = useGameStore((s) => s.setScreen);

  const selected = getCharacterById(selectedCharacterId);
  const unlockedAll = mode === 'practice';

  return (
    <section className="kl-showcase-overlay" aria-label="Seleção de Personagem">
      <div className="kl-panel kl-showcase-sidebar">
        <span className="kl-brand-badge">ETAPA 2 · GARAGEM 3D</span>
        <h2 className="kl-title">Escolha o Piloto</h2>
        <p className="kl-subtitle">
          <strong>{selected.name}</strong> — {selected.title}
        </p>

        <div className="kl-char-grid">
          {CHARACTERS.map((char) => {
            const unlocked = unlockedAll || saveData.unlockedCharacters.includes(char.id);
            const active = char.id === selectedCharacterId;
            const portraitPath = manifest
              ? resolveAssetPath(manifest, char.portraitAssetId)
              : publicUrl(`/assets/ui/portrait_${char.id}.png`);
            return (
              <button
                key={char.id}
                type="button"
                className={`kl-char-btn ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
                aria-pressed={active}
                disabled={!unlocked}
                title={unlocked ? char.name : char.unlockRequirementLabel}
                data-testid={`char-option-${char.id}`}
                onClick={() => {
                  onPlaySfx('click');
                  setSelectedCharacterId(char.id);
                }}
              >
                <img
                  src={portraitPath}
                  alt={char.name}
                  className="kl-char-thumb"
                  width={40}
                  height={40}
                />
                <span className="kl-char-btn-name">
                  {unlocked ? char.name : `${char.name} 🔒`}
                </span>
              </button>
            );
          })}
        </div>

        <p className="kl-garage-note">{selected.bio}</p>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              setScreen('mode-select');
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            className="kl-btn"
            data-testid="next-to-kart"
            onClick={() => {
              onPlaySfx('confirm');
              setScreen('kart-select');
            }}
          >
            Escolher Kart
          </button>
        </div>
      </div>
    </section>
  );
}

export function KartSelectScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const mode = useGameStore((s) => s.mode);
  const saveData = useGameStore((s) => s.saveData);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const setSelectedKartId = useGameStore((s) => s.setSelectedKartId);
  const setScreen = useGameStore((s) => s.setScreen);

  const char = getCharacterById(selectedCharacterId);
  const selected = getKartById(selectedKartId);
  const unlockedAll = mode === 'practice';

  return (
    <section className="kl-showcase-overlay" aria-label="Seleção de Kart">
      <div className="kl-panel kl-showcase-sidebar">
        <span className="kl-brand-badge">ETAPA 3 · OFICINA 3D</span>
        <h2 className="kl-title">Escolha o Kart</h2>
        <p className="kl-subtitle">
          <strong>{selected.name}</strong> — {selected.archetype}
        </p>

        <div className="kl-kart-grid">
          {KARTS.map((kart) => {
            const unlocked = unlockedAll || saveData.unlockedKarts.includes(kart.id);
            const active = kart.id === selectedKartId;
            return (
              <button
                key={kart.id}
                type="button"
                className={`kl-kart-btn ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
                aria-pressed={active}
                disabled={!unlocked}
                title={unlocked ? kart.name : kart.unlockRequirementLabel}
                data-testid={`kart-option-${kart.id}`}
                onClick={() => {
                  onPlaySfx('click');
                  setSelectedKartId(kart.id);
                }}
              >
                <span
                  className="kl-kart-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${kart.primaryColor}, ${kart.trimColor})`,
                  }}
                  aria-hidden="true"
                />
                <span className="kl-kart-btn-name">
                  {unlocked ? kart.name : `${kart.name} 🔒`}
                </span>
              </button>
            );
          })}
        </div>

        <p className="kl-garage-note">{selected.description}</p>

        <div className="kl-stats-mini-grid" aria-label="Atributos Combinados">
          {STAT_ROWS.map(({ key, label }) => {
            const bonus = char.statBonuses[key] ?? 0;
            const value = Math.min(10, selected.attributes[key] + bonus);
            return (
              <div key={key} className="kl-stat-mini">
                <div className="kl-stat-mini-top">
                  <span>{label}</span>
                  <span>
                    {value}/10{bonus > 0 ? ` (+${bonus})` : ''}
                  </span>
                </div>
                <div className="kl-stat-mini-bar">
                  <div className="kl-stat-mini-fill" style={{ width: `${value * 10}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              setScreen('character-select');
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            className="kl-btn"
            data-testid="next-to-cup"
            onClick={() => {
              onPlaySfx('confirm');
              setScreen('cup-select');
            }}
          >
            Escolher Copa
          </button>
        </div>
      </div>
    </section>
  );
}

const TROPHY_LABELS: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: 'Troféu de Ouro',
  silver: 'Troféu de Prata',
  bronze: 'Troféu de Bronze',
};

export function CupSelectScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const mode = useGameStore((s) => s.mode);
  const saveData = useGameStore((s) => s.saveData);
  const selectedCupId = useGameStore((s) => s.selectedCupId);
  const setSelectedCupId = useGameStore((s) => s.setSelectedCupId);
  const setSelectedTrackId = useGameStore((s) => s.setSelectedTrackId);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <section className="kl-screen-center" aria-label="Seleção de Copa">
      <div className="kl-panel kl-wide-card">
        <span className="kl-brand-badge">ETAPA 4 · COPAS</span>
        <h2 className="kl-title">Escolha a Copa</h2>
        <p className="kl-subtitle">
          {mode === 'practice'
            ? 'No modo Treino todas as copas e pistas estão abertas.'
            : 'Alcance o pódio na Copa Aurora para liberar a Copa Eclipse.'}
        </p>

        <div className="kl-cup-grid">
          {CUPS.map((cup) => {
            const unlocked = isCupUnlocked(saveData, cup.id, mode);
            const active = cup.id === selectedCupId;
            const trophy = saveData.cupTrophies[cup.id];
            const tracks = getTracksByCup(cup.id);
            return (
              <button
                key={cup.id}
                type="button"
                className={`kl-cup-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
                aria-pressed={active}
                disabled={!unlocked}
                data-testid={`cup-tab-${cup.id}`}
                onClick={() => {
                  onPlaySfx('click');
                  setSelectedCupId(cup.id);
                  if (tracks[0]) setSelectedTrackId(tracks[0].id);
                }}
              >
                <div className="kl-cup-card-head">
                  <strong>{cup.name}</strong>
                  <span className="kl-cup-status">
                    {!unlocked
                      ? '🔒 Bloqueada'
                      : trophy
                        ? TROPHY_LABELS[trophy]
                        : 'Disponível'}
                  </span>
                </div>
                <p className="kl-cup-sub">{cup.subtitle}</p>
                <ul className="kl-cup-track-list">
                  {tracks.map((tr) => (
                    <li key={tr.id}>
                      {tr.cupOrder}. {tr.name}
                    </li>
                  ))}
                </ul>
                {!unlocked && <span className="kl-unlock-hint">{cup.unlockRequirementLabel}</span>}
              </button>
            );
          })}
        </div>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              setScreen('kart-select');
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            className="kl-btn"
            data-testid="next-to-track"
            onClick={() => {
              onPlaySfx('confirm');
              setScreen('track-select');
            }}
          >
            Avançar
          </button>
        </div>
      </div>
    </section>
  );
}

export function TrackSelectScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const mode = useGameStore((s) => s.mode);
  const saveData = useGameStore((s) => s.saveData);
  const selectedCupId = useGameStore((s) => s.selectedCupId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);
  const setSelectedCupId = useGameStore((s) => s.setSelectedCupId);
  const setSelectedTrackId = useGameStore((s) => s.setSelectedTrackId);
  const setScreen = useGameStore((s) => s.setScreen);

  const tracks = getTracksByCup(selectedCupId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId) ?? tracks[0];

  return (
    <section className="kl-screen-center" aria-label="Seleção de Pista">
      <div className="kl-panel kl-wide-card">
        <span className="kl-brand-badge">
          {mode === 'championship' ? 'ETAPA 5 · ORDEM DA COPA' : 'ETAPA 5 · CIRCUITOS'}
        </span>
        <h2 className="kl-title">
          {mode === 'championship' ? 'Circuitos do Campeonato' : 'Escolha a Pista'}
        </h2>

        <div className="kl-cup-tabs" role="group" aria-label="Alternar Copa">
          {CUPS.map((cup) => {
            const unlocked = isCupUnlocked(saveData, cup.id, mode);
            const active = cup.id === selectedCupId;
            return (
              <button
                key={cup.id}
                type="button"
                className={`kl-cup-tab ${active ? 'active' : ''}`}
                disabled={!unlocked}
                aria-pressed={active}
                data-testid={`track-cup-tab-${cup.id}`}
                onClick={() => {
                  onPlaySfx('click');
                  setSelectedCupId(cup.id);
                  const cupList = getTracksByCup(cup.id);
                  if (cupList[0]) setSelectedTrackId(cupList[0].id);
                }}
              >
                {unlocked ? cup.name : `${cup.name} 🔒`}
              </button>
            );
          })}
        </div>

        <div className="kl-track-cards-grid">
          {tracks.map((tr) => {
            const unlocked = mode === 'practice' || saveData.unlockedTracks.includes(tr.id);
            const active = tr.id === selectedTrackId;
            const bestRace = saveData.bestRaceTimesMs[tr.id];
            const bestLap = saveData.bestLapTimesMs[tr.id];
            return (
              <button
                key={tr.id}
                type="button"
                className={`kl-track-card ${active ? 'active' : ''}`}
                aria-pressed={active}
                disabled={!unlocked}
                data-testid={`track-option-${tr.id}`}
                onClick={() => {
                  onPlaySfx('click');
                  setSelectedTrackId(tr.id);
                }}
              >
                <div className="kl-track-card-top">
                  <strong>
                    {tr.cupOrder}. {tr.name}
                  </strong>
                  <span>{'★'.repeat(tr.difficultyRating)}</span>
                </div>
                <span className="kl-track-btn-theme">{tr.theme}</span>
                <p className="kl-track-card-desc">{tr.description}</p>
                <div className="kl-track-records">
                  <span>Melhor Total: {bestRace ? formatRaceTimeMs(bestRace) : '--'}</span>
                  <span>Melhor Volta: {bestLap ? formatRaceTimeMs(bestLap) : '--'}</span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="kl-subtitle">
          Selecionada: <strong>{currentTrack?.name}</strong> — Superfícies:{' '}
          {currentTrack?.availableSurfaces.map((s) => SURFACE_PROPERTIES[s].label).join(', ')}
        </p>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              setScreen('cup-select');
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            className="kl-btn"
            data-testid="next-to-difficulty"
            onClick={() => {
              onPlaySfx('confirm');
              setScreen('difficulty-select');
            }}
          >
            Configurar Largada
          </button>
        </div>
      </div>
    </section>
  );
}

export function DifficultySelectScreen({
  onPlaySfx,
  onStartRace,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
  onStartRace: () => void;
}) {
  const mode = useGameStore((s) => s.mode);
  const difficulty = useGameStore((s) => s.difficulty);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const selectedCupId = useGameStore((s) => s.selectedCupId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);
  const bindings = useGameStore((s) => s.settings.bindings);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setScreen = useGameStore((s) => s.setScreen);
  const startNewChampionship = useGameStore((s) => s.startNewChampionship);

  const char = getCharacterById(selectedCharacterId);
  const kart = getKartById(selectedKartId);
  const cup = CUPS.find((c) => c.id === selectedCupId);
  const tracks = getTracksByCup(selectedCupId);
  const track = tracks.find((t) => t.id === selectedTrackId) ?? tracks[0];
  const isSolo = mode === 'time-trial' || mode === 'practice';
  const keySummary = formatDrivingBindingsSummary(bindings);

  return (
    <section className="kl-screen-center" aria-label="Configuração de Dificuldade">
      <div className="kl-panel kl-menu-card">
        <span className="kl-brand-badge">ETAPA FINAL · LARGADA</span>
        <h2 className="kl-title">Preparar Corrida</h2>

        <div className="kl-summary-box">
          <div>
            <strong>Modo:</strong>{' '}
            {mode === 'quick-race'
              ? 'Corrida Rápida'
              : mode === 'championship'
                ? 'Campeonato'
                : mode === 'time-trial'
                  ? 'Contrarrelógio'
                  : 'Treino Livre'}
          </div>
          <div>
            <strong>{mode === 'championship' ? 'Copa:' : 'Pista:'}</strong>{' '}
            {mode === 'championship' ? `${cup?.name} (4 Etapas)` : track.name}
          </div>
          <div>
            <strong>Piloto & Kart:</strong> {char.name} · {kart.name}
          </div>
        </div>

        {!isSolo ? (
          <>
            <div className="kl-difficulty-group" role="group" aria-label="Dificuldade da IA">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`kl-diff-pill ${difficulty === level ? 'active' : ''}`}
                  aria-pressed={difficulty === level}
                  onClick={() => {
                    onPlaySfx('click');
                    setDifficulty(level);
                  }}
                >
                  {DIFFICULTY_CONFIG[level].label}
                </button>
              ))}
            </div>
            <p className="kl-diff-desc">{DIFFICULTY_CONFIG[difficulty].description}</p>
          </>
        ) : (
          <p className="kl-diff-desc">
            {mode === 'time-trial'
              ? 'Contrarrelógio solo: 3 voltas limpas sem caixas de itens.'
              : 'Treino livre: explore o circuito sem limites de tempo ou adversários.'}
          </p>
        )}

        <div className="kl-controls-summary">
          <span>{keySummary.drive}: Dirigir</span>
          <span>{keySummary.drift}: Drift 3 Níveis</span>
          <span>{keySummary.useItem}: Usar Item</span>
          <span>{keySummary.recover}: Recuperar</span>
        </div>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              setScreen('track-select');
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            className="kl-btn kl-btn-large"
            onClick={() => {
              onPlaySfx('confirm');
              if (mode === 'championship') {
                startNewChampionship();
              }
              onStartRace();
            }}
          >
            INICIAR CORRIDA
          </button>
        </div>
      </div>
    </section>
  );
}
