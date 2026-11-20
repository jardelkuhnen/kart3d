import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF, useTexture } from '@react-three/drei';
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../app/store';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { getTrackById } from '../data/tracks';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { RaceCamera } from '../game/camera/RaceCamera';
import { disposeObject3D, resolveAssetPath } from '../game/core/assetLoader';
import { publicUrl } from '../game/core/publicUrl';
import { DEFAULT_LAPS, FIXED_TIMESTEP, FixedStepClock } from '../game/core/constants';
import { clampCanvasDpr, detectMobileDevice } from '../game/core/mobile';
import type { CharacterId, KartId } from '../game/core/types';
import type { InputManager } from '../game/input/inputManager';
import { RaceProgressTracker, type RacePhase } from '../game/racing/raceManager';
import { type FullHudSnapshot, RaceSimulation } from '../game/racing/raceSimulation';
import {
  FALLBACK_TRACK_GLB_PATHS,
  getTrackLayout,
  getTrackVisualTheme,
} from '../game/tracks/registry';
import {
  type TrackLayoutDef,
  type TrackVisualTheme,
  evaluateMovingHazardPos,
  yawFromTangent,
} from '../game/tracks/trackGeometry';
import type { LiveKartPose } from '../game/vehicles/KartEntity';
import { RacerMeshInstance } from '../game/vehicles/RacerMeshInstance';
import { RaceVfxSystem } from '../game/vfx/VfxSystem';
import { QUALITY_PRESETS } from '../game/vfx/vfxConfig';
import {
  GarageShowcaseStage,
  PodiumCeremonyStage,
  type PodiumRacerStageEntry,
} from './ShowcaseStages';

export type SceneStageMode = 'menu-bg' | 'showcase' | 'race' | 'podium';

export interface RaceStageSync {
  phase: RacePhase;
  countdownLabel: string | null;
}

export interface RaceSceneProps {
  sceneMode: SceneStageMode;
  phaseRequest: RacePhase;
  paused: boolean;
  resetToken: number;
  audioEngine: GameAudioEngine;
  inputManager: InputManager;
  podiumRoster?: ReadonlyArray<{ rank: 1 | 2 | 3; characterId: CharacterId; name: string }>;
  onTelemetry: (telemetry: FullHudSnapshot) => void;
  onStageSync: (sync: RaceStageSync) => void;
  onPauseToggle: () => void;
}

function StormLightningFlash() {
  const flashLightRef = useRef<THREE.DirectionalLight | null>(null);

  useFrame((state) => {
    const light = flashLightRef.current;
    if (!light) return;
    const t = state.clock.elapsedTime;
    const gate = Math.sin(t * 1.45) > 0.72 && Math.sin(t * 23.0) > 0.78;
    light.intensity = gate ? 5.2 : 0;
  });

  return <directionalLight ref={flashLightRef} position={[65, 95, -35]} color="#e0e7ff" intensity={0} />;
}

function TrackSkyEnvironment({ theme }: { theme: TrackVisualTheme }) {
  const starGeo = useMemo(() => {
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.39996;
      const elev = 0.25 + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.65;
      const r = 310;
      const y = Math.abs(elev) * r;
      const horiz = Math.sqrt(Math.max(0, r * r - y * y));
      positions[i * 3] = Math.cos(a) * horiz;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * horiz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      starGeo.dispose();
    };
  }, [starGeo]);

  return (
    <group>
      <color attach="background" args={[theme.skyHorizonColor]} />
      <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[360, 20, 14]} />
        <meshBasicMaterial side={THREE.BackSide} color={theme.skyTopColor} fog={false} />
      </mesh>
      <mesh position={[theme.sunPosition[0], theme.sunPosition[1], theme.sunPosition[2]]}>
        <sphereGeometry args={[18, 14, 14]} />
        <meshBasicMaterial color={theme.sunColor} fog={false} />
      </mesh>
      {theme.hasStarfield && (
        <points geometry={starGeo}>
          <pointsMaterial color="#e0f2fe" size={2.2} sizeAttenuation={false} fog={false} />
        </points>
      )}
      {theme.hasLightning && <StormLightningFlash />}
    </group>
  );
}

