import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { CharacterRig } from '../characters/CharacterRig';
import { disposeObject3D } from '../core/assetLoader';
import { DRIFT_TIERS, FIXED_TIMESTEP, FixedStepClock } from '../core/constants';
import type { CharacterAnimState, SurfaceType } from '../core/types';
import {
  type KartInputState,
  type KartPhysicsProfile,
  type KartSimState,
  createInitialKartState,
  stepKartSimulation,
} from '../physics/kartController';
import { RaceProgressTracker, type RacerRaceState } from '../racing/raceManager';
import { type TrackLayoutDef, projectPointOntoTrack } from '../tracks/trackGeometry';

export interface KartHudTelemetry {
  speedKmh: number;
  surface: SurfaceType;
  driftActive: boolean;
  driftTier: 0 | 1 | 2 | 3;
  driftChargeProgress: number;
  boostActive: boolean;
  boostLabel: string | null;
  currentLap: number;
  totalLaps: number;
  raceTimeMs: number;
  lapTimesMs: number[];
  bestLapMs: number | null;
  wrongWay: boolean;
  finished: boolean;
  recovering: boolean;
  onShortcut: boolean;
  progressRatio: number;
}

export interface LiveKartPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  visualSlipYaw: number;
  forwardSpeed: number;
  boostActive: boolean;
  driftActive: boolean;
  steerAngle: number;
  groundHeight: number;
}

export interface KartEntityProps {
  kartModelPath: string;
  characterModelPath: string;
  layout: TrackLayoutDef;
  profile: KartPhysicsProfile;
  startPosition: { x: number; y: number; z: number };
  startYaw: number;
  trackerRef: React.MutableRefObject<RaceProgressTracker>;
  racerStateRef: React.MutableRefObject<RacerRaceState>;
  pollInput: () => KartInputState;
  poseRef: React.MutableRefObject<LiveKartPose>;
  onTelemetry: (telemetry: KartHudTelemetry) => void;
  paused: boolean;
  resetToken: number;
}

interface KartParts {
  chassis: THREE.Object3D | null;
  steeringWheel: THREE.Object3D | null;
  driverMountOffset: THREE.Vector3;
  wheelFL: THREE.Object3D | null;
  wheelFR: THREE.Object3D | null;
  wheelRL: THREE.Object3D | null;
  wheelRR: THREE.Object3D | null;
}

