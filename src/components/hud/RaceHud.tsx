import { CHARACTERS, getCharacterById } from '../../data/characters';
import { getItemById } from '../../data/items';
import { KARTS, getKartById } from '../../data/karts';
import { CUPS, getTracksByCup } from '../../data/tracks';
import { DIFFICULTY_CONFIG, DRIFT_TIERS, SURFACE_PROPERTIES } from '../../game/core/constants';
import type {
  AssetManifest,
  CharacterId,
  CupId,
  Difficulty,
  KartAttributes,
  KartId,
  TrackId,
} from '../../game/core/types';
import { resolveAssetPath } from '../../game/core/assetLoader';
import { formatRaceTimeMs, type RacePhase } from '../../game/racing/raceManager';
import type { FullHudSnapshot } from '../../game/racing/raceSimulation';
import { getTrackLayout, getTrackVisualTheme } from '../../game/tracks/registry';
import { Minimap } from './Minimap';

const STAT_ROWS: Array<{ key: keyof KartAttributes; label: string }> = [
  { key: 'topSpeed', label: 'Velocidade' },
  { key: 'acceleration', label: 'Aceleração' },
  { key: 'handling', label: 'Curva' },
  { key: 'grip', label: 'Aderência' },
  { key: 'driftEfficiency', label: 'Drift' },
  { key: 'mass', label: 'Massa' },
];