const SHADOW_CASTER_PREFIXES = [
  'House_',
  'Lighthouse_',
  'Boat_',
  'Palm_',
  'Cypress_',
  'Market_',
  'TrackStartGantry',
  'Chevron_',
  'GiantTree_',
  'Crystal_',
  'Waterfall_',
  'Windmill_',
  'Barn_',
  'Pine_',
  'MesaArch_',
  'RuinPillar_',
  'Cactus_',
  'Rock_',
  'Skyscraper_',
  'NeonArch_',
  'NeonBoard_',
  'Glacier_',
  'SnowPine_',
  'AuroraPillar_',
  'SkyGazebo_',
  'SkyRing_',
  'CastleTower_',
  'StormArch_',
  'LightningSpire_',
];

function TrackWorld({
  layout,
  trackModelPath,
}: {
  layout: TrackLayoutDef;
  trackModelPath: string;
}) {
  const gltf = useGLTF(trackModelPath);
  const trackScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const boatNodesRef = useRef<THREE.Object3D[]>([]);
  const windmillNodesRef = useRef<THREE.Object3D[]>([]);

  useEffect(() => {
    const boats: THREE.Object3D[] = [];
    const windmills: THREE.Object3D[] = [];

    trackScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        let shouldCast = false;
        let curr: THREE.Object3D | null = obj;
        while (curr) {
          if (SHADOW_CASTER_PREFIXES.some((p) => curr!.name.startsWith(p))) {
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
      if (obj.name.startsWith('WindmillBlades_')) {
        windmills.push(obj);
      }
    });
    boatNodesRef.current = boats;
    windmillNodesRef.current = windmills;
    return () => {
      disposeObject3D(trackScene);
      boatNodesRef.current = [];
      windmillNodesRef.current = [];
    };
  }, [trackScene]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const boats = boatNodesRef.current;
    for (let i = 0; i < boats.length; i += 1) {
      boats[i].position.y = -1.4 + Math.sin(t * 1.6 + i * 1.4) * 0.18;
      boats[i].rotation.z = Math.sin(t * 1.2 + i) * 0.04;
    }

    const windmills = windmillNodesRef.current;
    const spinStep = Math.min(delta, 0.05) * 1.35;
    for (let i = 0; i < windmills.length; i += 1) {
      windmills[i].rotation.z += spinStep;
    }
  });

  const wallColliders = useMemo(() => {
    const samples = layout.samples;
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
      const segDx = next.point.x - curr.point.x;
      const segDz = next.point.z - curr.point.z;
      const segLen = Math.hypot(segDx, segDz);
      if (segLen < 0.05) continue;

      const segTx = segDx / segLen;
      const segTz = segDz / segLen;
      // Right vector matching trackGeometry (+Y up): tangent x (0, 1, 0) = (-tz, 0, tx)
      const segRx = -segTz;
      const segRz = segTx;

      const midX = (curr.point.x + next.point.x) * 0.5;
      const midY = (curr.point.y + next.point.y) * 0.5;
      const midZ = (curr.point.z + next.point.z) * 0.5;
      const rotY = yawFromTangent({ x: segTx, y: 0, z: segTz });
      // Keep outer safety collider outside arcade wall-slide boundary (wallMargin - 0.95 + ballRadius 0.88)
      const wallOffset = layout.wallMargin + 1.15;

      for (const side of [-1, 1] as const) {
        const wx = midX + segRx * side * wallOffset;
        const wz = midZ + segRz * side * wallOffset;

        // Leave open gaps across shortcut entrances & exits
        let blocksShortcut = false;
        for (const sc of layout.shortcuts) {
          const clearanceSq = (sc.halfWidth + 4.5) * (sc.halfWidth + 4.5);
          for (const scSample of sc.samples) {
            const dx = wx - scSample.point.x;
            const dz = wz - scSample.point.z;
            if (dx * dx + dz * dz <= clearanceSq && Math.abs(scSample.point.y - midY) < 4.5) {
              blocksShortcut = true;
              break;
            }
          }
          if (blocksShortcut) break;
        }
        if (blocksShortcut) continue;

        segments.push({
          key: `w_${i}_${side}`,
          pos: [wx, midY + 0.8, wz],
          rotY,
          halfLength: segLen * 0.5,
        });
      }
    }
    return segments;
  }, [layout]);

  return (
    <group>
      <primitive object={trackScene} />
      <RigidBody type="fixed" colliders={false} restitution={0.1} friction={0}>
        {wallColliders.map((seg) => (
          <CuboidCollider
            key={seg.key}
            args={[0.5, 1.4, seg.halfLength]}
            position={seg.pos}
            rotation={[0, seg.rotY, 0]}
          />
        ))}
      </RigidBody>
    </group>
  );
}

