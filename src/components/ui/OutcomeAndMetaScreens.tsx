import { useEffect, useState } from 'react';
import { useGameStore } from '../../app/store';
import { CHARACTERS } from '../../data/characters';
import { KARTS } from '../../data/karts';
import { CUPS, TRACKS, getTrackById } from '../../data/tracks';
import { DEFAULT_BINDINGS } from '../../game/core/constants';
import type { ControlBindings, QualityLevel, TouchControlsMode } from '../../game/core/types';
import { formatBindingShort } from '../../game/input/keyLabels';
import { formatRaceTimeMs } from '../../game/racing/raceManager';

const TROPHY_BADGE_PT: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: 'OURO',
  silver: 'PRATA',
  bronze: 'BRONZE',
};

const ACTION_LABELS: ReadonlyArray<{ key: keyof ControlBindings; label: string }> = [
  { key: 'accelerate', label: 'Acelerar' },
  { key: 'brake', label: 'Frear / Ré' },
  { key: 'steerLeft', label: 'Virar Esquerda' },
  { key: 'steerRight', label: 'Virar Direita' },
  { key: 'drift', label: 'Saltar / Drift' },
  { key: 'useItem', label: 'Usar Item' },
  { key: 'recover', label: 'Recuperar Kart' },
  { key: 'pause', label: 'Pausar' },
];

