import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../app/store';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { getKartById } from '../data/karts';
import { getTrackById } from '../data/tracks';
import { GameAudioEngine } from '../game/audio/audioEngine';
import { RaceCamera } from '../game/camera/RaceCamera';
import { resolveAssetPath } from '../game/core/assetLoader';
import { publicUrl } from '../game/core/publicUrl';
import {
  buildOptimizedTrackGroup,
  extractInstancedPrimitives,
} from '../game/core/sceneOptimizer';
import { DEFAULT_LAPS, FIXED_TIMESTEP, FixedStepClock } from '../game/core/constants';
import { clampCanvasDpr, detectMobileDevice } from '../game/core/mobile';
import type { CharacterId, KartId, LiveKartPose } from '../game/core/types';
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
} from '../game/tracks/trackGeometry';
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
  canTogglePause?: boolean;
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

function TrackSkyEnvironment({
  theme,
  reducedMotion,
}: {
  theme: TrackVisualTheme;
  reducedMotion: boolean;
}) {
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
      {theme.hasLightning && !reducedMotion && <StormLightningFlash />}
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
  trackModelPath,
}: {
  trackModelPath: string;
}) {
  const gltf = useGLTF(trackModelPath);
  const optimized = useMemo(
    () => buildOptimizedTrackGroup(gltf.scene, SHADOW_CASTER_PREFIXES, 72),
    [gltf.scene],
  );
  const boatNodesRef = useRef<THREE.Object3D[]>([]);
  const windmillNodesRef = useRef<THREE.Object3D[]>([]);

  useEffect(() => {
    boatNodesRef.current = optimized.boats;
    windmillNodesRef.current = optimized.windmills;
    return () => {
      boatNodesRef.current = [];
      windmillNodesRef.current = [];
      optimized.dispose();
    };
  }, [optimized]);

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

  return <primitive object={optimized.group} />;
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
              <mesh position={[0, 0.22, 0]} castShadow>
                <cylinderGeometry args={[0.82, 0.92, 0.44, 12]} />
                <meshStandardMaterial color="#1e1b4b" metalness={0.75} roughness={0.28} />
              </mesh>
              <mesh position={[0, 1.25, 0]} castShadow>
                <cylinderGeometry args={[0.38, 0.56, 1.75, 12]} />
                <meshStandardMaterial
                  color="#ec4899"
                  emissive="#f43f5e"
                  emissiveIntensity={1.6}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0, 1.15, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
                <torusGeometry args={[0.68, 0.08, 10, 20]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} roughness={0.18} />
              </mesh>
              <mesh position={[0, 2.45, 0]}>
                <octahedronGeometry args={[0.45, 0]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.8} roughness={0.12} />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 1.38, 0]} castShadow>
                <boxGeometry args={[2.5, 2.75, 0.72]} />
                <meshStandardMaterial color="#1f2937" metalness={0.72} roughness={0.38} />
              </mesh>
              <mesh position={[-1.12, 1.48, 0]} castShadow>
                <boxGeometry args={[0.32, 3.0, 0.88]} />
                <meshStandardMaterial color="#4b5563" metalness={0.65} roughness={0.42} />
              </mesh>
              <mesh position={[1.12, 1.48, 0]} castShadow>
                <boxGeometry args={[0.32, 3.0, 0.88]} />
                <meshStandardMaterial color="#4b5563" metalness={0.65} roughness={0.42} />
              </mesh>
              <mesh position={[0, 1.45, 0]}>
                <octahedronGeometry args={[0.68, 0]} />
                <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={1.8} roughness={0.15} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

