import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../app/store';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { RaceCamera } from '../game/camera/RaceCamera';
import { disposeObject3D, resolveAssetPath } from '../game/core/assetLoader';
import { DEFAULT_LAPS, FIXED_TIMESTEP, FixedStepClock } from '../game/core/constants';
import type { CharacterId, KartId } from '../game/core/types';
import { InputManager } from '../game/input/inputManager';
import { RaceProgressTracker, type RacePhase } from '../game/racing/raceManager';
import { type FullHudSnapshot, RaceSimulation } from '../game/racing/raceSimulation';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { yawFromTangent } from '../game/tracks/trackGeometry';
import type { LiveKartPose } from '../game/vehicles/KartEntity';
import { RacerMeshInstance } from '../game/vehicles/RacerMeshInstance';

export interface RaceStageSync {
  phase: RacePhase;
  countdownLabel: string | null;
}

export interface RaceSceneProps {
  phaseRequest: RacePhase;
  paused: boolean;
  resetToken: number;
  audioEngine: GameAudioEngine;
  onTelemetry: (telemetry: FullHudSnapshot) => void;
  onStageSync: (sync: RaceStageSync) => void;
  onPauseToggle: () => void;
}

function CoastalSunsetSky() {
  return (
    <group>
      <color attach="background" args={['#2b6cb0']} />
      <fog attach="fog" args={['#f6ad55', 110, 320]} />
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[360, 20, 14]} />
        <meshBasicMaterial side={THREE.BackSide} color="#3b82f6" fog={false} />
      </mesh>
      <mesh position={[-240, 64, -180]}>
        <sphereGeometry args={[18, 14, 14]} />
        <meshBasicMaterial color="#fde68a" fog={false} />
      </mesh>
    </group>
  );
}

function PortoTrackWorld({ trackModelPath }: { trackModelPath: string }) {
  const gltf = useGLTF(trackModelPath);
  const trackScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const boatNodesRef = useRef<THREE.Object3D[]>([]);

  useEffect(() => {
    const boats: THREE.Object3D[] = [];
    const shadowCasterPrefixes = [
      'House_',
      'Lighthouse_',
      'Boat_',
      'Palm_',
      'Cypress_',
      'Market_',
      'TrackStartGantry',
      'Chevron_',
    ];
    trackScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        let shouldCast = false;
        let curr: THREE.Object3D | null = obj;
        while (curr) {
          if (shadowCasterPrefixes.some((p) => curr!.name.startsWith(p))) {
            shouldCast = true;
            break;
          }
          curr = curr.parent;
        }
        obj.castShadow = shouldCast;
        obj.receiveShadow = true;
      }
      if (obj.name.startsWith('Boat_')) {
        boats.push(obj);
      }
    });
    boatNodesRef.current = boats;
    return () => {
      disposeObject3D(trackScene);
      boatNodesRef.current = [];
    };
  }, [trackScene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const boats = boatNodesRef.current;
    for (let i = 0; i < boats.length; i += 1) {
      boats[i].position.y = -1.4 + Math.sin(t * 1.6 + i * 1.4) * 0.18;
      boats[i].rotation.z = Math.sin(t * 1.2 + i) * 0.04;
    }
  });

  const wallColliders = useMemo(() => {
    const samples = PORTO_DAS_LANTERNAS_LAYOUT.samples;
    const step = 6;
    const segments: Array<{
      key: string;
      pos: [number, number, number];
      rotY: number;
      halfLength: number;
    }> = [];

    for (let i = 0; i < samples.length; i += step) {
      const curr = samples[i];
      const next = samples[(i + step) % samples.length];
      const segLen = Math.hypot(next.point.x - curr.point.x, next.point.z - curr.point.z);
      const midX = (curr.point.x + next.point.x) * 0.5;
      const midY = (curr.point.y + next.point.y) * 0.5;
      const midZ = (curr.point.z + next.point.z) * 0.5;
      const rotY = yawFromTangent(curr.tangent);
      const wallOffset = PORTO_DAS_LANTERNAS_LAYOUT.wallMargin + 0.45;

      for (const side of [-1, 1] as const) {
        segments.push({
          key: `w_${i}_${side}`,
          pos: [
            midX + curr.right.x * side * wallOffset,
            midY + 0.8,
            midZ + curr.right.z * side * wallOffset,
          ],
          rotY,
          halfLength: segLen * 0.55,
        });
      }
    }
    return segments;
  }, []);

  return (
    <group>
      <primitive object={trackScene} />
      <RigidBody type="fixed" colliders={false} restitution={0.25} friction={0.1}>
        {wallColliders.map((seg) => (
          <CuboidCollider
            key={seg.key}
            args={[0.6, 1.4, seg.halfLength]}
            position={seg.pos}
            rotation={[0, seg.rotY, 0]}
          />
        ))}
      </RigidBody>
    </group>
  );
}

