import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../app/store';
import { getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { RaceCamera } from '../game/camera/RaceCamera';
import { disposeObject3D, resolveAssetPath } from '../game/core/assetLoader';
import { DEFAULT_LAPS, FIXED_TIMESTEP } from '../game/core/constants';
import { InputManager } from '../game/input/inputManager';
import { computeKartPhysicsProfile } from '../game/physics/kartController';
import { type RacePhase, RaceProgressTracker, createInitialRacerState } from '../game/racing/raceManager';
import { PORTO_DAS_LANTERNAS_LAYOUT } from '../game/tracks/portoDasLanternas';
import { yawFromTangent } from '../game/tracks/trackGeometry';
import { KartEntity, type KartHudTelemetry, type LiveKartPose } from '../game/vehicles/KartEntity';

export interface RaceStageSync {
  phase: RacePhase;
  countdownLabel: string | null;
}

export interface RaceSceneProps {
  phaseRequest: RacePhase;
  paused: boolean;
  resetToken: number;
  onTelemetry: (telemetry: KartHudTelemetry) => void;
  onStageSync: (sync: RaceStageSync) => void;
  onPauseToggle: () => void;
}

function CoastalSunsetSky() {
  return (
    <group>
      <color attach="background" args={['#2b6cb0']} />
      <fog attach="fog" args={['#f6ad55', 110, 320]} />
      {/* Warm sunset sky dome */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[360, 24, 16]} />
        <meshBasicMaterial side={THREE.BackSide} color="#3b82f6" fog={false} />
      </mesh>
      {/* Distant golden sunset sun disc */}
      <mesh position={[-240, 64, -180]}>
        <sphereGeometry args={[18, 16, 16]} />
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

  // Generate fixed Rapier stone wall colliders matching left & right track boundaries
  const wallColliders = useMemo(() => {
    const samples = PORTO_DAS_LANTERNAS_LAYOUT.samples;
    const step = 4;
    const segments: Array<{
      key: string;
      pos: [number, number, number];
      rotY: number;
      halfLength: number;
    }> = [];

    for (let i = 0; i < samples.length; i += step) {
      const curr = samples[i];
      const next = samples[(i + step) % samples.length];
      const segLen = Math.hypot(
        next.point.x - curr.point.x,
        next.point.z - curr.point.z,
      );
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

function RaceWorldContent({
  phaseRequest,
  paused,
  resetToken,
  onTelemetry,
  onStageSync,
  onPauseToggle,
}: RaceSceneProps) {
  const manifest = useGameStore((s) => s.manifest);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const settings = useGameStore((s) => s.settings);

  const characterDef = getCharacterById(selectedCharacterId);
  const kartDef = getKartById(selectedKartId);
  const profile = useMemo(
    () => computeKartPhysicsProfile(kartDef, characterDef),
    [kartDef, characterDef],
  );

  const assetPaths = useMemo(() => {
    if (!manifest) {
      return {
        character: '/assets/characters/nilo.glb',
        kart: '/assets/karts/trilha_raposa.glb',
        track: '/assets/tracks/porto_das_lanternas.glb',
      };
    }
    return {
      character: resolveAssetPath(manifest, characterDef.modelAssetId),
      kart: resolveAssetPath(manifest, kartDef.modelAssetId),
      track: resolveAssetPath(manifest, 'track-porto-das-lanternas'),
    };
  }, [manifest, characterDef.modelAssetId, kartDef.modelAssetId]);

  const startSlot = PORTO_DAS_LANTERNAS_LAYOUT.startGridSlots[0];

  const trackerRef = useRef(
    new RaceProgressTracker(
      PORTO_DAS_LANTERNAS_LAYOUT,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
    ),
  );
  const racerStateRef = useRef(createInitialRacerState(DEFAULT_LAPS));
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

  // Handle resetToken changes or phase switches from UI
  useEffect(() => {
    const freshTracker = new RaceProgressTracker(
      PORTO_DAS_LANTERNAS_LAYOUT,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
    );
    if (phaseRequest === 'countdown') {
      freshTracker.startCountdown();
    }
    trackerRef.current = freshTracker;
    racerStateRef.current = freshTracker.createRacerState();
    onStageSync({
      phase: freshTracker.phase,
      countdownLabel: freshTracker.phase === 'countdown' ? '3' : null,
    });
  }, [resetToken, phaseRequest, onStageSync]);

  const lastSyncRef = useRef<string>('');
  const goFlashTimerRef = useRef(0);

  useFrame((_state, delta) => {
    const pausePressed = inputManagerRef.current.consumePausePressed();
    if (pausePressed && trackerRef.current.phase !== 'intro') {
      onPauseToggle();
    }

    const tracker = trackerRef.current;
    let countdownLabel: string | null = null;
    if (tracker.phase === 'countdown') {
      const n = Math.ceil(tracker.countdownRemainingSec);
      countdownLabel = n > 0 ? String(Math.min(3, n)) : 'JÁ!';
      goFlashTimerRef.current = 0.9;
    } else if (tracker.phase === 'racing' && goFlashTimerRef.current > 0) {
      goFlashTimerRef.current = Math.max(0, goFlashTimerRef.current - delta);
      countdownLabel = goFlashTimerRef.current > 0 ? 'JÁ!' : null;
    }

    const syncKey = `${tracker.phase}:${countdownLabel ?? ''}`;
    if (syncKey !== lastSyncRef.current) {
      lastSyncRef.current = syncKey;
      onStageSync({ phase: tracker.phase, countdownLabel });
    }
  });

  const pollKartInput = useCallback(() => {
    return inputManagerRef.current.pollKartOnly();
  }, []);

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
        <PortoTrackWorld trackModelPath={assetPaths.track} />
        <KartEntity
          kartModelPath={assetPaths.kart}
          characterModelPath={assetPaths.character}
          layout={PORTO_DAS_LANTERNAS_LAYOUT}
          profile={profile}
          startPosition={startSlot.position}
          startYaw={startSlot.yaw}
          trackerRef={trackerRef}
          racerStateRef={racerStateRef}
          pollInput={pollKartInput}
          poseRef={poseRef}
          onTelemetry={onTelemetry}
          paused={paused}
          resetToken={resetToken}
        />
      </Physics>

      <RaceCamera
        layout={PORTO_DAS_LANTERNAS_LAYOUT}
        poseRef={poseRef}
        trackerRef={trackerRef}
      />
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

useGLTF.preload('/assets/characters/nilo.glb');
useGLTF.preload('/assets/karts/trilha_raposa.glb');
useGLTF.preload('/assets/tracks/porto_das_lanternas.glb');