const MAX_WORLD_HAZARDS = 8;
const MAX_WORLD_PROJECTILES = 8;
const MAX_WORLD_WINDS = 6;

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

  const boxSlots = useMemo(() => layout.itemBoxZones.flat(), [layout]);
  const boxPrimitives = useMemo(
    () => extractInstancedPrimitives(itemBoxGltf.scene),
    [itemBoxGltf.scene],
  );
  const hazardClones = useMemo(
    () => Array.from({ length: MAX_WORLD_HAZARDS }, () => nevoaGltf.scene.clone(true)),
    [nevoaGltf.scene],
  );
  const projectileClones = useMemo(
    () => Array.from({ length: MAX_WORLD_PROJECTILES }, () => faiscaGltf.scene.clone(true)),
    [faiscaGltf.scene],
  );

  const boxInstancedRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const boxDummyRef = useRef(new THREE.Object3D());
  const boxMatRef = useRef(new THREE.Matrix4());
  const hiddenMatRef = useRef(new THREE.Matrix4().makeScale(0, 0, 0));
  const hazardRefs = useRef<Array<THREE.Group | null>>([]);
  const projectileRefs = useRef<Array<THREE.Group | null>>([]);
  const windRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state) => {
    if (paused) return;
    const t = state.clock.elapsedTime;
    const items = simRef.current.items;
    const dummy = boxDummyRef.current;
    const composed = boxMatRef.current;
    const hiddenMat = hiddenMatRef.current;

    // Preserve true world box.position.y while instancing all item boxes into 5 draw calls (CRÍTICO-03 + MÉDIO-05)
    for (let i = 0; i < boxSlots.length; i += 1) {
      const boxState = items.boxes[i];
      const active = Boolean(boxState && boxState.active);
      if (active) {
        dummy.position.set(
          boxState.position.x,
          boxState.position.y + Math.sin(t * 3.0 + i) * 0.16,
          boxState.position.z,
        );
        dummy.rotation.set(0, t * 1.85 + i * 0.5, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
      }

      for (let p = 0; p < boxPrimitives.length; p += 1) {
        const inst = boxInstancedRefs.current[p];
        if (!inst) continue;
        if (active) {
          composed.multiplyMatrices(dummy.matrix, boxPrimitives[p].localMatrix);
          inst.setMatrixAt(i, composed);
        } else {
          inst.setMatrixAt(i, hiddenMat);
        }
      }
    }
    for (let p = 0; p < boxPrimitives.length; p += 1) {
      const inst = boxInstancedRefs.current[p];
      if (inst) inst.instanceMatrix.needsUpdate = true;
    }

    for (let i = 0; i < MAX_WORLD_HAZARDS; i += 1) {
      const grp = hazardRefs.current[i];
      const haz = items.hazards[i];
      if (!grp) continue;
      if (!haz) {
        grp.visible = false;
        continue;
      }
      grp.visible = true;
      grp.position.set(haz.x, haz.y, haz.z);
      grp.rotation.y = t * 1.1 + i;
    }

    for (let i = 0; i < MAX_WORLD_PROJECTILES; i += 1) {
      const grp = projectileRefs.current[i];
      const proj = items.projectiles[i];
      if (!grp) continue;
      if (!proj) {
        grp.visible = false;
        continue;
      }
      grp.visible = true;
      grp.position.set(proj.x, proj.y, proj.z);
      grp.rotation.set(0, proj.yaw, 0);
    }

    for (let i = 0; i < MAX_WORLD_WINDS; i += 1) {
      const mesh = windRefs.current[i];
      const wind = items.windPulses[i];
      if (!mesh) continue;
      if (!wind) {
        mesh.visible = false;
        continue;
      }
      const prog = wind.age / wind.maxAge;
      mesh.visible = true;
      mesh.position.set(wind.x, wind.y, wind.z);
      mesh.scale.setScalar(1 + prog * wind.radius);
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.75 * (1 - prog));
    }
  });

  return (
    <group>
      {boxSlots.length > 0 &&
        boxPrimitives.map((spec, pIdx) => (
          <instancedMesh
            key={`box-inst-${pIdx}`}
            ref={(el) => {
              boxInstancedRefs.current[pIdx] = el;
            }}
            args={[spec.geometry, spec.material, boxSlots.length]}
            frustumCulled={false}
          />
        ))}
      {hazardClones.map((clone, idx) => (
        <group
          key={`haz-${idx}`}
          ref={(el) => {
            hazardRefs.current[idx] = el;
          }}
          scale={1.7}
          visible={false}
        >
          <primitive object={clone} />
        </group>
      ))}
      {projectileClones.map((clone, idx) => (
        <group
          key={`proj-${idx}`}
          ref={(el) => {
            projectileRefs.current[idx] = el;
          }}
          scale={1.25}
          visible={false}
        >
          <primitive object={clone} />
        </group>
      ))}
      {Array.from({ length: MAX_WORLD_WINDS }, (_, idx) => (
        <mesh
          key={`wind-${idx}`}
          ref={(el) => {
            windRefs.current[idx] = el;
          }}
          rotation={[-Math.PI * 0.5, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.78, 1.0, 24]} />
          <meshBasicMaterial color="#2dd4bf" transparent opacity={0.75} side={THREE.DoubleSide} />
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
  canTogglePause = true,
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
  const clockRef = useRef(new FixedStepClock(FIXED_TIMESTEP));
  const telemetryTimerRef = useRef(0);
  const lastSyncRef = useRef<string>('');
  const goFlashTimerRef = useRef(0);
  const recoverQueuedRef = useRef(false);
  const useItemQueuedRef = useRef(false);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunTargetRef = useRef<THREE.Object3D | null>(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

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
    if (pausePressed && canTogglePause && sceneMode === 'race' && simRef.current.phase !== 'intro') {
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
    if (playerInput.useItem) {
      useItemQueuedRef.current = true;
    }

    clockRef.current.advance(delta, (dt) => {
      const stepInput =
        recoverQueuedRef.current || useItemQueuedRef.current
          ? {
              ...playerInput,
              recover: playerInput.recover || recoverQueuedRef.current,
              useItem: playerInput.useItem || useItemQueuedRef.current,
            }
          : playerInput;
      recoverQueuedRef.current = false;
      useItemQueuedRef.current = false;

      const events = sim.step(dt, stepInput);

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

    // Keep directional shadow frustum tightly centered on the player kart (quantized to reduce shadow swimming)
    if (sunLightRef.current && sunTargetRef.current && settings.quality !== 'low') {
      const pSim = simRef.current.player.sim;
      const snapX = Math.round(pSim.x * 2) * 0.5;
      const snapY = Math.round(pSim.y * 2) * 0.5;
      const snapZ = Math.round(pSim.z * 2) * 0.5;
      sunTargetRef.current.position.set(snapX, snapY, snapZ);
      sunTargetRef.current.updateMatrixWorld();
      sunLightRef.current.position.set(snapX - 36, snapY + 46, snapZ - 28);
      if (sunLightRef.current.target !== sunTargetRef.current) {
        sunLightRef.current.target = sunTargetRef.current;
      }
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
      <TrackSkyEnvironment theme={visualTheme} reducedMotion={reducedMotion} />
      <ambientLight intensity={0.58} color={visualTheme.sunColor} />
      <hemisphereLight
        args={[visualTheme.hemiSkyColor, visualTheme.hemiGroundColor, visualTheme.hemiIntensity * 0.55]}
      />
      <object3D ref={sunTargetRef} position={[0, 0, 0]} />
      <directionalLight
        ref={sunLightRef}
        position={[-36, 46, -28]}
        intensity={visualTheme.sunIntensity}
        color={visualTheme.sunColor}
        castShadow={qualityPreset.shadowsEnabled}
        shadow-mapSize-width={qualityPreset.shadowMapSize}
        shadow-mapSize-height={qualityPreset.shadowMapSize}
        shadow-bias={-0.0005}
        shadow-camera-near={5}
        shadow-camera-far={145}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
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

      <TrackWorld key={selectedTrackId} trackModelPath={trackModelPath} />
      <MovingTrackHazards key={`haz-${selectedTrackId}`} layout={layout} simRef={simRef} />
      <WorldItemsRenderer key={`items-${selectedTrackId}`} layout={layout} simRef={simRef} paused={paused} />
      {racerAssetList.map((racerAsset, idx) => (
        <RacerMeshInstance
          key={`${selectedTrackId}-${idx}`}
          racerIndex={idx}
          simRef={simRef}
          kartModelPath={racerAsset.kart}
          characterModelPath={racerAsset.character}
          poseRef={idx === 0 ? poseRef : undefined}
          paused={paused}
        />
      ))}

      <RaceVfxSystem
        key={`vfx-${selectedTrackId}-${settings.quality}`}
        trackId={selectedTrackId}
        quality={settings.quality}
        simRef={simRef}
        paused={paused}
        reducedMotion={reducedMotion}
      />

      <RaceCamera layout={layout} poseRef={poseRef} trackerRef={trackerRef} resetToken={resetToken} />
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

  // Lazy preload remaining character/kart GLBs only when entering Garage or Race (MÉDIO-06)
  useEffect(() => {
    if (props.sceneMode !== 'showcase' && props.sceneMode !== 'race') return;
    for (const charPath of Object.values(FALLBACK_CHARACTER_PATHS)) {
      useGLTF.preload(charPath);
    }
    for (const kartPath of Object.values(FALLBACK_KART_PATHS)) {
      useGLTF.preload(kartPath);
    }
  }, [props.sceneMode]);

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
        gl={{
          antialias: preset.antialias,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.06,
        }}
        camera={{ position: [0, 6, 52], fov: 56, near: 0.25, far: 500 }}
      >
        <Suspense fallback={null}>
          <SceneRouter {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Boot-minimal preload: starter driver/kart, default track, shared items & VFX atlas (MÉDIO-06)
useGLTF.preload(FALLBACK_CHARACTER_PATHS.nilo);
useGLTF.preload(FALLBACK_KART_PATHS['trilha-raposa']);
useGLTF.preload(FALLBACK_TRACK_GLB_PATHS['porto-das-lanternas']);
useGLTF.preload(publicUrl('/assets/props/item_box.glb'));
useGLTF.preload(publicUrl('/assets/items/nevoa_prisma.glb'));
useGLTF.preload(publicUrl('/assets/items/faisca_rastreadora.glb'));
useTexture.preload(publicUrl('/assets/vfx/particles_atlas.png'));
