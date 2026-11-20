import { getItemById } from '../../data/items';
import { DRIFT_TIERS, SURFACE_PROPERTIES } from '../../game/core/constants';
import type { AssetManifest, GameMode, TrackId } from '../../game/core/types';
import type { InputManager } from '../../game/input/inputManager';
import { resolveAssetPath } from '../../game/core/assetLoader';
import { formatRaceTimeMs, type RacePhase } from '../../game/racing/raceManager';
import type { FullHudSnapshot } from '../../game/racing/raceSimulation';
import { getTrackLayout, getTrackVisualTheme } from '../../game/tracks/registry';
import { Minimap } from './Minimap';
import { TouchControls } from './TouchControls';

export interface RaceHudProps {
  mode: GameMode;
  trackName: string;
  characterName: string;
  characterIconPath: string;
  manifest: AssetManifest | null;
  phase: RacePhase;
  countdownLabel: string | null;
  paused: boolean;
  selectedTrackId: TrackId;
  championshipRoundLabel: string | null;
  muted: boolean;
  telemetry: FullHudSnapshot;
  inputManager: InputManager;
  touchControlsVisible: boolean;
  touchAutoAccelerate: boolean;
  onUserGesture: () => void;
  onRestartRace: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onExitToMenu: () => void;
}

const RANK_ORDINAL_CLASSES = ['gold', 'silver', 'bronze'];

export function RaceHud({
  mode,
  trackName,
  characterName,
  characterIconPath,
  manifest,
  phase,
  countdownLabel,
  paused,
  selectedTrackId,
  championshipRoundLabel,
  muted,
  telemetry,
  inputManager,
  touchControlsVisible,
  touchAutoAccelerate,
  onUserGesture,
  onRestartRace,
  onTogglePause,
  onToggleMute,
  onOpenSettings,
  onExitToMenu,
}: RaceHudProps) {
  const trackLayout = getTrackLayout(selectedTrackId);
  const trackTheme = getTrackVisualTheme(selectedTrackId);
  const isSolo = mode === 'time-trial' || mode === 'practice';

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
  const isFinalLap =
    mode !== 'practice' && telemetry.currentLap === telemetry.totalLaps && phase === 'racing';

  return (
    <div className={`kl-hud-overlay ${touchControlsVisible ? 'has-touch-controls' : ''}`}>
      {touchControlsVisible && (
        <div className="kl-portrait-hint" role="note">
          Gire o aparelho para o modo paisagem para melhor ergonomia
        </div>
      )}
      {/* Top Bar: Rank/Mode + Minimap (Left), Item Slot (Center), Controls + Audio (Right) */}
      <header className="kl-topbar">
        <div className="kl-left-cluster">
          <div className="kl-panel kl-rank-card" aria-label="Posição na Corrida">
            {isSolo ? (
              <span className="kl-solo-mode-badge" data-testid="rank-badge">
                {mode === 'time-trial' ? 'CONTRARRELÓGIO' : 'TREINO LIVRE'}
              </span>
            ) : (
              <>
                <span className={`kl-rank-num ${rankClass}`} data-testid="rank-badge">
                  {telemetry.rank}º
                </span>
                <span className="kl-rank-total">/ {telemetry.totalRacers}</span>
              </>
            )}
          </div>

          <Minimap layout={trackLayout} racers={telemetry.minimapRacers} />
        </div>

        {/* Center Item Slot (Hidden cleanly in Time Trial) */}
        {mode !== 'time-trial' && (
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
          <button type="button" className="kl-btn kl-btn-secondary" onClick={onRestartRace}>
            Reiniciar
          </button>
          <button type="button" className="kl-btn kl-btn-secondary" onClick={onTogglePause}>
            {paused ? 'Retomar (ESC)' : 'Pausar (ESC)'}
          </button>
          {mode === 'practice' && (
            <button type="button" className="kl-btn kl-btn-secondary" onClick={onExitToMenu}>
              Encerrar Treino
            </button>
          )}
        </div>
      </header>

      {/* Center Stage: Countdown / Alerts / Pause */}
      <div className="kl-center-stage">
        {countdownLabel && !paused && (
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
              {trackName} —{' '}
              {mode === 'practice'
                ? `Volta ${telemetry.currentLap}`
                : `Volta ${telemetry.currentLap}/${telemetry.totalLaps}`}
              {!isSolo && ` · ${telemetry.rank}º lugar`}
            </p>
            <div className="kl-modal-actions">
              <button type="button" className="kl-btn" onClick={onTogglePause}>
                Continuar
              </button>
              <button type="button" className="kl-btn kl-btn-secondary" onClick={onRestartRace}>
                Reiniciar Pista
              </button>
              <button type="button" className="kl-btn kl-btn-secondary" onClick={onOpenSettings}>
                Configurações
              </button>
              <button type="button" className="kl-btn kl-btn-secondary" onClick={onExitToMenu}>
                Menu Principal
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
                {mode === 'practice'
                  ? `VOLTA ${telemetry.currentLap} · LIVRE`
                  : `VOLTA ${telemetry.currentLap}/${telemetry.totalLaps}`}
              </span>
              <span className="kl-track-chip">{trackName}</span>
              {championshipRoundLabel && (
                <span className="kl-track-chip">{championshipRoundLabel}</span>
              )}
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

      {touchControlsVisible && !paused && (phase === 'countdown' || phase === 'racing') && (
        <TouchControls
          inputManager={inputManager}
          mode={mode}
          autoAccelerate={touchAutoAccelerate}
          driftTier={telemetry.driftTier}
          driftActive={telemetry.driftActive}
          heldItemName={displayItemDef?.name ?? null}
          heldItemIcon={displayItemIcon}
          onUserGesture={onUserGesture}
        />
      )}
    </div>
  );
}
