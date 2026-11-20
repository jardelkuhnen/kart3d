import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from './store';
import { RaceHud } from '../components/hud/RaceHud';
import {
  CharacterSelectScreen,
  CupSelectScreen,
  DifficultySelectScreen,
  KartSelectScreen,
  TrackSelectScreen,
} from '../components/ui/GarageScreens';
import {
  LoadingScreen,
  MainMenuScreen,
  ModeSelectScreen,
} from '../components/ui/LoadingAndMenuScreens';
import {
  PodiumScreen,
  ProgressionScreen,
  ResultsScreen,
  SettingsScreen,
} from '../components/ui/OutcomeAndMetaScreens';
import { getCharacterById } from '../data/characters';
import { getTrackById } from '../data/tracks';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { loadAssetManifest, resolveAssetPath } from '../game/core/assetLoader';
import { publicUrl } from '../game/core/publicUrl';
import { DEFAULT_BINDINGS, DEFAULT_LAPS, TOTAL_RACERS } from '../game/core/constants';
import { detectTouchDevice, resolveTouchControlsVisible } from '../game/core/mobile';
import type { CharacterId } from '../game/core/types';
import { InputManager } from '../game/input/inputManager';
import type { RacePhase } from '../game/racing/raceManager';
import type { FullHudSnapshot } from '../game/racing/raceSimulation';
import { RaceScene, type RaceStageSync, type SceneStageMode } from '../scenes/RaceScene';

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
  driftsCompleted: 0,
  turbosTriggered: 0,
  itemsUsed: 0,
  standings: [],
  minimapRacers: [],
};

