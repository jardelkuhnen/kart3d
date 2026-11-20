import { DRIFT_TIERS, SURFACE_PROPERTIES } from '../../game/core/constants';
import { formatRaceTimeMs, type RacePhase } from '../../game/racing/raceManager';
import type { KartHudTelemetry } from '../../game/vehicles/KartEntity';

export interface RaceHudProps {
  trackName: string;
  characterName: string;
  kartName: string;
  characterIconPath: string;
  phase: RacePhase;
  countdownLabel: string | null;
  paused: boolean;
  telemetry: KartHudTelemetry;
  onStartRace: () => void;
  onRestartRace: () => void;
  onTogglePause: () => void;
}

export function RaceHud({
  trackName,
  characterName,
  kartName,
  characterIconPath,
  phase,
  countdownLabel,
  paused,
  telemetry,
  onStartRace,
  onRestartRace,
  onTogglePause,
}: RaceHudProps) {
  const driftTierColor =
    telemetry.driftTier > 0
      ? DRIFT_TIERS[telemetry.driftTier - 1].sparkColor
      : '#94a3b8';

  const surfaceLabel = SURFACE_PROPERTIES[telemetry.surface].label;

  return (
    <div className="kl-hud-overlay">
      {/* Top Bar: Race Telemetry + Controls */}
      <header className="kl-topbar">
        <section className="kl-panel kl-race-badge" aria-label="Dados da Corrida">
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

        {phase !== 'intro' && (
          <div className="kl-race-actions">
            <button type="button" className="kl-btn kl-btn-secondary" onClick={onRestartRace}>
              Reiniciar
            </button>
            <button type="button" className="kl-btn kl-btn-secondary" onClick={onTogglePause}>
              {paused ? 'Retomar (ESC)' : 'Pausar (ESC)'}
            </button>
          </div>
        )}
      </header>

      {/* Center Banners: Intro Launcher / Countdown / Wrong-Way / Finish / Pause */}
      <div className="kl-center-stage">
        {phase === 'intro' && (
          <section className="kl-panel kl-launch-card" aria-label="Iniciar Corrida">
            <span className="kl-brand-badge">SLICE 1 · NÚCLEO JOGÁVEL 1×1×1</span>
            <h1 className="kl-title">KART LEGENDS 3D</h1>
            <p className="kl-subtitle">
              {trackName} · Piloto: <strong>{characterName}</strong> · Kart:{' '}
              <strong>{kartName}</strong>
            </p>
            <div className="kl-controls-summary">
              <span>WASD / Setas: Dirigir</span>
              <span>ESPAÇO: Drift 3 Níveis</span>
              <span>R: Recuperar</span>
              <span>ESC: Pausar</span>
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

        {telemetry.wrongWay && phase === 'racing' && !paused && (
          <div className="kl-alert-banner danger" role="status">
            CONTRAMÃO! DÊ A VOLTA!
          </div>
        )}

        {telemetry.boostActive && telemetry.boostLabel && phase === 'racing' && !paused && (
          <div className="kl-alert-banner boost" role="status">
            {telemetry.boostLabel.toUpperCase()}!
          </div>
        )}

        {telemetry.onShortcut && phase === 'racing' && !paused && (
          <div className="kl-alert-banner shortcut" role="status">
            ATALHO DO PORTO!
          </div>
        )}

        {paused && (
          <section className="kl-panel kl-modal-card" role="dialog" aria-label="Jogo Pausado">
            <h2 className="kl-title">CORRIDA PAUSADA</h2>
            <p className="kl-subtitle">
              {trackName} — Volta {telemetry.currentLap}/{telemetry.totalLaps}
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
            className="kl-panel kl-modal-card"
            role="dialog"
            aria-label="Corrida Concluída"
          >
            <span className="kl-brand-badge">CHEGADA!</span>
            <h2 className="kl-title">CORRIDA CONCLUÍDA</h2>
            <p className="kl-subtitle">
              Tempo Total: <strong>{formatRaceTimeMs(telemetry.raceTimeMs)}</strong>
              {telemetry.bestLapMs !== null && (
                <> · Melhor Volta: <strong>{formatRaceTimeMs(telemetry.bestLapMs)}</strong></>
              )}
            </p>
            <div className="kl-lap-splits">
              {telemetry.lapTimesMs.map((lapMs, idx) => (
                <div key={idx} className="kl-lap-split-row">
                  <span>Volta {idx + 1}</span>
                  <strong>{formatRaceTimeMs(lapMs)}</strong>
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

      {/* Bottom Telemetry Bar */}
      <footer className="kl-bottom-bar">
        <div className="kl-panel kl-controls-hint">
          <span>W/↑ Acelerar</span>
          <span>S/↓ Freio/Ré</span>
          <span>A/D Curvas</span>
          <span>ESPAÇO Drift</span>
          <span>R Recuperar</span>
        </div>

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