export interface RaceHudProps {
  trackName: string;
  characterName: string;
  kartName: string;
  characterIconPath: string;
  manifest: AssetManifest | null;
  phase: RacePhase;
  countdownLabel: string | null;
  paused: boolean;
  selectedCharacterId: CharacterId;
  selectedKartId: KartId;
  selectedCupId: CupId;
  selectedTrackId: TrackId;
  difficulty: Difficulty;
  muted: boolean;
  telemetry: FullHudSnapshot;
  onSelectCharacter: (id: CharacterId) => void;
  onSelectKart: (id: KartId) => void;
  onSelectCup: (cupId: CupId) => void;
  onSelectTrack: (id: TrackId) => void;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onStartRace: () => void;
  onRestartRace: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

const RANK_ORDINAL_CLASSES = ['gold', 'silver', 'bronze'];

export function RaceHud({
  trackName,
  characterName,
  kartName,
  characterIconPath,
  manifest,
  phase,
  countdownLabel,
  paused,
  selectedCharacterId,
  selectedKartId,
  selectedCupId,
  selectedTrackId,
  difficulty,
  muted,
  telemetry,
  onSelectCharacter,
  onSelectKart,
  onSelectCup,
  onSelectTrack,
  onSelectDifficulty,
  onStartRace,
  onRestartRace,
  onTogglePause,
  onToggleMute,
}: RaceHudProps) {
  const selectedCharacter = getCharacterById(selectedCharacterId);
  const selectedKart = getKartById(selectedKartId);
  const cupTracks = getTracksByCup(selectedCupId);
  const trackLayout = getTrackLayout(selectedTrackId);
  const trackTheme = getTrackVisualTheme(selectedTrackId);
  const driftTierColor =
    telemetry.driftTier > 0
      ? DRIFT_TIERS[telemetry.driftTier - 1].sparkColor
      : '#94a3b8';
  const surfaceLabel = SURFACE_PROPERTIES[telemetry.surface].label;

  const displayItemId = telemetry.rouletteActive
    ? telemetry.rouletteDisplayItem
    : telemetry.heldItem;
  const displayItemDef = displayItemId ? getItemById(displayItemId) : null;
  const displayItemIcon =
    displayItemDef && manifest ? resolveAssetPath(manifest, displayItemDef.iconAssetId) : null;

  const rankClass = RANK_ORDINAL_CLASSES[telemetry.rank - 1] ?? 'standard';
  const isFinalLap = telemetry.currentLap === telemetry.totalLaps && phase === 'racing';

  return (
    <div className="kl-hud-overlay">
      {/* Top Bar: Rank + Minimap (Left), Item Slot (Center), Controls + Audio (Right) */}
      <header className="kl-topbar">
        <div className="kl-left-cluster">
          <div className="kl-panel kl-rank-card" aria-label="Posição na Corrida">
            <span className={`kl-rank-num ${rankClass}`} data-testid="rank-badge">
              {telemetry.rank}º
            </span>
            <span className="kl-rank-total">/ {telemetry.totalRacers}</span>
          </div>

          {phase !== 'intro' && (
            <Minimap layout={trackLayout} racers={telemetry.minimapRacers} />
          )}
        </div>

        {/* Center Item Slot */}
        {phase !== 'intro' && (
          <div
            className={`kl-panel kl-item-slot ${telemetry.rouletteActive ? 'spinning' : ''}`}
            data-testid="item-slot"
            aria-label="Item Equipado"
          >
            {displayItemDef && displayItemIcon ? (
              <>
                <img
                  src={displayItemIcon}
                  alt={displayItemDef.name}
                  className="kl-item-icon"
                  width={54}
                  height={54}
                />
                <span className="kl-item-label">
                  {telemetry.rouletteActive ? 'SORTEANDO...' : `${displayItemDef.name} (SHIFT)`}
                </span>
              </>
            ) : (
              <span className="kl-item-empty">SEM ITEM</span>
            )}
          </div>
        )}

        <div className="kl-race-actions">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={onToggleMute}
            aria-label={muted ? 'Ativar Som' : 'Silenciar Som'}
          >
            {muted ? 'Som: Mudo' : 'Som: Ligado'}
          </button>
          {phase !== 'intro' && (
            <>
              <button type="button" className="kl-btn kl-btn-secondary" onClick={onRestartRace}>
                Reiniciar
              </button>
              <button type="button" className="kl-btn kl-btn-secondary" onClick={onTogglePause}>
                {paused ? 'Retomar (ESC)' : 'Pausar (ESC)'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Center Stage: Launch / Countdown / Alerts / Pause / Scoreboard */}
      <div className="kl-center-stage">
        {phase === 'intro' && (
          <section className="kl-panel kl-launch-card" aria-label="Iniciar Corrida">
            <span className="kl-brand-badge">SLICE 5 · 8 PISTAS (2 COPAS) · 8 PILOTOS · 8 KARTS</span>
            <h1 className="kl-title">KART LEGENDS 3D</h1>
            <p className="kl-subtitle">
              Pista: <strong>{trackName}</strong> · Piloto: <strong>{characterName}</strong> ·
              Kart: <strong>{kartName}</strong>
            </p>

            <div className="kl-cup-tabs" role="group" aria-label="Escolha a Copa">
              {CUPS.map((cup) => {
                const active = cup.id === selectedCupId;
                return (
                  <button
                    key={cup.id}
                    type="button"
                    className={`kl-cup-tab ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    data-testid={`cup-tab-${cup.id}`}
                    onClick={() => onSelectCup(cup.id)}
                  >
                    {cup.name}
                  </button>
                );
              })}
            </div>

            <div className="kl-track-picker" role="group" aria-label="Escolha a Pista">
              {cupTracks.map((tr) => {
                const active = tr.id === selectedTrackId;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    className={`kl-track-btn ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    data-testid={`track-option-${tr.id}`}
                    onClick={() => onSelectTrack(tr.id)}
                  >
                    <span className="kl-track-btn-name">{tr.name}</span>
                    <span className="kl-track-btn-theme">{tr.theme}</span>
                  </button>
                );
              })}
            </div>

            <div className="kl-garage-grid">
              <div className="kl-garage-col" role="group" aria-label="Escolha o Piloto">
                <div className="kl-garage-heading">Piloto (8 Originais)</div>
                <div className="kl-char-grid">
                  {CHARACTERS.map((char) => {
                    const active = char.id === selectedCharacterId;
                    const portraitPath = manifest
                      ? resolveAssetPath(manifest, char.portraitAssetId)
                      : `/assets/ui/portrait_${char.id}.png`;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        className={`kl-char-btn ${active ? 'active' : ''}`}
                        aria-pressed={active}
                        data-testid={`char-option-${char.id}`}
                        onClick={() => onSelectCharacter(char.id)}
                      >
                        <img
                          src={portraitPath}
                          alt={char.name}
                          className="kl-char-thumb"
                          width={34}
                          height={34}
                        />
                        <span className="kl-char-btn-name">{char.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="kl-garage-note">{selectedCharacter.bio}</p>
              </div>

              <div className="kl-garage-col" role="group" aria-label="Escolha o Kart">
                <div className="kl-garage-heading">Kart (8 Modelos Únicos)</div>
                <div className="kl-kart-grid">
                  {KARTS.map((kart) => {
                    const active = kart.id === selectedKartId;
                    return (
                      <button
                        key={kart.id}
                        type="button"
                        className={`kl-kart-btn ${active ? 'active' : ''}`}
                        aria-pressed={active}
                        data-testid={`kart-option-${kart.id}`}
                        onClick={() => onSelectKart(kart.id)}
                      >
                        <span
                          className="kl-kart-swatch"
                          style={{
                            background: `linear-gradient(135deg, ${kart.primaryColor}, ${kart.trimColor})`,
                          }}
                          aria-hidden="true"
                        />
                        <span className="kl-kart-btn-name">{kart.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="kl-stats-mini-grid" aria-label="Atributos Combinados">
                  {STAT_ROWS.map(({ key, label }) => {
                    const bonus = selectedCharacter.statBonuses[key] ?? 0;
                    const value = Math.min(10, selectedKart.attributes[key] + bonus);
                    return (
                      <div key={key} className="kl-stat-mini">
                        <div className="kl-stat-mini-top">
                          <span>{label}</span>
                          <span>
                            {value}/10{bonus > 0 ? ` (+${bonus})` : ''}
                          </span>
                        </div>
                        <div className="kl-stat-mini-bar">
                          <div
                            className="kl-stat-mini-fill"
                            style={{ width: `${value * 10}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="kl-difficulty-group" role="group" aria-label="Dificuldade da IA">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`kl-diff-pill ${difficulty === level ? 'active' : ''}`}
                  onClick={() => onSelectDifficulty(level)}
                >
                  {DIFFICULTY_CONFIG[level].label}
                </button>
              ))}
            </div>
            <p className="kl-diff-desc">{DIFFICULTY_CONFIG[difficulty].description}</p>

            <div className="kl-controls-summary">
              <span>WASD / Setas: Dirigir</span>
              <span>ESPAÇO: Drift 3 Níveis</span>
              <span>SHIFT: Usar Item</span>
              <span>R: Recuperar</span>
            </div>

            <button
              type="button"
              className="kl-btn kl-btn-large"
              onClick={onStartRace}
              autoFocus
            >
              INICIAR CORRIDA
            </button>
          </section>
        )}

        {countdownLabel && !paused && phase !== 'intro' && (
          <div
            className={`kl-countdown-callout ${countdownLabel === 'JÁ!' ? 'go' : ''}`}
            data-testid="countdown-callout"
          >
            {countdownLabel}
          </div>
        )}

        {isFinalLap && !paused && !countdownLabel && (
          <div className="kl-alert-banner final-lap" role="status">
            VOLTA FINAL!
          </div>
        )}

        {telemetry.wrongWay && phase === 'racing' && !paused && (
          <div className="kl-alert-banner danger" role="status">
            CONTRAMÃO! DÊ A VOLTA!
          </div>
        )}

        {telemetry.shieldActive && phase === 'racing' && !paused && (
          <div className="kl-alert-banner shield" role="status">
            BOLHA GUARDIÃ ATIVA!
          </div>
        )}

        {telemetry.hitActive && phase === 'racing' && !paused && (
          <div className="kl-alert-banner danger" role="status">
            IMPACTO!
          </div>
        )}

        {telemetry.boostActive && telemetry.boostLabel && phase === 'racing' && !paused && (
          <div className="kl-alert-banner boost" role="status">
            {telemetry.boostLabel.toUpperCase()}!
          </div>
        )}

        {telemetry.onShortcut && phase === 'racing' && !paused && (
          <div className="kl-alert-banner shortcut" role="status">
            {trackTheme.shortcutBannerLabel}!
          </div>
        )}

        {paused && (
          <section className="kl-panel kl-modal-card" role="dialog" aria-label="Jogo Pausado">
            <h2 className="kl-title">CORRIDA PAUSADA</h2>
            <p className="kl-subtitle">
              {trackName} — Volta {telemetry.currentLap}/{telemetry.totalLaps} · {telemetry.rank}º
              lugar
            </p>
            <div className="kl-modal-actions">
              <button type="button" className="kl-btn" onClick={onTogglePause}>
                Continuar
              </button>
              <button type="button" className="kl-btn kl-btn-secondary" onClick={onRestartRace}>
                Reiniciar Pista
              </button>
            </div>
          </section>
        )}

        {phase === 'finished' && (
          <section
            className="kl-panel kl-scoreboard-card"
            role="dialog"
            aria-label="Classificação Final"
          >
            <span className="kl-brand-badge">RESULTADO OFICIAL</span>
            <h2 className="kl-title">
              {telemetry.rank <= 3
                ? `PÓDIO! ${telemetry.rank}º LUGAR`
                : `CHEGADA EM ${telemetry.rank}º LUGAR`}
            </h2>
            <p className="kl-subtitle">
              Tempo Total: <strong>{formatRaceTimeMs(telemetry.raceTimeMs)}</strong>
              {telemetry.bestLapMs !== null && (
                <> · Melhor Volta: <strong>{formatRaceTimeMs(telemetry.bestLapMs)}</strong></>
              )}
            </p>

            <div className="kl-scoreboard-list">
              {telemetry.standings.map((row) => (
                <div
                  key={row.id}
                  className={`kl-scoreboard-row ${row.isPlayer ? 'player' : ''} ${
                    row.rank === 1 ? 'first' : ''
                  }`}
                >
                  <span className="kl-sb-rank">{row.rank}º</span>
                  <span
                    className="kl-sb-dot"
                    style={{ backgroundColor: row.primaryColor }}
                    aria-hidden="true"
                  />
                  <span className="kl-sb-name">
                    {row.name} {row.isPlayer ? '(VOCÊ)' : ''}
                  </span>
                  <span className="kl-sb-kart">{row.kartName}</span>
                  <span className="kl-sb-time">
                    {row.finishTimeMs !== null ? formatRaceTimeMs(row.finishTimeMs) : `Volta ${row.currentLap}`}
                  </span>
                  <span className="kl-sb-pts">+{row.points} pts</span>
                </div>
              ))}
            </div>

            <div className="kl-modal-actions">
              <button type="button" className="kl-btn" onClick={onRestartRace}>
                Correr Novamente
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Bottom Bar: Driver + Lap + Timer (Left) & Speedometer + Drift/Turbo (Right) */}
      <footer className="kl-bottom-bar">
        <section className="kl-panel kl-race-badge" aria-label="Volta e Cronômetro">
          <img
            src={characterIconPath}
            alt={characterName}
            className="kl-driver-avatar"
            width={44}
            height={44}
          />
          <div>
            <div className="kl-race-meta-row">
              <span className="kl-lap-pill">
                VOLTA {telemetry.currentLap}/{telemetry.totalLaps}
              </span>
              <span className="kl-track-chip">{trackName}</span>
            </div>
            <div className="kl-timer-readout" data-testid="race-timer">
              {formatRaceTimeMs(telemetry.raceTimeMs)}
            </div>
          </div>
        </section>

        <section className="kl-panel kl-telemetry-cluster" aria-label="Velocímetro e Drift">
          <div className="kl-speed-box">
            <span className="kl-speed-number" data-testid="speedometer-value">
              {telemetry.speedKmh}
            </span>
            <span className="kl-speed-unit">km/h</span>
          </div>

          <div className="kl-gauges-col">
            <div className="kl-gauge-header">
              <span className="kl-stat-label">Superfície: {surfaceLabel}</span>
              <span className="kl-stat-label" style={{ color: driftTierColor }}>
                {telemetry.driftTier > 0
                  ? `DRIFT NV.${telemetry.driftTier}`
                  : telemetry.driftActive
                    ? 'CARREGANDO DRIFT'
                    : telemetry.boostActive
                      ? 'TURBO ATIVO'
                      : 'DRIFT PRONTO'}
              </span>
            </div>
            <div className="kl-drift-bar-bg">
              <div
                className="kl-drift-bar-fill"
                style={{
                  width: `${Math.round(telemetry.driftChargeProgress * 100)}%`,
                  background: driftTierColor,
                }}
              />
            </div>
          </div>
        </section>
      </footer>
    </div>
  );
}
