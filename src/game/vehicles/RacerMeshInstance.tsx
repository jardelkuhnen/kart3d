import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { CharacterRig } from '../characters/CharacterRig';
import { disposeObject3D } from '../core/assetLoader';
import { DRIFT_TIERS } from '../core/constants';
import type { CharacterAnimState } from '../core/types';
import type { RaceSimulation, RacerEntityState } from '../racing/raceSimulation';
import type { LiveKartPose } from './KartEntity';

export interface RacerMeshInstanceProps {
  racerIndex: number;
  simRef: React.MutableRefObject<RaceSimulation>;
  kartModelPath: string;
  characterModelPath: string;
  poseRef?: React.MutableRefObject<LiveKartPose>;
  onPlayerRapierSync?: (body: RapierRigidBody | null) => void;
  paused: boolean;
}

interface ClonedKartHandles {
  chassis: THREE.Object3D | null;
  steeringWheel: THREE.Object3D | null;
  driverMountOffset: THREE.Vector3;
  wheelFL: THREE.Object3D | null;
  wheelFR: THREE.Object3D | null;
  wheelRL: THREE.Object3D | null;
  wheelRR: THREE.Object3D | null;
}

function getRacerFromRef(
  simRef: React.MutableRefObject<RaceSimulation>,
  idx: number,
): RacerEntityState {
  return simRef.current.racers[idx];
}

export function RacerMeshInstance({
  racerIndex,
  simRef,
  kartModelPath,
  characterModelPath,
  poseRef,
  onPlayerRapierSync,
  paused,
}: RacerMeshInstanceProps) {
  const gltf = useGLTF(kartModelPath);
  const kartScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const bodyRef = useRef<RapierRigidBody | null>(null);
  const visualRootRef = useRef<THREE.Group | null>(null);
  const driverMirrorRef = useRef<THREE.Group | null>(null);
  const driverSeatOffsetRef = useRef<THREE.Group | null>(null);
  const flameLRef = useRef<THREE.Mesh | null>(null);
  const flameRRef = useRef<THREE.Mesh | null>(null);
  const sparkLRef = useRef<THREE.Mesh | null>(null);
  const sparkRRef = useRef<THREE.Mesh | null>(null);
  const shieldMeshRef = useRef<THREE.Mesh | null>(null);

  const partsRef = useRef<ClonedKartHandles>({
    chassis: null,
    steeringWheel: null,
    driverMountOffset: new THREE.Vector3(0, 0.54, 0.22),
    wheelFL: null,
    wheelFR: null,
    wheelRL: null,
    wheelRR: null,
  });

  const [animState, setAnimState] = useState<CharacterAnimState>('idle');
  const lastAnimRef = useRef<CharacterAnimState>('idle');
  const [steerForRig, setSteerForRig] = useState(0);
  const isPlayer = racerIndex === 0;

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
        obj.castShadow = isPlayer;
        obj.receiveShadow = true;

        // Clone material per racer instance so disposeObject3D never disposes shared GLTF materials
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material = obj.material.clone();
        }
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
  }, [kartScene, isPlayer]);

  useEffect(() => {
    if (isPlayer && onPlayerRapierSync) {
      onPlayerRapierSync(bodyRef.current);
      return () => onPlayerRapierSync(null);
    }
    return undefined;
  }, [isPlayer, onPlayerRapierSync]);

  useFrame((state) => {
    if (paused) return;
    const racer = getRacerFromRef(simRef, racerIndex);
    const sim = racer.sim;
    const parts = partsRef.current;

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

    if (isPlayer && poseRef) {
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
        groundHeight: sim.y,
      };
    }

    let nextAnim: CharacterAnimState;
    if (racer.race.finished) {
      nextAnim = racer.rank <= 3 ? 'victory' : 'defeat';
    } else if (sim.hitTimer > 0) {
      nextAnim = 'hit';
    } else if (sim.driftActive) {
      nextAnim = 'drift';
    } else if (simRef.current.phase === 'racing' && Math.abs(sim.forwardSpeed) > 2) {
      if (sim.steerAngle < -0.22) nextAnim = 'turnLeft';
      else if (sim.steerAngle > 0.22) nextAnim = 'turnRight';
      else nextAnim = 'drive';
    } else {
      nextAnim = 'idle';
    }

    if (nextAnim !== lastAnimRef.current) {
      lastAnimRef.current = nextAnim;
      setAnimState(nextAnim);
      setSteerForRig(sim.steerAngle);
    }

    const t = state.clock.elapsedTime;
    const boostOn = sim.boostTimer > 0;
    for (const flame of [flameLRef.current, flameRRef.current]) {
      if (!flame) continue;
      flame.visible = boostOn;
      if (boostOn) {
        const pulse = 0.85 + Math.sin(t * 48) * 0.25;
        flame.scale.set(pulse, 0.9 + sim.boostMultiplier * 0.45, pulse);
      }
    }

    const showSparks = sim.driftActive && sim.driftTier > 0;
    const sparkHex = sim.driftTier > 0 ? DRIFT_TIERS[sim.driftTier - 1].sparkColor : '#38bdf8';
    for (const spark of [sparkLRef.current, sparkRRef.current]) {
      if (!spark) continue;
      spark.visible = showSparks;
      if (showSparks) {
        const pulse = 0.8 + Math.abs(Math.sin(t * 36)) * 0.65;
        spark.scale.setScalar(pulse * (0.7 + sim.driftTier * 0.28));
        (spark.material as THREE.MeshBasicMaterial).color.set(sparkHex);
      }
    }

    if (shieldMeshRef.current) {
      const shieldOn = racer.item.shieldTimer > 0;
      shieldMeshRef.current.visible = shieldOn;
      if (shieldOn) {
        shieldMeshRef.current.rotation.y = t * 1.8;
        const pulse = 1 + Math.sin(t * 8) * 0.04;
        shieldMeshRef.current.scale.setScalar(pulse);
      }
    }
  });

  return (
    <>
      {isPlayer && (
        <RigidBody
          ref={bodyRef}
          type="dynamic"
          position={[0, 0.35, 43]}
          lockRotations
          gravityScale={0}
          linearDamping={0}
          colliders={false}
          restitution={0.2}
          friction={0}
        >
          <BallCollider args={[0.88]} position={[0, 0.88, 0]} />
        </RigidBody>
      )}

      <group ref={visualRootRef}>
        <primitive object={kartScene} />

        <group ref={driverMirrorRef}>
          <group ref={driverSeatOffsetRef} position={[0, 0.54, 0.22]}>
            <CharacterRig
              modelPath={characterModelPath}
              animState={animState}
              steerAngle={steerForRig}
            />
          </group>
        </group>

        <mesh
          ref={flameLRef}
          position={[-0.34, 0.72, 1.38]}
          rotation={[Math.PI * 0.42, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.14, 0.72, 8]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.9} />
        </mesh>
        <mesh
          ref={flameRRef}
          position={[0.34, 0.72, 1.38]}
          rotation={[Math.PI * 0.42, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.14, 0.72, 8]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
        </mesh>

        <mesh ref={sparkLRef} position={[-0.92, 0.22, 0.96]} visible={false}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh ref={sparkRRef} position={[0.92, 0.22, 0.96]} visible={false}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* Bolha Guardiã active shield bubble */}
        <mesh ref={shieldMeshRef} position={[0, 0.9, 0]} visible={false}>
          <icosahedronGeometry args={[1.65, 1]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
        </mesh>
      </group>
    </>
  );
}
