import { Component, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from './store';
import { RaceHud } from '../components/hud/RaceHud';
import { getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { getTrackById } from '../data/tracks';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { loadAssetManifest, resolveAssetPath } from '../game/core/assetLoader';
import { DEFAULT_LAPS, DEFAULT_SETTINGS, TOTAL_RACERS } from '../game/core/constants';
import type { CharacterId, Difficulty, KartId, TrackId } from '../game/core/types';
import type { RacePhase } from '../game/racing/raceManager';
import type { FullHudSnapshot } from '../game/racing/raceSimulation';
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

const INITIAL_TELEMETRY: FullHudSnapshot = {
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
  rank: 1,
  totalRacers: TOTAL_RACERS,
  heldItem: null,
  rouletteActive: false,
  rouletteDisplayItem: null,
  shieldActive: false,
  hitActive: false,
  standings: [],
  minimapRacers: [],
};

export function App() {
  const manifest = useGameStore((s) => s.manifest);
  const manifestError = useGameStore((s) => s.manifestError);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);
  const difficulty = useGameStore((s) => s.difficulty);
  const settings = useGameStore((s) => s.settings);
  const setManifest = useGameStore((s) => s.setManifest);
  const setManifestError = useGameStore((s) => s.setManifestError);
  const setSelectedCharacterId = useGameStore((s) => s.setSelectedCharacterId);
  const setSelectedKartId = useGameStore((s) => s.setSelectedKartId);
  const setSelectedTrackId = useGameStore((s) => s.setSelectedTrackId);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const setScreen = useGameStore((s) => s.setScreen);

  const audioEngine = useMemo(() => new GameAudioEngine(DEFAULT_SETTINGS.audio), []);

  const [phaseRequest, setPhaseRequest] = useState<RacePhase>('intro');
  const [stageSync, setStageSync] = useState<RaceStageSync>({
    phase: 'intro',
    countdownLabel: null,
  });
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [telemetry, setTelemetry] = useState<FullHudSnapshot>(INITIAL_TELEMETRY);

  useEffect(() => {
    audioEngine.setManifest(manifest);
  }, [audioEngine, manifest]);

  useEffect(() => {
    audioEngine.applySettings(settings.audio);
  }, [audioEngine, settings.audio]);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

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

  const handleSelectCharacter = useCallback(
    (id: CharacterId) => {
      audioEngine.unlock();
      audioEngine.playSfx('sfx-ui-click');
      setSelectedCharacterId(id);
    },
    [audioEngine, setSelectedCharacterId],
  );

  const handleSelectKart = useCallback(
    (id: KartId) => {
      audioEngine.unlock();
      audioEngine.playSfx('sfx-ui-click');
      setSelectedKartId(id);
    },
    [audioEngine, setSelectedKartId],
  );

  const handleSelectTrack = useCallback(
    (id: TrackId) => {
      audioEngine.unlock();
      audioEngine.playSfx('sfx-ui-click');
      setSelectedTrackId(id);
    },
    [audioEngine, setSelectedTrackId],
  );

  const handleSelectDifficulty = useCallback(
    (level: Difficulty) => {
      audioEngine.unlock();
      audioEngine.playSfx('sfx-ui-click');
      setDifficulty(level);
    },
    [audioEngine, setDifficulty],
  );

  const handleStartRace = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playSfx('sfx-ui-confirm');
    setPaused(false);
    setPhaseRequest('countdown');
    setResetToken((n) => n + 1);
  }, [audioEngine]);

  const handleRestartRace = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playSfx('sfx-ui-confirm');
    setPaused(false);
    setTelemetry(INITIAL_TELEMETRY);
    setPhaseRequest('countdown');
    setResetToken((n) => n + 1);
  }, [audioEngine]);

  const handleTogglePause = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playSfx('sfx-ui-click');
    setPaused((prev) => !prev);
  }, [audioEngine]);

  const handleToggleMute = useCallback(() => {
    audioEngine.unlock();
    updateSettings({
      audio: {
        ...settings.audio,
        muted: !settings.audio.muted,
      },
    });
  }, [audioEngine, settings.audio, updateSettings]);

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
              audioEngine={audioEngine}
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
            manifest={manifest}
            phase={stageSync.phase}
            countdownLabel={stageSync.countdownLabel}
            paused={paused}
            selectedCharacterId={selectedCharacterId}
            selectedKartId={selectedKartId}
            selectedTrackId={selectedTrackId}
            difficulty={difficulty}
            muted={settings.audio.muted}
            telemetry={telemetry}
            onSelectCharacter={handleSelectCharacter}
            onSelectKart={handleSelectKart}
            onSelectTrack={handleSelectTrack}
            onSelectDifficulty={handleSelectDifficulty}
            onStartRace={handleStartRace}
            onRestartRace={handleRestartRace}
            onTogglePause={handleTogglePause}
            onToggleMute={handleToggleMute}
          />
        </>
      )}
    </main>
  );
}