export function App() {
  const screen = useGameStore((s) => s.screen);
  const previousScreen = useGameStore((s) => s.previousScreen);
  const mode = useGameStore((s) => s.mode);
  const manifest = useGameStore((s) => s.manifest);
  const manifestError = useGameStore((s) => s.manifestError);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);
  const settings = useGameStore((s) => s.settings);
  const championship = useGameStore((s) => s.championship);
  const lastRaceResult = useGameStore((s) => s.lastRaceResult);

  const setManifest = useGameStore((s) => s.setManifest);
  const setManifestError = useGameStore((s) => s.setManifestError);
  const setScreen = useGameStore((s) => s.setScreen);
  const openSettings = useGameStore((s) => s.openSettings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const commitRaceOutcome = useGameStore((s) => s.commitRaceOutcome);
  const advanceChampionshipRace = useGameStore((s) => s.advanceChampionshipRace);
  const clearChampionship = useGameStore((s) => s.clearChampionship);

  const audioEngine = useMemo(() => new GameAudioEngine(settings.audio), []); // eslint-disable-line react-hooks/exhaustive-deps
  const inputManager = useMemo(() => new InputManager(DEFAULT_BINDINGS), []);
  const isTouchDevice = useMemo(() => detectTouchDevice(), []);
  const touchControlsVisible = resolveTouchControlsVisible(settings.touch.mode, isTouchDevice);

  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [telemetry, setTelemetry] = useState<FullHudSnapshot>(INITIAL_TELEMETRY);
  const [stageSync, setStageSync] = useState<RaceStageSync>({
    phase: 'intro',
    countdownLabel: null,
  });

  const finishCommittedRef = useRef(false);

  useEffect(() => {
    audioEngine.setManifest(manifest);
  }, [audioEngine, manifest]);

  useEffect(() => {
    audioEngine.applySettings(settings.audio);
  }, [audioEngine, settings.audio]);

  useEffect(() => {
    inputManager.attach();
    return () => inputManager.detach();
  }, [inputManager]);

  useEffect(() => {
    inputManager.updateConfig(
      settings.bindings,
      settings.steeringSensitivity,
      settings.gamepadDeadzone,
    );
  }, [inputManager, settings.bindings, settings.steeringSensitivity, settings.gamepadDeadzone]);

  useEffect(() => {
    const raceActive = screen === 'race' && !paused;
    inputManager.setCaptureGameplayKeys(raceActive);
    inputManager.setAutoAccelerate(
      raceActive && touchControlsVisible && settings.touch.autoAccelerate,
    );
    if (!raceActive || !touchControlsVisible) {
      inputManager.resetVirtualInput();
    }
  }, [inputManager, paused, screen, settings.touch.autoAccelerate, touchControlsVisible]);

  useEffect(() => {
    const unlockAudioOnGesture = () => {
      audioEngine.unlock();
    };
    window.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true, capture: true });
    window.addEventListener('touchstart', unlockAudioOnGesture, { passive: true, capture: true });
    window.addEventListener('keydown', unlockAudioOnGesture, { passive: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioOnGesture, { capture: true });
      window.removeEventListener('touchstart', unlockAudioOnGesture, { capture: true });
      window.removeEventListener('keydown', unlockAudioOnGesture, { capture: true });
    };
  }, [audioEngine]);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

  // Menu vs outcome music coordination
  useEffect(() => {
    if (!manifest) return;
    if (screen === 'results' || screen === 'podium') {
      const won =
        (lastRaceResult?.mode === 'time-trial') ||
        ((lastRaceResult?.playerRank ?? 8) <= 3);
      audioEngine.playMusic(won ? 'music-victory' : 'music-defeat', screen === 'podium');
    } else if (
      screen !== 'race' &&
      screen !== 'pause' &&
      !(screen === 'settings' && (previousScreen === 'race' || previousScreen === 'pause'))
    ) {
      audioEngine.stopAmbience();
      audioEngine.updateEngineTelemetry(0, false, false, 0, false, false, false);
      audioEngine.playMusic('music-menu', true);
    }
  }, [audioEngine, manifest, screen, previousScreen, lastRaceResult]);

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

  const playUiSfx = useCallback(
    (kind: 'click' | 'confirm') => {
      audioEngine.unlock();
      audioEngine.playSfx(kind === 'confirm' ? 'sfx-ui-confirm' : 'sfx-ui-click');
    },
    [audioEngine],
  );

  const startRaceFlow = useCallback(() => {
    audioEngine.unlock();
    finishCommittedRef.current = false;
    setPaused(false);
    setTelemetry(INITIAL_TELEMETRY);
    setResetToken((n) => n + 1);
    setScreen('race');
  }, [audioEngine, setScreen]);

  const handleRestartRace = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playSfx('sfx-ui-confirm');
    finishCommittedRef.current = false;
    setPaused(false);
    setTelemetry(INITIAL_TELEMETRY);
    setResetToken((n) => n + 1);
    setScreen('race');
  }, [audioEngine, setScreen]);

  const handleTogglePause = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playSfx('sfx-ui-click');
    const next = !paused;
    setPaused(next);
    setScreen(next ? 'pause' : 'race');
  }, [audioEngine, paused, setScreen]);

  const handleRecoverKart = useCallback(() => {
    audioEngine.unlock();
    audioEngine.playSfx('sfx-ui-click');
    inputManager.triggerRecoverOnce();
  }, [audioEngine, inputManager]);

  const handleToggleMute = useCallback(() => {
    audioEngine.unlock();
    updateSettings({
      audio: {
        ...settings.audio,
        muted: !settings.audio.muted,
      },
    });
  }, [audioEngine, settings.audio, updateSettings]);

  const handleExitToMenu = useCallback(() => {
    audioEngine.unlock();
    audioEngine.stopRaceAudio();
    setPaused(false);
    clearChampionship();
    setScreen('main-menu');
  }, [audioEngine, clearChampionship, setScreen]);

  const handleAdvanceChampionship = useCallback(() => {
    advanceChampionshipRace();
    finishCommittedRef.current = false;
    setPaused(false);
    setTelemetry(INITIAL_TELEMETRY);
    setResetToken((n) => n + 1);
    setScreen('race');
  }, [advanceChampionshipRace, setScreen]);

  const handleTelemetry = useCallback(
    (snap: FullHudSnapshot) => {
      setTelemetry(snap);
      if (snap.finished && !finishCommittedRef.current) {
        finishCommittedRef.current = true;
        commitRaceOutcome({
          trackId: selectedTrackId,
          playerRank: snap.rank,
          totalRaceTimeMs: snap.raceTimeMs,
          bestLapMs: snap.bestLapMs,
          lapTimesMs: snap.lapTimesMs,
          standings: snap.standings,
          driftsCompleted: snap.driftsCompleted,
          turbosTriggered: snap.turbosTriggered,
          itemsUsed: snap.itemsUsed,
        });
        setScreen('results');
      }
    },
    [commitRaceOutcome, selectedTrackId, setScreen],
  );

  const handleUserGesture = useCallback(() => {
    audioEngine.unlock();
  }, [audioEngine]);

  const isRaceActiveScreen =
    screen === 'race' ||
    screen === 'pause' ||
    (screen === 'settings' && (previousScreen === 'race' || previousScreen === 'pause'));

  const sceneMode: SceneStageMode =
    screen === 'character-select' || screen === 'kart-select'
      ? 'showcase'
      : screen === 'podium'
        ? 'podium'
        : isRaceActiveScreen
          ? 'race'
          : 'menu-bg';

  const phaseRequest: RacePhase = sceneMode === 'race' ? 'countdown' : 'intro';

  const podiumRoster = useMemo(() => {
    const source = championship ? championship.standings : lastRaceResult?.standings ?? [];
    return source.slice(0, 3).map((entry, idx) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      characterId: entry.characterId as CharacterId,
      name: entry.name,
    }));
  }, [championship, lastRaceResult]);

  const characterDef = getCharacterById(selectedCharacterId);
  const trackDef = getTrackById(selectedTrackId);
  const characterIconPath = manifest
    ? resolveAssetPath(manifest, characterDef.iconAssetId)
    : publicUrl('/assets/ui/icon_nilo.png');

  const championshipRoundLabel =
    mode === 'championship' && championship
      ? `ETAPA ${Math.min(championship.trackIds.length, championship.completedRaces + 1)}/${championship.trackIds.length}`
      : null;

  return (
    <main className="kl-app">
      {!manifest || manifestError || screen === 'loading' ? (
        <LoadingScreen manifestError={manifestError} />
      ) : (
        <>
          <SceneErrorBoundary>
            <RaceScene
              sceneMode={sceneMode}
              phaseRequest={phaseRequest}
              paused={paused || screen !== 'race'}
              canTogglePause={screen === 'race' || screen === 'pause'}
              resetToken={resetToken}
              audioEngine={audioEngine}
              inputManager={inputManager}
              podiumRoster={podiumRoster}
              onTelemetry={handleTelemetry}
              onStageSync={setStageSync}
              onPauseToggle={handleTogglePause}
            />
          </SceneErrorBoundary>

          {screen === 'main-menu' && <MainMenuScreen onPlaySfx={playUiSfx} />}
          {screen === 'mode-select' && <ModeSelectScreen onPlaySfx={playUiSfx} />}
          {screen === 'character-select' && <CharacterSelectScreen onPlaySfx={playUiSfx} />}
          {screen === 'kart-select' && <KartSelectScreen onPlaySfx={playUiSfx} />}
          {screen === 'cup-select' && <CupSelectScreen onPlaySfx={playUiSfx} />}
          {screen === 'track-select' && <TrackSelectScreen onPlaySfx={playUiSfx} />}
          {screen === 'difficulty-select' && (
            <DifficultySelectScreen onPlaySfx={playUiSfx} onStartRace={startRaceFlow} />
          )}
          {(screen === 'race' || screen === 'pause') && (
            <RaceHud
              mode={mode}
              trackName={trackDef.name}
              characterName={characterDef.name}
              characterIconPath={characterIconPath}
              manifest={manifest}
              phase={stageSync.phase}
              countdownLabel={stageSync.countdownLabel}
              paused={paused || screen === 'pause'}
              selectedTrackId={selectedTrackId}
              championshipRoundLabel={championshipRoundLabel}
              muted={settings.audio.muted}
              telemetry={telemetry}
              inputManager={inputManager}
              touchControlsVisible={touchControlsVisible}
              touchAutoAccelerate={settings.touch.autoAccelerate}
              onUserGesture={handleUserGesture}
              onRecoverKart={handleRecoverKart}
              onRestartRace={handleRestartRace}
              onTogglePause={handleTogglePause}
              onToggleMute={handleToggleMute}
              onOpenSettings={openSettings}
              onExitToMenu={handleExitToMenu}
            />
          )}
          {screen === 'settings' && <SettingsScreen onPlaySfx={playUiSfx} />}
          {screen === 'results' && (
            <ResultsScreen
              onPlaySfx={playUiSfx}
              onRestartRace={handleRestartRace}
              onAdvanceChampionship={handleAdvanceChampionship}
            />
          )}
          {screen === 'podium' && <PodiumScreen onPlaySfx={playUiSfx} />}
          {screen === 'progression' && <ProgressionScreen onPlaySfx={playUiSfx} />}
        </>
      )}
    </main>
  );
}