export function KartEntity({
  kartModelPath,
  characterModelPath,
  layout,
  profile,
  startPosition,
  startYaw,
  trackerRef,
  racerStateRef,
  pollInput,
  poseRef,
  onTelemetry,
  paused,
  resetToken,
}: KartEntityProps) {
  const gltf = useGLTF(kartModelPath);
  const kartScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const bodyRef = useRef<RapierRigidBody | null>(null);
  const visualRootRef = useRef<THREE.Group | null>(null);
  const driverMirrorRef = useRef<THREE.Group | null>(null);
  const driverSeatOffsetRef = useRef<THREE.Group | null>(null);
  const exhaustLeftFlameRef = useRef<THREE.Mesh | null>(null);
  const exhaustRightFlameRef = useRef<THREE.Mesh | null>(null);
  const sparkLeftRef = useRef<THREE.Mesh | null>(null);
  const sparkRightRef = useRef<THREE.Mesh | null>(null);
  const smokeGroupRef = useRef<THREE.Group | null>(null);

  const simRef = useRef<KartSimState>(
    createInitialKartState(startPosition.x, startPosition.y, startPosition.z, startYaw),
  );
  const clockRef = useRef(new FixedStepClock(FIXED_TIMESTEP));
  const telemetryTimerRef = useRef(0);
  const [animState, setAnimState] = useState<CharacterAnimState>('idle');
  const lastAnimRef = useRef<CharacterAnimState>('idle');
  const [steerForRig, setSteerForRig] = useState(0);

  const partsRef = useRef<KartParts>({
    chassis: null,
    steeringWheel: null,
    driverMountOffset: new THREE.Vector3(0, 0.54, 0.22),
    wheelFL: null,
    wheelFR: null,
    wheelRL: null,
    wheelRR: null,
  });

  useEffect(() => {
    const driverMountOffset = new THREE.Vector3(0, 0.54, 0.22);
    let chassis: THREE.Object3D | null = null;
    let steeringWheel: THREE.Object3D | null = null;
    let wheelFL: THREE.Object3D | null = null;
    let wheelFR: THREE.Object3D | null = null;
    let wheelRL: THREE.Object3D | null = null;
    let wheelRR: THREE.Object3D | null = null;

    kartScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      if (obj.name === 'ChassisGroup') chassis = obj;
      if (obj.name === 'SteeringWheel') steeringWheel = obj;
      if (obj.name === 'DriverMount') driverMountOffset.copy(obj.position);
      if (obj.name === 'WheelFL') wheelFL = obj;
      if (obj.name === 'WheelFR') wheelFR = obj;
      if (obj.name === 'WheelRL') wheelRL = obj;
      if (obj.name === 'WheelRR') wheelRR = obj;
    });

    partsRef.current = {
      chassis,
      steeringWheel,
      driverMountOffset,
      wheelFL,
      wheelFR,
      wheelRL,
      wheelRR,
    };
    if (driverSeatOffsetRef.current) {
      driverSeatOffsetRef.current.position.copy(driverMountOffset);
    }

    return () => {
      disposeObject3D(kartScene);
    };
  }, [kartScene]);

  // Reset physics body & simulation state on restart
  useEffect(() => {
    const fresh = createInitialKartState(
      startPosition.x,
      startPosition.y,
      startPosition.z,
      startYaw,
    );
    simRef.current = fresh;
    clockRef.current.reset();
    if (bodyRef.current) {
      bodyRef.current.setTranslation(
        { x: startPosition.x, y: startPosition.y, z: startPosition.z },
        true,
      );
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    poseRef.current = {
      x: startPosition.x,
      y: startPosition.y,
      z: startPosition.z,
      yaw: startYaw,
      visualSlipYaw: 0,
      forwardSpeed: 0,
      boostActive: false,
      driftActive: false,
      steerAngle: 0,
      groundHeight: startPosition.y,
    };
  }, [resetToken, startPosition.x, startPosition.y, startPosition.z, startYaw, poseRef]);

  useFrame((state, delta) => {
    if (paused) return;

    const body = bodyRef.current;
    const sim = simRef.current;
    const tracker = trackerRef.current;
    const racerState = racerStateRef.current;
    const input = pollInput();

    clockRef.current.advance(delta, (dt) => {
      tracker.stepClock(dt);

      if (body) {
        const rapierPos = body.translation();
        // Sync horizontal position from Rapier so wall/obstacle collisions are authoritative
        if (sim.recoverTimer <= 0) {
          sim.x = rapierPos.x;
          sim.z = rapierPos.z;
        }
      }

      const prevRecover = sim.recoverTimer;
      const trackQuery = projectPointOntoTrack(layout, sim.x, sim.z, sim.y);
      const canDrive = tracker.phase === 'racing';

      // Sync checkpoint index from tracker
      sim.lastSafeCheckpointIndex = racerState.lastValidCheckpointIndex;

      stepKartSimulation(sim, input, trackQuery, profile, layout, dt, canDrive);

      if (canDrive) {
        tracker.updateRacerProgress(racerState, sim.x, sim.z, sim.yaw, trackQuery);
      }

      if (body) {
        const justRecovered = prevRecover <= 0 && sim.recoverTimer > 0;
        if (justRecovered || sim.recoverTimer > 0) {
          body.setTranslation({ x: sim.x, y: sim.y, z: sim.z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          const currentPos = body.translation();
          const vyCorrection = (sim.y - currentPos.y) / dt;
          body.setLinvel({ x: sim.vx, y: vyCorrection, z: sim.vz }, true);
        }
      }

      poseRef.current = {
        x: sim.x,
        y: sim.y,
        z: sim.z,
        yaw: sim.yaw,
        visualSlipYaw: sim.visualSlipYaw,
        forwardSpeed: sim.forwardSpeed,
        boostActive: sim.boostTimer > 0,
        driftActive: sim.driftActive,
        steerAngle: sim.steerAngle,
        groundHeight: trackQuery.groundHeight,
      };
    });

    const parts = partsRef.current;

    // Update 3D visual nodes smoothly at render framerate
    if (visualRootRef.current) {
      visualRootRef.current.position.set(sim.x, sim.y, sim.z);
      visualRootRef.current.rotation.set(0, sim.yaw + sim.visualSlipYaw, 0);
    }

    if (parts.chassis) {
      parts.chassis.position.y = sim.suspensionOffset;
      parts.chassis.rotation.x = sim.chassisPitch;
      parts.chassis.rotation.z = sim.chassisRoll;
    }

    if (driverMirrorRef.current) {
      driverMirrorRef.current.position.y = sim.suspensionOffset;
      driverMirrorRef.current.rotation.x = sim.chassisPitch;
      driverMirrorRef.current.rotation.z = sim.chassisRoll;
    }

    if (parts.steeringWheel) {
      parts.steeringWheel.rotation.z = -sim.steerAngle * 0.65;
    }

    const frontWheelYaw = -sim.steerAngle * 0.42;
    if (parts.wheelFL) {
      parts.wheelFL.rotation.order = 'YXZ';
      parts.wheelFL.rotation.y = frontWheelYaw;
      parts.wheelFL.rotation.x = -sim.wheelSpinAngle;
    }
    if (parts.wheelFR) {
      parts.wheelFR.rotation.order = 'YXZ';
      parts.wheelFR.rotation.y = frontWheelYaw;
      parts.wheelFR.rotation.x = -sim.wheelSpinAngle;
    }
    if (parts.wheelRL) {
      parts.wheelRL.rotation.x = -sim.wheelSpinAngle;
    }
    if (parts.wheelRR) {
      parts.wheelRR.rotation.x = -sim.wheelSpinAngle;
    }

    // Determine character animation state
    let nextAnim: CharacterAnimState;
    if (racerState.finished) {
      nextAnim = 'victory';
    } else if (sim.hitTimer > 0) {
      nextAnim = 'hit';
    } else if (sim.driftActive) {
      nextAnim = 'drift';
    } else if (tracker.phase === 'racing' && Math.abs(sim.forwardSpeed) > 2) {
      if (sim.steerAngle < -0.22) nextAnim = 'turnLeft';
      else if (sim.steerAngle > 0.22) nextAnim = 'turnRight';
      else nextAnim = 'drive';
    } else {
      nextAnim = 'idle';
    }
    if (nextAnim !== lastAnimRef.current) {
      lastAnimRef.current = nextAnim;
      setAnimState(nextAnim);
    }

    // Visual VFX: Exhaust turbo flames
    const t = state.clock.elapsedTime;
    const boostOn = sim.boostTimer > 0;
    for (const flame of [exhaustLeftFlameRef.current, exhaustRightFlameRef.current]) {
      if (!flame) continue;
      flame.visible = boostOn;
      if (boostOn) {
        const pulse = 0.85 + Math.sin(t * 48) * 0.25;
        flame.scale.set(pulse, 0.9 + sim.boostMultiplier * 0.45, pulse);
      }
    }

    // Visual VFX: Tiered drift sparks
    const showSparks = sim.driftActive && sim.driftTier > 0;
    const sparkColorHex =
      sim.driftTier > 0 ? DRIFT_TIERS[sim.driftTier - 1].sparkColor : '#38bdf8';
    for (const spark of [sparkLeftRef.current, sparkRightRef.current]) {
      if (!spark) continue;
      spark.visible = showSparks;
      if (showSparks) {
        const pulse = 0.8 + Math.abs(Math.sin(t * 36)) * 0.65;
        spark.scale.setScalar(pulse * (0.7 + sim.driftTier * 0.28));
        const mat = spark.material as THREE.MeshBasicMaterial;
        mat.color.set(sparkColorHex);
      }
    }

    // Visual VFX: Rear tire smoke / off-road dust puffs
    if (smokeGroupRef.current) {
      const showSmoke =
        (sim.driftActive || (sim.surface !== 'asphalt' && sim.forwardSpeed > 8)) &&
        sim.grounded;
      smokeGroupRef.current.visible = showSmoke;
      if (showSmoke) {
        smokeGroupRef.current.children.forEach((puff, idx) => {
          const phase = (t * 4.5 + idx * 0.33) % 1;
          puff.position.set(
            (idx % 2 === 0 ? -0.78 : 0.78) + Math.sin(t * 14 + idx) * 0.12,
            0.18 + phase * 0.65,
            0.95 + phase * 1.35,
          );
          puff.scale.setScalar(0.25 + phase * 0.55);
        });
      }
    }

    // Throttled HUD telemetry update (~20 Hz)
    telemetryTimerRef.current += delta;
    if (telemetryTimerRef.current >= 0.05) {
      telemetryTimerRef.current = 0;
      setSteerForRig(sim.steerAngle);
      const maxTierCharge = DRIFT_TIERS[2].chargeThresholdSeconds;
      onTelemetry({
        speedKmh: Math.round(Math.abs(sim.forwardSpeed) * 3.6),
        surface: sim.surface,
        driftActive: sim.driftActive,
        driftTier: sim.driftTier,
        driftChargeProgress: Math.min(1, sim.driftChargeSeconds / maxTierCharge),
        boostActive: sim.boostTimer > 0,
        boostLabel: sim.boostLabel,
        currentLap: racerState.currentLap,
        totalLaps: racerState.totalLaps,
        raceTimeMs: racerState.totalRaceTimeMs,
        lapTimesMs: [...racerState.lapTimesMs],
        bestLapMs: racerState.bestLapMs,
        wrongWay: racerState.wrongWay,
        finished: racerState.finished,
        recovering: sim.recoverTimer > 0,
        onShortcut: sim.onShortcut,
        progressRatio: Math.min(
          1,
          Math.max(0, racerState.raceProgressScore / racerState.totalLaps),
        ),
      });
    }
  });

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type="dynamic"
        position={[startPosition.x, startPosition.y, startPosition.z]}
        lockRotations
        gravityScale={0}
        linearDamping={0}
        colliders={false}
        restitution={0.25}
        friction={0}
      >
        <BallCollider args={[0.88]} position={[0, 0.88, 0]} />
      </RigidBody>

      <group ref={visualRootRef} position={[startPosition.x, startPosition.y, startPosition.z]}>
        <primitive object={kartScene} />

        {/* Driver mounted cleanly inside ChassisGroup's transform frame */}
        <group ref={driverMirrorRef}>
          <group ref={driverSeatOffsetRef} position={[0, 0.54, 0.22]}>
            <CharacterRig
              modelPath={characterModelPath}
              animState={animState}
              steerAngle={steerForRig}
            />
          </group>
        </group>

        {/* Dual exhaust turbo flames */}
        <mesh
          ref={exhaustLeftFlameRef}
          position={[-0.34, 0.72, 1.38]}
          rotation={[Math.PI * 0.42, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.14, 0.72, 10]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.9} />
        </mesh>
        <mesh
          ref={exhaustRightFlameRef}
          position={[0.34, 0.72, 1.38]}
          rotation={[Math.PI * 0.42, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.14, 0.72, 10]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
        </mesh>

        {/* Tiered drift sparks at rear wheels */}
        <mesh ref={sparkLeftRef} position={[-0.92, 0.22, 0.96]} visible={false}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh ref={sparkRightRef} position={[0.92, 0.22, 0.96]} visible={false}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* Tire smoke & off-road dust particles */}
        <group ref={smokeGroupRef} visible={false}>
          {Array.from({ length: 6 }, (_, idx) => (
            <mesh key={idx}>
              <dodecahedronGeometry args={[0.26, 0]} />
              <meshStandardMaterial color="#e2e8f0" transparent opacity={0.52} roughness={1} />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}