export function SettingsScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const closeSettings = useGameStore((s) => s.closeSettings);
  const [listeningAction, setListeningAction] = useState<keyof ControlBindings | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  useEffect(() => {
    if (listeningAction) return undefined;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onPlaySfx('click');
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleEscape, { capture: true });
    return () => window.removeEventListener('keydown', handleEscape, { capture: true });
  }, [listeningAction, closeSettings, onPlaySfx]);

  useEffect(() => {
    if (!listeningAction) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Cancel remapping cleanly on Escape (unless explicitly remapping pause)
      if (e.code === 'Escape' && listeningAction !== 'pause') {
        setListeningAction(null);
        setConflictNotice(null);
        onPlaySfx('click');
        return;
      }

      const nextBindings: ControlBindings = structuredClone(settings.bindings);
      const previousCodes = nextBindings[listeningAction];
      let swappedLabel: string | null = null;

      for (const { key, label } of ACTION_LABELS) {
        if (key === listeningAction) continue;
        if (nextBindings[key].includes(e.code)) {
          const remaining = nextBindings[key].filter((c) => c !== e.code);
          nextBindings[key] = remaining.length > 0 ? remaining : previousCodes;
          swappedLabel = label;
        }
      }

      nextBindings[listeningAction] = [e.code];
      updateSettings({ bindings: nextBindings });
      setListeningAction(null);
      setConflictNotice(
        swappedLabel ? `Conflito resolvido: tecla trocada com "${swappedLabel}".` : null,
      );
      onPlaySfx('confirm');
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [listeningAction, settings.bindings, updateSettings, onPlaySfx]);

  return (
    <section className="kl-screen-center" aria-label="Configurações">
      <div className="kl-panel kl-wide-card kl-scroll-card">
        <span className="kl-brand-badge">PREFERÊNCIAS & CONTROLES</span>
        <h2 className="kl-title">Configurações</h2>

        <div className="kl-settings-grid">
          <div className="kl-garage-col">
            <div className="kl-garage-heading">Áudio (3 Canais Independentes)</div>

            <label className="kl-slider-row">
              <span>Música ({Math.round(settings.audio.musicVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.audio.musicVolume * 100)}
                aria-label="Volume da Música"
                onChange={(e) =>
                  updateSettings({
                    audio: { ...settings.audio, musicVolume: Number(e.target.value) / 100 },
                  })
                }
              />
            </label>

            <label className="kl-slider-row">
              <span>Efeitos Sonoros ({Math.round(settings.audio.sfxVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.audio.sfxVolume * 100)}
                aria-label="Volume de Efeitos"
                onChange={(e) =>
                  updateSettings({
                    audio: { ...settings.audio, sfxVolume: Number(e.target.value) / 100 },
                  })
                }
              />
            </label>

            <label className="kl-slider-row">
              <span>Ambiente ({Math.round(settings.audio.ambientVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.audio.ambientVolume * 100)}
                aria-label="Volume Ambiente"
                onChange={(e) =>
                  updateSettings({
                    audio: { ...settings.audio, ambientVolume: Number(e.target.value) / 100 },
                  })
                }
              />
            </label>

            <div className="kl-toggle-row">
              <span>Áudio Silenciado</span>
              <button
                type="button"
                className={`kl-diff-pill ${settings.audio.muted ? 'active' : ''}`}
                aria-pressed={settings.audio.muted}
                onClick={() => {
                  onPlaySfx('click');
                  updateSettings({
                    audio: { ...settings.audio, muted: !settings.audio.muted },
                  });
                }}
              >
                {settings.audio.muted ? 'Mudo: Sim' : 'Mudo: Não'}
              </button>
            </div>

            <div className="kl-garage-heading" style={{ marginTop: 12 }}>
              Gráficos & Direção
            </div>

            <div className="kl-toggle-row">
              <span>Qualidade 3D</span>
              <div className="kl-inline-pills" role="group" aria-label="Qualidade 3D">
                {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`kl-diff-pill ${settings.quality === q ? 'active' : ''}`}
                    aria-pressed={settings.quality === q}
                    data-testid={`quality-${q}`}
                    onClick={() => {
                      onPlaySfx('click');
                      updateSettings({ quality: q });
                    }}
                  >
                    {q === 'low' ? 'Baixa' : q === 'medium' ? 'Média' : 'Alta'}
                  </button>
                ))}
              </div>
            </div>

            <label className="kl-slider-row">
              <span>Sensibilidade Direção ({settings.steeringSensitivity.toFixed(1)}x)</span>
              <input
                type="range"
                min={40}
                max={200}
                value={Math.round(settings.steeringSensitivity * 100)}
                aria-label="Sensibilidade de Direção"
                onChange={(e) =>
                  updateSettings({ steeringSensitivity: Number(e.target.value) / 100 })
                }
              />
            </label>

            <label className="kl-slider-row">
              <span>Zona Morta Gamepad ({Math.round(settings.gamepadDeadzone * 100)}%)</span>
              <input
                type="range"
                min={2}
                max={40}
                value={Math.round(settings.gamepadDeadzone * 100)}
                aria-label="Zona Morta do Gamepad"
                onChange={(e) =>
                  updateSettings({ gamepadDeadzone: Number(e.target.value) / 100 })
                }
              />
            </label>

            <div className="kl-garage-heading" style={{ marginTop: 12 }}>
              Controles Touch (Mobile)
            </div>

            <div className="kl-toggle-row">
              <span>Botões na Tela</span>
              <div className="kl-inline-pills" role="group" aria-label="Botões na Tela">
                {(['auto', 'on', 'off'] as TouchControlsMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`kl-diff-pill ${settings.touch.mode === m ? 'active' : ''}`}
                    aria-pressed={settings.touch.mode === m}
                    data-testid={`touch-mode-${m}`}
                    onClick={() => {
                      onPlaySfx('click');
                      updateSettings({ touch: { ...settings.touch, mode: m } });
                    }}
                  >
                    {m === 'auto' ? 'Auto' : m === 'on' ? 'Ligado' : 'Desligado'}
                  </button>
                ))}
              </div>
            </div>

            <div className="kl-toggle-row">
              <span>Aceleração Automática</span>
              <button
                type="button"
                className={`kl-diff-pill ${settings.touch.autoAccelerate ? 'active' : ''}`}
                aria-pressed={settings.touch.autoAccelerate}
                data-testid="touch-auto-accel-toggle"
                onClick={() => {
                  onPlaySfx('click');
                  updateSettings({
                    touch: {
                      ...settings.touch,
                      autoAccelerate: !settings.touch.autoAccelerate,
                    },
                  });
                }}
              >
                {settings.touch.autoAccelerate ? 'Ativada' : 'Manual'}
              </button>
            </div>
          </div>

          <div className="kl-garage-col">
            <div className="kl-garage-heading">Remapeamento de Teclado</div>
            {conflictNotice && (
              <p className="kl-notice-banner" role="status">
                {conflictNotice}
              </p>
            )}
            <div className="kl-bindings-list">
              {ACTION_LABELS.map(({ key, label }) => {
                const isListening = listeningAction === key;
                return (
                  <div key={key} className="kl-binding-row">
                    <span>{label}</span>
                    <button
                      type="button"
                      className={`kl-binding-btn ${isListening ? 'listening' : ''}`}
                      title={formatBindingShort(settings.bindings[key])}
                      data-testid={`remap-${key}`}
                      onClick={() => {
                        onPlaySfx('click');
                        setConflictNotice(null);
                        setListeningAction(isListening ? null : key);
                      }}
                    >
                      {isListening
                        ? 'Pressione tecla (ESC cancela)...'
                        : settings.bindings[key].join(' / ')}
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="kl-btn kl-btn-secondary kl-btn-xs"
              style={{ marginTop: 10 }}
              onClick={() => {
                onPlaySfx('click');
                setListeningAction(null);
                updateSettings({ bindings: structuredClone(DEFAULT_BINDINGS) });
              }}
            >
              Restaurar Teclas Padrão
            </button>
          </div>
        </div>

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn"
            data-testid="close-settings"
            onClick={() => {
              onPlaySfx('confirm');
              closeSettings();
            }}
          >
            Salvar e Voltar
          </button>
        </div>
      </div>
    </section>
  );
}

export function ResultsScreen({
  onPlaySfx,
  onRestartRace,
  onAdvanceChampionship,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
  onRestartRace: () => void;
  onAdvanceChampionship: () => void;
}) {
  const result = useGameStore((s) => s.lastRaceResult);
  const championship = useGameStore((s) => s.championship);
  const setScreen = useGameStore((s) => s.setScreen);
  const clearChampionship = useGameStore((s) => s.clearChampionship);

  if (!result) return null;
  const track = getTrackById(result.trackId);

  return (
    <section className="kl-screen-center" aria-label="Resultados da Corrida">
      <div className="kl-panel kl-wide-card kl-scroll-card">
        <span className="kl-brand-badge">RESULTADO OFICIAL · {track.name}</span>
        <h2 className="kl-title">
          {result.mode === 'time-trial'
            ? 'TEMPO REGISTRADO!'
            : result.playerRank <= 3
              ? `PÓDIO! ${result.playerRank}º LUGAR`
              : `CHEGADA EM ${result.playerRank}º LUGAR`}
        </h2>

        <p className="kl-subtitle">
          Tempo Total: <strong>{formatRaceTimeMs(result.totalRaceTimeMs)}</strong>
          {result.bestLapMs !== null && (
            <>
              {' '}
              · Melhor Volta: <strong>{formatRaceTimeMs(result.bestLapMs)}</strong>
            </>
          )}
          {(result.isNewBestRace || result.isNewBestLap) && (
            <span className="kl-new-record-pill">NOVO RECORDE!</span>
          )}
        </p>

        {result.newlyUnlocked.length > 0 && (
          <div className="kl-unlock-banner" role="status">
            <strong>Desbloqueado:</strong> {result.newlyUnlocked.join(' · ')}
          </div>
        )}

        {result.mode !== 'time-trial' ? (
          <div className="kl-scoreboard-list">
            {result.standings.map((row) => (
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
                  {row.finishTimeMs !== null
                    ? formatRaceTimeMs(row.finishTimeMs)
                    : `Volta ${row.currentLap}`}
                </span>
                <span className="kl-sb-pts">+{row.points} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="kl-lap-splits">
            {result.lapTimesMs.map((lapMs, idx) => (
              <div key={idx} className="kl-lap-split-row">
                <span>Volta {idx + 1}</span>
                <strong>{formatRaceTimeMs(lapMs)}</strong>
              </div>
            ))}
          </div>
        )}

        {championship && (
          <p className="kl-subtitle">
            Campeonato — Etapas concluídas: <strong>{championship.completedRaces}/4</strong>
          </p>
        )}

        <div className="kl-screen-footer">
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              clearChampionship();
              setScreen('main-menu');
            }}
          >
            Menu Principal
          </button>

          {result.mode === 'championship' && result.championshipFinished ? (
            <button
              type="button"
              className="kl-btn kl-btn-large"
              onClick={() => {
                onPlaySfx('confirm');
                setScreen('podium');
              }}
            >
              Cerimônia do Pódio
            </button>
          ) : result.mode === 'championship' && championship ? (
            <button
              type="button"
              className="kl-btn kl-btn-large"
              onClick={() => {
                onPlaySfx('confirm');
                onAdvanceChampionship();
              }}
            >
              Próxima Etapa ({championship.completedRaces + 1}/4)
            </button>
          ) : (
            <>
              {result.mode === 'quick-race' && result.playerRank <= 3 && (
                <button
                  type="button"
                  className="kl-btn kl-btn-secondary"
                  onClick={() => {
                    onPlaySfx('confirm');
                    setScreen('podium');
                  }}
                >
                  Ver Pódio 3D
                </button>
              )}
              <button
                type="button"
                className="kl-btn"
                onClick={() => {
                  onPlaySfx('confirm');
                  onRestartRace();
                }}
              >
                Correr Novamente
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const TROPHY_TITLES: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: 'TROFÉU DE OURO · CAMPEÃO!',
  silver: 'TROFÉU DE PRATA · VICE-CAMPEÃO!',
  bronze: 'TROFÉU DE BRONZE · 3º LUGAR!',
};

export function PodiumScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const championship = useGameStore((s) => s.championship);
  const lastRaceResult = useGameStore((s) => s.lastRaceResult);
  const setScreen = useGameStore((s) => s.setScreen);
  const clearChampionship = useGameStore((s) => s.clearChampionship);

  const standings = championship
    ? championship.standings.map((s) => ({
        id: s.id,
        name: s.name,
        isPlayer: s.isPlayer,
        rank: s.rank,
        primaryColor: s.primaryColor,
        detail: `${s.totalPoints} pts`,
      }))
    : (lastRaceResult?.standings ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        isPlayer: s.isPlayer,
        rank: s.rank,
        primaryColor: s.primaryColor,
        detail: `+${s.points} pts`,
      }));

  const trophy = lastRaceResult?.championshipTrophy ?? null;

  return (
    <section className="kl-podium-overlay" aria-label="Pódio 3D">
      <div className="kl-panel kl-podium-top-banner">
        <span className="kl-brand-badge">CERIMÔNIA DO PÓDIO</span>
        <h2 className="kl-title">
          {trophy ? TROPHY_TITLES[trophy] : 'CLASSIFICAÇÃO DO PÓDIO'}
        </h2>
        {lastRaceResult && lastRaceResult.newlyUnlocked.length > 0 && (
          <p className="kl-unlock-banner" style={{ marginTop: 8 }}>
            Desbloqueado: {lastRaceResult.newlyUnlocked.join(' · ')}
          </p>
        )}
      </div>

      <div className="kl-panel kl-podium-bottom-bar">
        <div className="kl-podium-mini-table">
          {standings.slice(0, 4).map((row) => (
            <div
              key={row.id}
              className={`kl-podium-chip ${row.isPlayer ? 'player' : ''}`}
            >
              <strong>{row.rank}º</strong>
              <span>{row.name}</span>
              <span className="kl-sb-pts">{row.detail}</span>
            </div>
          ))}
        </div>

        <div className="kl-modal-actions" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="kl-btn kl-btn-secondary"
            onClick={() => {
              onPlaySfx('click');
              clearChampionship();
              setScreen('progression');
            }}
          >
            Ver Progressão e Troféus
          </button>
          <button
            type="button"
            className="kl-btn"
            onClick={() => {
              onPlaySfx('confirm');
              clearChampionship();
              setScreen('main-menu');
            }}
          >
            Menu Principal
          </button>
        </div>
      </div>
    </section>
  );
}

export function ProgressionScreen({
  onPlaySfx,
}: {
  onPlaySfx: (kind: 'click' | 'confirm') => void;
}) {
  const saveData = useGameStore((s) => s.saveData);
  const resetAllProgress = useGameStore((s) => s.resetAllProgress);
  const setScreen = useGameStore((s) => s.setScreen);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <section className="kl-screen-center" aria-label="Progressão e Desbloqueios">
      <div className="kl-panel kl-wide-card kl-scroll-card">
        <span className="kl-brand-badge">CARREIRA & RECORDES SALVOS (LOCAL v1)</span>
        <h2 className="kl-title">Progressão e Desbloqueios</h2>

        <div className="kl-career-stats-grid">
          <div className="kl-stat-pill">
            <span>Corridas</span>
            <strong>{saveData.stats.racesCompleted}</strong>
          </div>
          <div className="kl-stat-pill">
            <span>Vitórias</span>
            <strong>{saveData.stats.racesWon}</strong>
          </div>
          <div className="kl-stat-pill">
            <span>Campeonatos</span>
            <strong>{saveData.stats.championshipsWon}</strong>
          </div>
          <div className="kl-stat-pill">
            <span>Drifts</span>
            <strong>{saveData.stats.totalDriftsCompleted}</strong>
          </div>
          <div className="kl-stat-pill">
            <span>Turbos</span>
            <strong>{saveData.stats.totalTurbosTriggered}</strong>
          </div>
          <div className="kl-stat-pill">
            <span>Itens Usados</span>
            <strong>{saveData.stats.totalItemsUsed}</strong>
          </div>
        </div>

        <div className="kl-settings-grid">
          <div className="kl-garage-col">
            <div className="kl-garage-heading">Troféus de Copa & Pilotos</div>
            {CUPS.map((cup) => (
              <div key={cup.id} className="kl-progress-row">
                <strong>{cup.name}</strong>
                <span>
                  {saveData.cupTrophies[cup.id]
                    ? `🏆 ${TROPHY_BADGE_PT[saveData.cupTrophies[cup.id]!]}`
                    : cup.unlockRequirementLabel}
                </span>
              </div>
            ))}
            {CHARACTERS.map((ch) => {
              const unlocked = saveData.unlockedCharacters.includes(ch.id);
              return (
                <div key={ch.id} className="kl-progress-row">
                  <strong>{ch.name}</strong>
                  <span>{unlocked ? 'Desbloqueado' : `🔒 ${ch.unlockRequirementLabel}`}</span>
                </div>
              );
            })}
          </div>

          <div className="kl-garage-col">
            <div className="kl-garage-heading">Karts & Recordes de Pista</div>
            {KARTS.map((kt) => {
              const unlocked = saveData.unlockedKarts.includes(kt.id);
              return (
                <div key={kt.id} className="kl-progress-row">
                  <strong>{kt.name}</strong>
                  <span>{unlocked ? 'Desbloqueado' : `🔒 ${kt.unlockRequirementLabel}`}</span>
                </div>
              );
            })}
            <div className="kl-garage-heading" style={{ marginTop: 10 }}>
              Melhores Tempos
            </div>
            {TRACKS.map((tr) => {
              const best = saveData.bestRaceTimesMs[tr.id];
              const lap = saveData.bestLapTimesMs[tr.id];
              return (
                <div key={tr.id} className="kl-progress-row">
                  <strong>{tr.name}</strong>
                  <span>
                    {best ? formatRaceTimeMs(best) : '--'} / Volta:{' '}
                    {lap ? formatRaceTimeMs(lap) : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="kl-screen-footer">
          {!confirmReset ? (
            <button
              type="button"
              className="kl-btn kl-btn-secondary"
              onClick={() => {
                onPlaySfx('click');
                setConfirmReset(true);
              }}
            >
              Resetar Progresso
            </button>
          ) : (
            <button
              type="button"
              className="kl-btn kl-btn-danger"
              onClick={() => {
                onPlaySfx('confirm');
                resetAllProgress();
                setConfirmReset(false);
              }}
            >
              Confirmar Limpeza Total
            </button>
          )}

          <button
            type="button"
            className="kl-btn"
            onClick={() => {
              onPlaySfx('click');
              setScreen('main-menu');
            }}
          >
            Voltar ao Menu
          </button>
        </div>
      </div>
    </section>
  );
}