interface DynamicWorldItemsState {
  activeBoxes: Array<{ id: string; x: number; y: number; z: number }>;
  hazards: Array<{ id: string; x: number; y: number; z: number }>;
  projectiles: Array<{ id: string; x: number; y: number; z: number; yaw: number }>;
  winds: Array<{ id: string; x: number; y: number; z: number; scale: number; opacity: number }>;
}

function WorldItemsRenderer({
  simRef,
  paused,
}: {
  simRef: React.MutableRefObject<RaceSimulation>;
  paused: boolean;
}) {
  const itemBoxGltf = useGLTF('/assets/props/item_box.glb');
  const nevoaGltf = useGLTF('/assets/items/nevoa_prisma.glb');
  const faiscaGltf = useGLTF('/assets/items/faisca_rastreadora.glb');

  const [snapshot, setSnapshot] = useState<DynamicWorldItemsState>({
    activeBoxes: [],
    hazards: [],
    projectiles: [],
    winds: [],
  });
  const timerRef = useRef(0);
  const spinGroupRef = useRef<THREE.Group | null>(null);

  const boxClones = useMemo(
    () =>
      PORTO_DAS_LANTERNAS_LAYOUT.itemBoxZones.flat().map(() => itemBoxGltf.scene.clone(true)),
    [itemBoxGltf.scene],
  );
  const hazardClones = useMemo(
    () => Array.from({ length: 8 }, () => nevoaGltf.scene.clone(true)),
    [nevoaGltf.scene],
  );
  const projectileClones = useMemo(
    () => Array.from({ length: 8 }, () => faiscaGltf.scene.clone(true)),
    [faiscaGltf.scene],
  );

  useEffect(() => {
    return () => {
      boxClones.forEach(disposeObject3D);
      hazardClones.forEach(disposeObject3D);
      projectileClones.forEach(disposeObject3D);
    };
  }, [boxClones, hazardClones, projectileClones]);

  useFrame((state, delta) => {
    if (paused) return;
    if (spinGroupRef.current) {
      const t = state.clock.elapsedTime;
      spinGroupRef.current.children.forEach((child, i) => {
        child.rotation.y = t * 1.8 + i * 0.5;
        child.position.y = Math.sin(t * 3 + i) * 0.14;
      });
    }

    timerRef.current += delta;
    if (timerRef.current >= 0.05) {
      timerRef.current = 0;
      const items = simRef.current.items;
      setSnapshot({
        activeBoxes: items.boxes
          .filter((b) => b.active)
          .map((b) => ({ id: b.id, x: b.position.x, y: b.position.y, z: b.position.z })),
        hazards: items.hazards
          .slice(0, 8)
          .map((h) => ({ id: h.id, x: h.x, y: h.y, z: h.z })),
        projectiles: items.projectiles
          .slice(0, 8)
          .map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw })),
        winds: items.windPulses.map((w) => {
          const prog = w.age / w.maxAge;
          return {
            id: w.id,
            x: w.x,
            y: w.y,
            z: w.z,
            scale: 1 + prog * w.radius,
            opacity: Math.max(0, 0.75 * (1 - prog)),
          };
        }),
      });
    }
  });

  return (
    <group>
      <group ref={spinGroupRef}>
        {snapshot.activeBoxes.map((b, idx) => (
          <group key={b.id} position={[b.x, b.y, b.z]}>
            <primitive object={boxClones[idx % boxClones.length]} />
          </group>
        ))}
      </group>
      {snapshot.hazards.map((h, idx) => (
        <group key={h.id} position={[h.x, h.y, h.z]} scale={1.7}>
          <primitive object={hazardClones[idx]} />
        </group>
      ))}
      {snapshot.projectiles.map((p, idx) => (
        <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]} scale={1.25}>
          <primitive object={projectileClones[idx]} />
        </group>
      ))}
      {snapshot.winds.map((w) => (
        <mesh
          key={w.id}
          position={[w.x, w.y, w.z]}
          rotation={[-Math.PI * 0.5, 0, 0]}
          scale={w.scale}
        >
          <ringGeometry args={[0.78, 1.0, 24]} />
          <meshBasicMaterial color="#2dd4bf" transparent opacity={w.opacity} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

const FALLBACK_CHARACTER_PATHS: Record<CharacterId, string> = {
  nilo: '/assets/characters/nilo.glb',
  boro: '/assets/characters/boro.glb',
  lumi: '/assets/characters/lumi.glb',
  kora: '/assets/characters/kora.glb',
  tiko: '/assets/characters/tiko.glb',
  mavi: '/assets/characters/mavi.glb',
  runi: '/assets/characters/runi.glb',
  zera: '/assets/characters/zera.glb',
};

const FALLBACK_KART_PATHS: Record<KartId, string> = {
  'trilha-raposa': '/assets/karts/trilha_raposa.glb',
  'engrenagem-turbo': '/assets/karts/engrenagem_turbo.glb',
  'cometa-estelar': '/assets/karts/cometa_estelar.glb',
  'raiz-veloz': '/assets/karts/raiz_veloz.glb',
  'chave-mestra-gt': '/assets/karts/chave_mestra_gt.glb',
  'brisa-corsaria': '/assets/karts/brisa_corsaria.glb',
  'escorpiao-dourado': '/assets/karts/escorpiao_dourado.glb',
  'lamina-glacial': '/assets/karts/lamina_glacial.glb',
};

function RaceWorldContent({
  phaseRequest,
  paused,
  resetToken,
  audioEngine,
  onTelemetry,
  onStageSync,
  onPauseToggle,
}: RaceSceneProps) {
  const manifest = useGameStore((s) => s.manifest);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const difficulty = useGameStore((s) => s.difficulty);
  const settings = useGameStore((s) => s.settings);

  const trackModelPath = useMemo(
    () =>
      manifest
        ? resolveAssetPath(manifest, 'track-porto-das-lanternas')
        : '/assets/tracks/porto_das_lanternas.glb',
    [manifest],
  );

  // Align visual GLB models 1:1 with RaceSimulation's 8-racer roster order
  const racerAssetList = useMemo(() => {
    const playerChar = getCharacterById(selectedCharacterId);
    const playerKart = getKartById(selectedKartId);
    const aiChars = CHARACTERS.filter((c) => c.id !== playerChar.id).slice(0, 7);
    const roster = [
      { char: playerChar, kart: playerKart },
      ...aiChars.map((char) => ({ char, kart: getKartById(char.defaultKartId) })),
    ];

    return roster.map(({ char, kart }) => ({
      character: manifest
        ? resolveAssetPath(manifest, char.modelAssetId)
        : FALLBACK_CHARACTER_PATHS[char.id],
      kart: manifest ? resolveAssetPath(manifest, kart.modelAssetId) : FALLBACK_KART_PATHS[kart.id],
    }));
  }, [manifest, selectedCharacterId, selectedKartId]);

  const startSlot = PORTO_DAS_LANTERNAS_LAYOUT.startGridSlots[0];

  const simRef = useRef(
    new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      selectedCharacterId,
      selectedKartId,
      difficulty,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
    ),
  );
  const playerRapierRef = useRef<RapierRigidBody | null>(null);
  const clockRef = useRef(new FixedStepClock(FIXED_TIMESTEP));
  const telemetryTimerRef = useRef(0);
  const lastSyncRef = useRef<string>('');
  const goFlashTimerRef = useRef(0);

  const poseRef = useRef<LiveKartPose>({
    x: startSlot.position.x,
    y: startSlot.position.y,
    z: startSlot.position.z,
    yaw: startSlot.yaw,
    visualSlipYaw: 0,
    forwardSpeed: 0,
    boostActive: false,
    driftActive: false,
    steerAngle: 0,
    groundHeight: startSlot.position.y,
  });

  // Expose live phase tracker ref for RaceCamera (synced in useEffect)
  const trackerRef = useRef(
    new RaceProgressTracker(
      PORTO_DAS_LANTERNAS_LAYOUT,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
    ),
  );

  const inputManagerRef = useRef(
    new InputManager(
      settings.bindings,
      settings.steeringSensitivity,
      settings.gamepadDeadzone,
    ),
  );

  useEffect(() => {
    inputManagerRef.current.updateConfig(
      settings.bindings,
      settings.steeringSensitivity,
      settings.gamepadDeadzone,
    );
  }, [settings.bindings, settings.steeringSensitivity, settings.gamepadDeadzone]);

  useEffect(() => {
    const manager = inputManagerRef.current;
    manager.attach();
    return () => manager.detach();
  }, []);

  // Re-initialize full 8-racer simulation on restart or difficulty/mode reset
  useEffect(() => {
    const freshSim = new RaceSimulation(
      PORTO_DAS_LANTERNAS_LAYOUT,
      selectedCharacterId,
      selectedKartId,
      difficulty,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
    );
    if (phaseRequest === 'countdown') {
      freshSim.startCountdown();
      audioEngine.playMusic('music-race-aurora');
      audioEngine.playAmbience('sfx-ambience-coastal');
    } else if (phaseRequest === 'intro') {
      audioEngine.stopRaceAudio();
    }

    simRef.current = freshSim;
    trackerRef.current = freshSim.tracker;
    clockRef.current.reset();

    if (playerRapierRef.current) {
      playerRapierRef.current.setTranslation(
        { x: startSlot.position.x, y: startSlot.position.y, z: startSlot.position.z },
        true,
      );
      playerRapierRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    onStageSync({
      phase: freshSim.phase,
      countdownLabel: freshSim.phase === 'countdown' ? '3' : null,
    });
    onTelemetry(freshSim.buildHudSnapshot());
  }, [
    resetToken,
    phaseRequest,
    selectedCharacterId,
    selectedKartId,
    difficulty,
    audioEngine,
    onStageSync,
    onTelemetry,
    startSlot.position.x,
    startSlot.position.y,
    startSlot.position.z,
  ]);

  useFrame((_state, delta) => {
    const pausePressed = inputManagerRef.current.consumePausePressed();
    if (pausePressed && simRef.current.phase !== 'intro') {
      onPauseToggle();
    }

    if (paused) {
      audioEngine.updateEngineTelemetry(0, false, false, 0, false, false, false);
      return;
    }

    const sim = simRef.current;
    const playerInput = inputManagerRef.current.pollKartOnly();

    clockRef.current.advance(delta, (dt) => {
      const rapierBody = playerRapierRef.current;
      if (rapierBody && sim.player.sim.recoverTimer <= 0) {
        const pos = rapierBody.translation();
        sim.player.sim.x = pos.x;
        sim.player.sim.z = pos.z;
      }

      const prevRecover = sim.player.sim.recoverTimer;
      const events = sim.step(dt, playerInput);

      if (rapierBody) {
        const pSim = sim.player.sim;
        if (prevRecover <= 0 && pSim.recoverTimer > 0) {
          rapierBody.setTranslation({ x: pSim.x, y: pSim.y, z: pSim.z }, true);
          rapierBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          const cur = rapierBody.translation();
          const vyCorr = (pSim.y - cur.y) / dt;
          rapierBody.setLinvel({ x: pSim.vx, y: vyCorr, z: pSim.vz }, true);
        }
      }

      // Trigger discrete gameplay SFX
      if (events.countdownNumber !== null) audioEngine.playSfx('sfx-countdown-beep');
      if (events.raceStartedNow) audioEngine.playSfx('sfx-countdown-go');
      if (events.playerDriftTierUp !== null) {
        audioEngine.playSfx('sfx-drift-spark', 0.9 + events.playerDriftTierUp * 0.14);
      }
      if (events.playerTurboTriggered) audioEngine.playSfx('sfx-turbo-boost');
      if (events.playerCollision) audioEngine.playSfx('sfx-collision-hit');
      if (events.playerJumped) audioEngine.playSfx('sfx-jump-launch');
      if (events.playerLanded) audioEngine.playSfx('sfx-land-thud');
      if (events.playerItemPickup) audioEngine.playSfx('sfx-item-pickup');
      if (events.playerItemUsed) audioEngine.playSfx('sfx-item-use');
      if (events.playerLapCompleted) audioEngine.playSfx('sfx-lap-complete');
      if (events.playerFinishedNow) {
        audioEngine.playSfx('sfx-race-finish');
        audioEngine.stopAmbience();
        audioEngine.playMusic(sim.player.rank <= 3 ? 'music-victory' : 'music-defeat', false);
      }
    });

    // Update continuous engine & drift screech audio
    const pSim = sim.player.sim;
    audioEngine.updateEngineTelemetry(
      Math.abs(pSim.forwardSpeed) * 3.6,
      playerInput.throttle > 0.1,
      playerInput.brake > 0.1,
      pSim.driftTier,
      pSim.driftActive,
      pSim.boostTimer > 0,
      sim.phase === 'racing' && !sim.player.race.finished,
    );

    // Sync Countdown / Phase transitions cleanly
    let countdownLabel: string | null = null;
    if (sim.phase === 'countdown') {
      const n = Math.ceil(sim.tracker.countdownRemainingSec);
      countdownLabel = n > 0 ? String(Math.min(3, n)) : 'JÁ!';
      goFlashTimerRef.current = 0.9;
    } else if (sim.phase === 'racing' && goFlashTimerRef.current > 0) {
      goFlashTimerRef.current = Math.max(0, goFlashTimerRef.current - delta);
      countdownLabel = goFlashTimerRef.current > 0 ? 'JÁ!' : null;
    }

    const syncKey = `${sim.phase}:${countdownLabel ?? ''}`;
    if (syncKey !== lastSyncRef.current) {
      lastSyncRef.current = syncKey;
      onStageSync({ phase: sim.phase, countdownLabel });
    }

    telemetryTimerRef.current += delta;
    if (telemetryTimerRef.current >= 0.05) {
      telemetryTimerRef.current = 0;
      onTelemetry(sim.buildHudSnapshot());
    }
  });

  return (
    <>
      <CoastalSunsetSky />
      <ambientLight intensity={0.62} color="#fde68a" />
      <hemisphereLight args={['#93c5fd', '#78350f', 0.45]} />
      <directionalLight
        position={[-95, 78, -60]}
        intensity={2.1}
        color="#ffedd5"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={5}
        shadow-camera-far={260}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
      />

      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#fed7aa"
          position={[-40, 24, -40]}
          scale={[60, 20, 1]}
          rotation={[Math.PI / 5, Math.PI / 4, 0]}
        />
        <Lightformer
          form="ring"
          intensity={1.4}
          color="#60a5fa"
          position={[30, 18, 25]}
          scale={20}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#fb923c"
          position={[0, -10, 0]}
          scale={[60, 60, 1]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </Environment>

      <Physics gravity={[0, -28, 0]} timeStep={FIXED_TIMESTEP}>
        <PortoTrackWorld trackModelPath={trackModelPath} />
        <WorldItemsRenderer simRef={simRef} paused={paused} />
        {racerAssetList.map((racerAsset, idx) => (
          <RacerMeshInstance
            key={idx}
            racerIndex={idx}
            simRef={simRef}
            kartModelPath={racerAsset.kart}
            characterModelPath={racerAsset.character}
            poseRef={idx === 0 ? poseRef : undefined}
            onPlayerRapierSync={
              idx === 0
                ? (body) => {
                    playerRapierRef.current = body;
                  }
                : undefined
            }
            paused={paused}
          />
        ))}
      </Physics>

      <RaceCamera layout={PORTO_DAS_LANTERNAS_LAYOUT} poseRef={poseRef} trackerRef={trackerRef} />
    </>
  );
}

export function RaceScene(props: RaceSceneProps) {
  const quality = useGameStore((s) => s.settings.quality);
  const dpr: [number, number] =
    quality === 'low' ? [1, 1] : quality === 'medium' ? [1, 1.25] : [1, 1.5];

  return (
    <div className="kl-canvas-wrap">
      <Canvas
        shadows="basic"
        dpr={dpr}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
        camera={{ position: [0, 6, 52], fov: 56, near: 0.25, far: 500 }}
      >
        <Suspense fallback={null}>
          <RaceWorldContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}

for (const charPath of Object.values(FALLBACK_CHARACTER_PATHS)) {
  useGLTF.preload(charPath);
}
for (const kartPath of Object.values(FALLBACK_KART_PATHS)) {
  useGLTF.preload(kartPath);
}
useGLTF.preload('/assets/tracks/porto_das_lanternas.glb');
useGLTF.preload('/assets/props/item_box.glb');
useGLTF.preload('/assets/items/nevoa_prisma.glb');
useGLTF.preload('/assets/items/faisca_rastreadora.glb');
