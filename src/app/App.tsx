import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Howl } from 'howler';
import { useGameStore } from './store';
import { RaceHud } from '../components/hud/RaceHud';
import { getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { getTrackById } from '../data/tracks';
import { loadAssetManifest, resolveAssetPath } from '../game/core/assetLoader';
import { DEFAULT_LAPS } from '../game/core/constants';
import type { RacePhase } from '../game/racing/raceManager';
import type { KartHudTelemetry } from '../game/vehicles/KartEntity';
import { RaceScene, type RaceStageSync } from '../scenes/RaceScene';

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

const INITIAL_TELEMETRY: KartHudTelemetry = {
  speedKmh: 0,
  surface: 'asphalt',
  driftActive: false,
  driftTier: 0,
  driftChargeProgress: 0,
  boostActive: false,
  boostLabel: null,
  currentLap: 1,
  totalLaps: DEFAULT_LAPS,
  raceTimeMs: 0,
  lapTimesMs: [],
  bestLapMs: null,
  wrongWay: false,
  finished: false,
  recovering: false,
  onShortcut: false,
  progressRatio: 0,
};

export function App() {
  const manifest = useGameStore((s) => s.manifest);
  const manifestError = useGameStore((s) => s.manifestError);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);
  const settings = useGameStore((s) => s.settings);
  const setManifest = useGameStore((s) => s.setManifest);
  const setManifestError = useGameStore((s) => s.setManifestError);
  const setScreen = useGameStore((s) => s.setScreen);

  const [phaseRequest, setPhaseRequest] = useState<RacePhase>('intro');
  const [stageSync, setStageSync] = useState<RaceStageSync>({
    phase: 'intro',
    countdownLabel: null,
  });
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [telemetry, setTelemetry] = useState<KartHudTelemetry>(INITIAL_TELEMETRY);

  useEffect(() => {
    let active = true;
    loadAssetManifest()
      .then((loaded) => {
        if (!active) return;
        setManifest(loaded);
        setScreen('race');
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

  const playConfirmSound = useCallback(() => {
    if (!manifest) return;
    try {
      const path = resolveAssetPath(manifest, 'sfx-ui-confirm');
      const sfx = new Howl({ src: [path], volume: settings.audio.sfxVolume });
      sfx.play();
    } catch {
      // Ignore audio errors if manifest unavailable
    }
  }, [manifest, settings.audio.sfxVolume]);

  const handleStartRace = useCallback(() => {
    playConfirmSound();
    setPaused(false);
    setPhaseRequest('countdown');
    setResetToken((n) => n + 1);
  }, [playConfirmSound]);

  const handleRestartRace = useCallback(() => {
    playConfirmSound();
    setPaused(false);
    setTelemetry(INITIAL_TELEMETRY);
    setPhaseRequest('countdown');
    setResetToken((n) => n + 1);
  }, [playConfirmSound]);

  const handleTogglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const characterDef = getCharacterById(selectedCharacterId);
  const kartDef = getKartById(selectedKartId);
  const trackDef = getTrackById(selectedTrackId);
  const characterIconPath = manifest
    ? resolveAssetPath(manifest, characterDef.iconAssetId)
    : '/assets/ui/icon_nilo.png';

  return (
    <main className="kl-app">
      {manifestError ? (
        <div className="kl-panel" style={{ margin: 24 }}>
          <h1 className="kl-title">KART LEGENDS 3D</h1>
          <p className="kl-error-banner" role="alert">
            {manifestError}
          </p>
        </div>
      ) : (
        <>
          <SceneErrorBoundary>
            <RaceScene
              phaseRequest={phaseRequest}
              paused={paused}
              resetToken={resetToken}
              onTelemetry={setTelemetry}
              onStageSync={setStageSync}
              onPauseToggle={handleTogglePause}
            />
          </SceneErrorBoundary>

          <RaceHud
            trackName={trackDef.name}
            characterName={characterDef.name}
            kartName={kartDef.name}
            characterIconPath={characterIconPath}
            phase={stageSync.phase}
            countdownLabel={stageSync.countdownLabel}
            paused={paused}
            telemetry={telemetry}
            onStartRace={handleStartRace}
            onRestartRace={handleRestartRace}
            onTogglePause={handleTogglePause}
          />
        </>
      )}
    </main>
  );
}
