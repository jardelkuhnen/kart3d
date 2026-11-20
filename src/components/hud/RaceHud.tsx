import { useEffect, useRef } from 'react';
import { useGameStore } from '../../app/store';
import { getItemById } from '../../data/items';
import { DRIFT_TIERS, SURFACE_PROPERTIES } from '../../game/core/constants';
import type { AssetManifest, GameMode, TrackId } from '../../game/core/types';
import type { InputManager } from '../../game/input/inputManager';
import { formatPrimaryKey } from '../../game/input/keyLabels';
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
  onRecoverKart: () => void;
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
  onRecoverKart,
  onRestartRace,
  onTogglePause,
  onToggleMute,
  onOpenSettings,
  onExitToMenu,
}: RaceHudProps) {
  const bindings = useGameStore((s) => s.settings.bindings);
  const pauseModalRef = useRef<HTMLElement | null>(null);
  const resumeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!paused) return undefined;
    resumeBtnRef.current?.focus();
    const modal = pauseModalRef.current;
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleTabTrap);
    return () => window.removeEventListener('keydown', handleTabTrap);
  }, [paused]);

  const useItemKeyLabel = formatPrimaryKey(bindings.useItem);
  const recoverKeyLabel = formatPrimaryKey(bindings.recover);
  const pauseKeyLabel = formatPrimaryKey(bindings.pause);

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

  const activeAlerts: Array<{ key: string; variant: string; text: string }> = [];
  if (!paused && !countdownLabel && phase === 'racing') {
    if (telemetry.wrongWay) {
      activeAlerts.push({ key: 'wrong-way', variant: 'danger', text: 'CONTRAMÃO! DÊ A VOLTA!' });
    }
    if (telemetry.hitActive) {
      activeAlerts.push({ key: 'hit', variant: 'danger', text: 'IMPACTO!' });
    }
    if (isFinalLap) {
      activeAlerts.push({ key: 'final-lap', variant: 'final-lap', text: 'VOLTA FINAL!' });
    }
    if (telemetry.boostActive && telemetry.boostLabel) {
      activeAlerts.push({
        key: 'boost',
        variant: 'boost',
        text: `${telemetry.boostLabel.toUpperCase()}!`,
      });
    }
    if (telemetry.shieldActive) {
      activeAlerts.push({ key: 'shield', variant: 'shield', text: 'BOLHA GUARDIÃ ATIVA!' });
    }
    if (telemetry.onShortcut) {
      activeAlerts.push({
        key: 'shortcut',
        variant: 'shortcut',
        text: `${trackTheme.shortcutBannerLabel}!`,
      });
    }
  }
  const visibleAlerts = activeAlerts.slice(0, 2);

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
                  {telemetry.rouletteActive
                    ? 'SORTEANDO...'
                    : touchControlsVisible || !useItemKeyLabel
                      ? displayItemDef.name
                      : `${displayItemDef.name} (${useItemKeyLabel})`}
                </span>
              </>
            ) : (
              <span className="kl-item-empty">SEM ITEM</span>
            )}
          </div>
        )}

        <div className="kl-race-actions">
          {!touchControlsVisible && (
            <button
              type="button"
              className="kl-btn kl-btn-secondary"
              data-testid="hud-recover-btn"
              aria-label="Recuperar Kart na Pista"
              disabled={paused || phase !== 'racing'}
              onClick={onRecoverKart}
            >
              Recuperar{recoverKeyLabel ? ` (${recoverKeyLabel})` : ''}
            </button>
          )}
          <button
            type="button"
            className="kl-btn kl-btn-secondary kl-action-mute"
            onClick={onToggleMute}
            aria-label={muted ? 'Ativar Som' : 'Silenciar Som'}
          >
            {muted ? 'Som: Mudo' : 'Som: Ligado'}
          </button>
          <button
            type="button"
            className="kl-btn kl-btn-secondary kl-action-restart"
            onClick={onRestartRace}
          >
            Reiniciar
          </button>
          <button
            type="button"
            className="kl-btn kl-btn-secondary kl-action-pause"
            onClick={onTogglePause}
          >
            {touchControlsVisible || !pauseKeyLabel
              ? paused
                ? 'Retomar'
                : 'Pausar'
              : paused
                ? `Retomar (${pauseKeyLabel})`
                : `Pausar (${pauseKeyLabel})`}
          </button>
          {mode === 'practice' && (
            <button
              type="button"
              className="kl-btn kl-btn-secondary kl-action-end-practice"
              onClick={onExitToMenu}
            >
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

        {visibleAlerts.length > 0 && (
          <div className="kl-alerts-stack" data-testid="hud-alerts">
            {visibleAlerts.map((alert) => (
              <div key={alert.key} className={`kl-alert-banner ${alert.variant}`} role="status">
                {alert.text}
              </div>
            ))}
          </div>
        )}

        {paused && (
          <section
            ref={pauseModalRef}
            className="kl-panel kl-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Jogo Pausado"
          >
            <h2 className="kl-title">CORRIDA PAUSADA</h2>
            <p className="kl-subtitle">
              {trackName} —{' '}
              {mode === 'practice'
                ? `Volta ${telemetry.currentLap}`
                : `Volta ${telemetry.currentLap}/${telemetry.totalLaps}`}
              {!isSolo && ` · ${telemetry.rank}º lugar`}
            </p>
            <div className="kl-modal-actions">
              <button ref={resumeBtnRef} type="button" className="kl-btn" onClick={onTogglePause}>
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
        <section
          className="kl-panel kl-race-badge"
          data-testid="hud-race-badge"
          aria-label="Volta e Cronômetro"
        >
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

        <section
          className="kl-panel kl-telemetry-cluster"
          data-testid="hud-telemetry-cluster"
          aria-label="Velocímetro e Drift"
        >
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