function MovingTrackHazards({
  layout,
  simRef,
}: {
  layout: TrackLayoutDef;
  simRef: React.MutableRefObject<RaceSimulation>;
}) {
  const hazardRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame(() => {
    const timeSec = simRef.current.tracker.raceElapsedMs * 0.001;
    for (let i = 0; i < layout.movingHazards.length; i += 1) {
      const grp = hazardRefs.current[i];
      if (!grp) continue;
      const pos = evaluateMovingHazardPos(layout.movingHazards[i], timeSec);
      grp.position.set(pos.x, pos.y, pos.z);
    }
  });

  if (layout.movingHazards.length === 0) return null;

  return (
    <group>
      {layout.movingHazards.map((h, idx) => (
        <group
          key={h.id}
          ref={(el) => {
            hazardRefs.current[idx] = el;
          }}
          position={[h.position.x, h.position.y, h.position.z]}
          rotation={[0, h.yaw, 0]}
        >
          {h.style === 'neon-barrier' ? (
            <>
              <mesh position={[0, 1.0, 0]}>
                <cylinderGeometry args={[0.55, 0.72, 2.0, 12]} />
                <meshStandardMaterial
                  color="#ec4899"
                  emissive="#f43f5e"
                  emissiveIntensity={1.4}
                  roughness={0.25}
                />
              </mesh>
              <mesh position={[0, 2.25, 0]}>
                <octahedronGeometry args={[0.5, 0]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 1.35, 0]}>
                <boxGeometry args={[2.3, 2.7, 0.85]} />
                <meshStandardMaterial
                  color="#374151"
                  metalness={0.6}
                  roughness={0.4}
                />
              </mesh>
              <mesh position={[0, 1.35, 0]}>
                <octahedronGeometry args={[0.75, 0]} />
                <meshBasicMaterial color="#a78bfa" />
              </mesh>
            </>
          )}
        </group>
      ))}
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
  layout,
  simRef,
  paused,
}: {
  layout: TrackLayoutDef;
  simRef: React.MutableRefObject<RaceSimulation>;
  paused: boolean;
}) {
  const itemBoxGltf = useGLTF(publicUrl('/assets/props/item_box.glb'));
  const nevoaGltf = useGLTF(publicUrl('/assets/items/nevoa_prisma.glb'));
  const faiscaGltf = useGLTF(publicUrl('/assets/items/faisca_rastreadora.glb'));

  const [snapshot, setSnapshot] = useState<DynamicWorldItemsState>({
    activeBoxes: [],
    hazards: [],
    projectiles: [],
    winds: [],
  });
  const timerRef = useRef(0);
  const spinGroupRef = useRef<THREE.Group | null>(null);

  const boxClones = useMemo(
    () => layout.itemBoxZones.flat().map(() => itemBoxGltf.scene.clone(true)),
    [itemBoxGltf.scene, layout],
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
  nilo: publicUrl('/assets/characters/nilo.glb'),
  boro: publicUrl('/assets/characters/boro.glb'),
  lumi: publicUrl('/assets/characters/lumi.glb'),
  kora: publicUrl('/assets/characters/kora.glb'),
  tiko: publicUrl('/assets/characters/tiko.glb'),
  mavi: publicUrl('/assets/characters/mavi.glb'),
  runi: publicUrl('/assets/characters/runi.glb'),
  zera: publicUrl('/assets/characters/zera.glb'),
};

const FALLBACK_KART_PATHS: Record<KartId, string> = {
  'trilha-raposa': publicUrl('/assets/karts/trilha_raposa.glb'),
  'engrenagem-turbo': publicUrl('/assets/karts/engrenagem_turbo.glb'),
  'cometa-estelar': publicUrl('/assets/karts/cometa_estelar.glb'),
  'raiz-veloz': publicUrl('/assets/karts/raiz_veloz.glb'),
  'chave-mestra-gt': publicUrl('/assets/karts/chave_mestra_gt.glb'),
  'brisa-corsaria': publicUrl('/assets/karts/brisa_corsaria.glb'),
  'escorpiao-dourado': publicUrl('/assets/karts/escorpiao_dourado.glb'),
  'lamina-glacial': publicUrl('/assets/karts/lamina_glacial.glb'),
};

function RaceWorldContent({
  sceneMode,
  phaseRequest,
  paused,
  resetToken,
  audioEngine,
  inputManager,
  onTelemetry,
  onStageSync,
  onPauseToggle,
}: Omit<RaceSceneProps, 'podiumRoster'>) {
  const manifest = useGameStore((s) => s.manifest);
  const mode = useGameStore((s) => s.mode);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);
  const difficulty = useGameStore((s) => s.difficulty);
  const settings = useGameStore((s) => s.settings);

  const trackDef = getTrackById(selectedTrackId);
  const layout = getTrackLayout(selectedTrackId);
  const visualTheme = getTrackVisualTheme(selectedTrackId);
  const isSoloMode = mode === 'time-trial' || mode === 'practice';

  const trackModelPath = useMemo(
    () =>
      manifest
        ? resolveAssetPath(manifest, trackDef.modelAssetId)
        : FALLBACK_TRACK_GLB_PATHS[selectedTrackId],
    [manifest, trackDef.modelAssetId, selectedTrackId],
  );

  // Align visual GLB models 1:1 with RaceSimulation roster order (8 or 1 solo racer)
  const racerAssetList = useMemo(() => {
    const playerChar = getCharacterById(selectedCharacterId);
    const playerKart = getKartById(selectedKartId);
    const aiChars = isSoloMode
      ? []
      : CHARACTERS.filter((c) => c.id !== playerChar.id).slice(0, 7);
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
  }, [manifest, selectedCharacterId, selectedKartId, isSoloMode]);

  const startSlot = layout.startGridSlots[0];

  const simRef = useRef(
    new RaceSimulation(
      layout,
      selectedCharacterId,
      selectedKartId,
      difficulty,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
      mode,
    ),
  );
  const playerRapierRef = useRef<RapierRigidBody | null>(null);
  const syncPlayerRapier = useCallback((body: RapierRigidBody | null) => {
    playerRapierRef.current = body;
    if (body) {
      const pSim = simRef.current.player.sim;
      body.setTranslation({ x: pSim.x, y: pSim.y, z: pSim.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, []);
  const clockRef = useRef(new FixedStepClock(FIXED_TIMESTEP));
  const telemetryTimerRef = useRef(0);
  const lastSyncRef = useRef<string>('');
  const goFlashTimerRef = useRef(0);
  const recoverQueuedRef = useRef(false);

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
      layout,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
    ),
  );

  // Re-initialize full simulation on mode/track/character/kart/difficulty/reset
  useEffect(() => {
    const freshSim = new RaceSimulation(
      layout,
      selectedCharacterId,
      selectedKartId,
      difficulty,
      DEFAULT_LAPS,
      phaseRequest !== 'intro',
      mode,
    );
    if (sceneMode === 'race' && phaseRequest === 'countdown') {
      freshSim.startCountdown();
      audioEngine.playMusic(visualTheme.musicAssetId);
      audioEngine.playAmbience(visualTheme.ambienceAssetId);
    } else if (phaseRequest === 'intro') {
      audioEngine.stopAmbience();
      audioEngine.updateEngineTelemetry(0, false, false, 0, false, false, false);
    }

    simRef.current = freshSim;
    trackerRef.current = freshSim.tracker;
    clockRef.current.reset();

    poseRef.current = {
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
    };

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
    sceneMode,
    mode,
    phaseRequest,
    selectedCharacterId,
    selectedKartId,
    selectedTrackId,
    difficulty,
    layout,
    visualTheme.musicAssetId,
    visualTheme.ambienceAssetId,
    audioEngine,
    onStageSync,
    onTelemetry,
    startSlot.position.x,
    startSlot.position.y,
    startSlot.position.z,
    startSlot.yaw,
  ]);

  useFrame((_state, delta) => {
    const pausePressed = inputManager.consumePausePressed();
    if (pausePressed && sceneMode === 'race' && simRef.current.phase !== 'intro') {
      onPauseToggle();
    }

    if (paused) {
      audioEngine.updateEngineTelemetry(0, false, false, 0, false, false, false);
      return;
    }

    const sim = simRef.current;
    const playerInput = inputManager.pollKartOnly();
    if (playerInput.recover) {
      recoverQueuedRef.current = true;
    }

    clockRef.current.advance(delta, (dt) => {
      const stepInput = recoverQueuedRef.current ? { ...playerInput, recover: true } : playerInput;
      recoverQueuedRef.current = false;

      const rapierBody = playerRapierRef.current;
      const prevRecover = sim.player.sim.recoverTimer;
      const events = sim.step(dt, stepInput);

      if (rapierBody) {
        const pSim = sim.player.sim;
        const cur = rapierBody.translation();
        const driftDist = Math.hypot(cur.x - pSim.x, cur.z - pSim.z);
        if (
          (prevRecover <= 0 && pSim.recoverTimer > 0) ||
          events.playerPositionCorrected ||
          driftDist > 0.35
        ) {
          rapierBody.setTranslation({ x: pSim.x, y: pSim.y, z: pSim.z }, true);
          rapierBody.setLinvel(
            pSim.recoverTimer > 0 ? { x: 0, y: 0, z: 0 } : { x: pSim.vx, y: 0, z: pSim.vz },
            true,
          );
        } else {
          const vxCorr = pSim.vx + (pSim.x - cur.x) * 12;
          const vyCorr = (pSim.y - cur.y) / dt;
          const vzCorr = pSim.vz + (pSim.z - cur.z) * 12;
          rapierBody.setLinvel({ x: vxCorr, y: vyCorr, z: vzCorr }, true);
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

  const qualityPreset = QUALITY_PRESETS[settings.quality];

  return (
    <>
      <TrackSkyEnvironment theme={visualTheme} />
      <ambientLight intensity={0.58} color={visualTheme.sunColor} />
      <hemisphereLight
        args={[visualTheme.hemiSkyColor, visualTheme.hemiGroundColor, visualTheme.hemiIntensity * 0.55]}
      />
      <directionalLight
        position={[-95, 78, -60]}
        intensity={visualTheme.sunIntensity}
        color={visualTheme.sunColor}
        castShadow={qualityPreset.shadowsEnabled}
        shadow-mapSize-width={qualityPreset.shadowMapSize}
        shadow-mapSize-height={qualityPreset.shadowMapSize}
        shadow-camera-near={5}
        shadow-camera-far={260}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
      />

      <Environment key={selectedTrackId} resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color={visualTheme.envPrimaryColor}
          position={[-40, 24, -40]}
          scale={[60, 20, 1]}
          rotation={[Math.PI / 5, Math.PI / 4, 0]}
        />
        <Lightformer
          form="ring"
          intensity={1.4}
          color={visualTheme.envSecondaryColor}
          position={[30, 18, 25]}
          scale={20}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          color={visualTheme.hemiGroundColor}
          position={[0, -10, 0]}
          scale={[60, 60, 1]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </Environment>

      <Physics gravity={[0, -28, 0]} timeStep={FIXED_TIMESTEP}>
        <TrackWorld key={selectedTrackId} layout={layout} trackModelPath={trackModelPath} />
        <MovingTrackHazards key={`haz-${selectedTrackId}`} layout={layout} simRef={simRef} />
        <WorldItemsRenderer key={`items-${selectedTrackId}`} layout={layout} simRef={simRef} paused={paused} />
        {racerAssetList.map((racerAsset, idx) => (
          <RacerMeshInstance
            key={`${selectedTrackId}-${idx}`}
            racerIndex={idx}
            simRef={simRef}
            kartModelPath={racerAsset.kart}
            characterModelPath={racerAsset.character}
            initialPosition={
              idx === 0
                ? [startSlot.position.x, startSlot.position.y, startSlot.position.z]
                : undefined
            }
            poseRef={idx === 0 ? poseRef : undefined}
            onPlayerRapierSync={idx === 0 ? syncPlayerRapier : undefined}
            paused={paused}
          />
        ))}
      </Physics>

      <RaceVfxSystem
        key={`vfx-${selectedTrackId}-${settings.quality}`}
        trackId={selectedTrackId}
        quality={settings.quality}
        simRef={simRef}
        paused={paused}
      />

      <RaceCamera layout={layout} poseRef={poseRef} trackerRef={trackerRef} />
    </>
  );
}

function SceneRouter(props: RaceSceneProps) {
  const manifest = useGameStore((s) => s.manifest);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const selectedKartId = useGameStore((s) => s.selectedKartId);
  const selectedTrackId = useGameStore((s) => s.selectedTrackId);

  useEffect(() => {
    const path = manifest
      ? resolveAssetPath(manifest, getTrackById(selectedTrackId).modelAssetId)
      : FALLBACK_TRACK_GLB_PATHS[selectedTrackId];
    useGLTF.preload(path);
  }, [manifest, selectedTrackId]);

  const playerChar = getCharacterById(selectedCharacterId);
  const playerKart = getKartById(selectedKartId);
  const charModelPath = manifest
    ? resolveAssetPath(manifest, playerChar.modelAssetId)
    : FALLBACK_CHARACTER_PATHS[playerChar.id];
  const kartModelPath = manifest
    ? resolveAssetPath(manifest, playerKart.modelAssetId)
    : FALLBACK_KART_PATHS[playerKart.id];

  const podiumStageEntries: PodiumRacerStageEntry[] = useMemo(() => {
    const source = props.podiumRoster ?? [];
    return source.map((entry) => {
      const charDef = getCharacterById(entry.characterId);
      return {
        rank: entry.rank,
        name: entry.name,
        primaryColor: charDef.primaryColor,
        characterModelPath: manifest
          ? resolveAssetPath(manifest, charDef.modelAssetId)
          : FALLBACK_CHARACTER_PATHS[charDef.id],
      };
    });
  }, [manifest, props.podiumRoster]);

  if (props.sceneMode === 'showcase') {
    return (
      <GarageShowcaseStage characterModelPath={charModelPath} kartModelPath={kartModelPath} />
    );
  }

  if (props.sceneMode === 'podium') {
    return <PodiumCeremonyStage entries={podiumStageEntries} />;
  }

  return <RaceWorldContent {...props} />;
}

export function RaceScene(props: RaceSceneProps) {
  const quality = useGameStore((s) => s.settings.quality);
  const preset = QUALITY_PRESETS[quality];
  const isMobile = useMemo(() => detectMobileDevice(), []);
  const canvasDpr = clampCanvasDpr(preset.dpr, isMobile);

  return (
    <div className="kl-canvas-wrap">
      <Canvas
        shadows={preset.shadowsEnabled ? 'basic' : false}
        dpr={canvasDpr}
        gl={{ antialias: preset.antialias, powerPreference: 'high-performance' }}
        camera={{ position: [0, 6, 52], fov: 56, near: 0.25, far: 500 }}
      >
        <Suspense fallback={null}>
          <SceneRouter {...props} />
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
// Preload only default track on boot; remaining tracks preload on demand when selected
useGLTF.preload(FALLBACK_TRACK_GLB_PATHS['porto-das-lanternas']);
useGLTF.preload(publicUrl('/assets/props/item_box.glb'));
useGLTF.preload(publicUrl('/assets/items/nevoa_prisma.glb'));
useGLTF.preload(publicUrl('/assets/items/faisca_rastreadora.glb'));
useTexture.preload(publicUrl('/assets/vfx/particles_atlas.png'));
