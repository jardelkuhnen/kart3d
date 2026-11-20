import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Howl } from 'howler';
import { useGameStore } from './store';
import { CHARACTERS } from '../data/characters';
import { ITEMS } from '../data/items';
import { KARTS } from '../data/karts';
import { TRACKS } from '../data/tracks';
import { loadAssetManifest, resolveAssetPath } from '../game/core/assetLoader';
import { CalibrationStage } from '../scenes/CalibrationStage';

interface ErrorBoundaryState {
  error: string | null;
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error: error.message };
  }

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="kl-panel" style={{ margin: 24 }}>
          <h2 className="kl-title">Erro na Cena 3D</h2>
          <p className="kl-error-banner">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const manifest = useGameStore((s) => s.manifest);
  const manifestError = useGameStore((s) => s.manifestError);
  const physicsStepsObserved = useGameStore((s) => s.physicsStepsObserved);
  const settings = useGameStore((s) => s.settings);
  const setManifest = useGameStore((s) => s.setManifest);
  const setManifestError = useGameStore((s) => s.setManifestError);
  const setScreen = useGameStore((s) => s.setScreen);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'played' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    loadAssetManifest()
      .then((loaded) => {
        if (!active) return;
        setManifest(loaded);
        setScreen('main-menu');
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        setManifestError(message);
      });
    return () => {
      active = false;
    };
  }, [setManifest, setManifestError, setScreen]);

  const handleTestAudio = useCallback(() => {
    if (!manifest) return;
    try {
      const path = resolveAssetPath(manifest, 'sfx-ui-confirm');
      const sound = new Howl({
        src: [path],
        volume: settings.audio.sfxVolume,
        onplay: () => setAudioStatus('played'),
        onloaderror: () => setAudioStatus('error'),
      });
      sound.play();
    } catch {
      setAudioStatus('error');
    }
  }, [manifest, settings.audio.sfxVolume]);

  return (
    <main className="kl-app">
      <SceneErrorBoundary>
        <CalibrationStage />
      </SceneErrorBoundary>

      <div className="kl-hud-overlay">
        <header className="kl-topbar">
          <section className="kl-panel" aria-label="Status da Fundação">
            <span className="kl-brand-badge">SLICE 0 · FUNDAÇÃO TÉCNICA</span>
            <h1 className="kl-title">KART LEGENDS 3D</h1>
            <p className="kl-subtitle">
              Fundação WebGL + Rapier Ativa · {CHARACTERS.length} pilotos · {KARTS.length} karts ·{' '}
              {TRACKS.length} pistas · {ITEMS.length} itens registrados
            </p>
            {manifestError && (
              <p className="kl-error-banner" role="alert">
                {manifestError}
              </p>
            )}
          </section>

          <section className="kl-panel kl-stats-grid" aria-label="Telemetria de Inicialização">
            <div className="kl-stat-pill">
              <span className="kl-stat-label">Manifesto</span>
              <span className={`kl-stat-value ${manifest ? 'ok' : manifestError ? 'error' : ''}`}>
                {manifest ? `${manifest.assets.length} ativos` : manifestError ? 'Erro' : 'Carregando'}
              </span>
            </div>
            <div className="kl-stat-pill">
              <span className="kl-stat-label">Física Rapier</span>
              <span className="kl-stat-value ok">60 Hz ({physicsStepsObserved} steps)</span>
            </div>
            <div className="kl-stat-pill">
              <span className="kl-stat-label">Qualidade</span>
              <span className="kl-stat-value">{settings.quality.toUpperCase()}</span>
            </div>
          </section>
        </header>

        <footer className="kl-bottom-bar">
          <div className="kl-panel">
            <span className="kl-subtitle">
              Arraste o mouse para inspecionar o pórtico GLB, placas direcionais e o probe Rapier.
            </span>
          </div>
          <button
            type="button"
            className="kl-btn"
            onClick={handleTestAudio}
            disabled={!manifest}
          >
            {audioStatus === 'played'
              ? 'Áudio Confirmado (Howler.js)'
              : audioStatus === 'error'
                ? 'Erro no Áudio'
                : 'Testar Áudio (Howler.js)'}
          </button>
        </footer>
      </div>
    </main>
  );
}
