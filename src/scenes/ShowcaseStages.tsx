import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CharacterRig } from '../game/characters/CharacterRig';
import { disposeObject3D } from '../game/core/assetLoader';

export interface ShowcaseProps {
  characterModelPath: string;
  kartModelPath: string;
}

export function GarageShowcaseStage({ characterModelPath, kartModelPath }: ShowcaseProps) {
  const gltf = useGLTF(kartModelPath);
  const kartScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const turntableRef = useRef<THREE.Group | null>(null);
  const driverSeatRef = useRef<THREE.Group | null>(null);
  const lookVecRef = useRef<THREE.Vector3 | null>(null);
  const camTargetRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    lookVecRef.current = new THREE.Vector3(0, 0.85, 0);
    camTargetRef.current = new THREE.Vector3(3.4, 2.05, 4.1);
  }, []);

  useEffect(() => {
    const mountOffset = new THREE.Vector3(0, 0.54, 0.22);
    kartScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material = obj.material.clone();
        }
      }
      if (obj.name === 'DriverMount') {
        mountOffset.copy(obj.position);
      }
    });
    if (driverSeatRef.current) {
      driverSeatRef.current.position.copy(mountOffset);
    }
    return () => {
      disposeObject3D(kartScene);
    };
  }, [kartScene]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    if (turntableRef.current) {
      turntableRef.current.rotation.y += dt * 0.55;
    }
    if (camTargetRef.current && lookVecRef.current) {
      state.camera.position.lerp(camTargetRef.current, 1 - Math.exp(-5.5 * dt));
      const persp = state.camera as THREE.PerspectiveCamera;
      persp.fov += (44 - persp.fov) * (1 - Math.exp(-5.5 * dt));
      persp.updateProjectionMatrix();
      state.camera.lookAt(lookVecRef.current);
    }
  });

  return (
    <>
      <color attach="background" args={['#091024']} />
      <fog attach="fog" args={['#091024', 18, 48]} />
      <ambientLight intensity={0.8} color="#e0f2fe" />
      <directionalLight position={[6, 9, 6]} intensity={2.3} color="#fef3c7" castShadow />
      <pointLight position={[-4, 3, -3]} intensity={1.8} color="#38bdf8" />

      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#bae6fd"
          position={[-4, 5, 4]}
          scale={[10, 6, 1]}
        />
        <Lightformer
          form="ring"
          intensity={1.6}
          color="#fbbf24"
          position={[4, 4, -4]}
          scale={8}
        />
      </Environment>

      {/* Studio Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]} receiveShadow>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.55} />
      </mesh>

      {/* Illuminated Rotating Pedestal */}
      <group ref={turntableRef}>
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <cylinderGeometry args={[2.35, 2.5, 0.2, 40]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.18, 2.34, 48]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        <primitive object={kartScene} />
        <group ref={driverSeatRef} position={[0, 0.54, 0.22]}>
          <CharacterRig modelPath={characterModelPath} animState="podium" steerAngle={0} />
        </group>
      </group>
    </>
  );
}

export interface PodiumRacerStageEntry {
  rank: 1 | 2 | 3;
  name: string;
  characterModelPath: string;
  primaryColor: string;
}

const CONFETTI_COUNT = 84;
const CONFETTI_COLORS = ['#fbbf24', '#38bdf8', '#ec4899', '#34d399', '#a78bfa'];

export function PodiumCeremonyStage({ entries }: { entries: readonly PodiumRacerStageEntry[] }) {
  const confettiRef = useRef<THREE.InstancedMesh | null>(null);
  const dummyRef = useRef<THREE.Object3D | null>(null);
  const particlesRef = useRef<
    Array<{ x: number; y: number; z: number; fall: number; spin: number; phase: number }>
  >([]);

  useEffect(() => {
    dummyRef.current = new THREE.Object3D();
    particlesRef.current = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x: ((Math.sin(i * 17.3) * 43758.5) % 1) * 5.2,
      y: 1.5 + ((i * 0.37) % 6.5),
      z: ((Math.cos(i * 11.7) * 21843.2) % 1) * 4.5,
      fall: 1.2 + (i % 5) * 0.35,
      spin: 1.8 + (i % 4) * 0.7,
      phase: i * 0.45,
    }));

    const mesh = confettiRef.current;
    if (mesh) {
      const color = new THREE.Color();
      for (let i = 0; i < CONFETTI_COUNT; i += 1) {
        color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
        mesh.setColorAt(i, color);
      }
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const camX = Math.sin(t * 0.25) * 2.2;
    const targetCam = new THREE.Vector3(camX, 3.2, 8.2);
    state.camera.position.lerp(targetCam, 1 - Math.exp(-3.5 * dt));
    const persp = state.camera as THREE.PerspectiveCamera;
    persp.fov += (48 - persp.fov) * (1 - Math.exp(-4 * dt));
    persp.updateProjectionMatrix();
    state.camera.lookAt(0, 1.85, 0);

    const mesh = confettiRef.current;
    const dummy = dummyRef.current;
    const particles = particlesRef.current;
    if (mesh && dummy) {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.y -= p.fall * dt;
        if (p.y < 0.1) p.y = 7.8;
        dummy.position.set(p.x + Math.sin(t * 2 + p.phase) * 0.25, p.y, p.z);
        dummy.rotation.set(t * p.spin, t * p.spin * 0.7, p.phase);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const stepSpecs: Array<{ rank: 1 | 2 | 3; x: number; height: number; color: string }> = [
    { rank: 1, x: 0, height: 1.65, color: '#f59e0b' },
    { rank: 2, x: -2.4, height: 1.15, color: '#94a3b8' },
    { rank: 3, x: 2.4, height: 0.8, color: '#b45309' },
  ];

  return (
    <>
      <color attach="background" args={['#0b1124']} />
      <fog attach="fog" args={['#0b1124', 18, 52]} />
      <ambientLight intensity={0.85} color="#fde68a" />
      <directionalLight position={[5, 11, 7]} intensity={2.4} color="#fff7ed" castShadow />
      <pointLight position={[-5, 6, 4]} intensity={2.0} color="#38bdf8" />

      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fde68a" position={[0, 8, 6]} scale={[12, 5, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#a855f7" position={[0, 5, -5]} scale={9} />
      </Environment>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[20, 48]} />
        <meshStandardMaterial color="#111827" roughness={0.3} metalness={0.55} />
      </mesh>

      {stepSpecs.map((step) => {
        const entry = entries.find((e) => e.rank === step.rank);
        return (
          <group key={step.rank} position={[step.x, 0, 0]}>
            <mesh position={[0, step.height * 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.0, step.height, 2.0]} />
              <meshStandardMaterial color={step.color} metalness={0.45} roughness={0.32} />
            </mesh>
            {entry && (
              <group position={[0, step.height, 0]} scale={1.15}>
                <CharacterRig
                  modelPath={entry.characterModelPath}
                  animState={step.rank === 1 ? 'podium' : 'victory'}
                  steerAngle={0}
                />
              </group>
            )}
          </group>
        );
      })}

      <instancedMesh ref={confettiRef} args={[undefined, undefined, CONFETTI_COUNT]}>
        <planeGeometry args={[0.14, 0.24]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}
