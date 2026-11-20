import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../app/store';
import { disposeObject3D } from '../game/core/assetLoader';
import { publicUrl } from '../game/core/publicUrl';
import { FIXED_TIMESTEP, FixedStepClock } from '../game/core/constants';

function configureTiledTexture(
  source: THREE.Texture,
  repeatX: number,
  repeatY: number,
  colorSpace: THREE.ColorSpace,
): THREE.Texture {
  const tex = source.clone();
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function TrackFoundationMesh() {
  const rawTextures = useTexture({
    asphaltMap: publicUrl('/assets/textures/asphalt_albedo.png'),
    asphaltRoughness: publicUrl('/assets/textures/asphalt_roughness.png'),
    curbMap: publicUrl('/assets/textures/curb_albedo.png'),
    startLineMap: publicUrl('/assets/textures/start_line_albedo.png'),
  });

  const textures = useMemo(() => {
    const startLineMap = rawTextures.startLineMap.clone();
    startLineMap.colorSpace = THREE.SRGBColorSpace;
    startLineMap.needsUpdate = true;

    return {
      asphaltMap: configureTiledTexture(rawTextures.asphaltMap, 1, 8, THREE.SRGBColorSpace),
      asphaltRoughness: configureTiledTexture(
        rawTextures.asphaltRoughness,
        1,
        8,
        THREE.NoColorSpace,
      ),
      curbMap: configureTiledTexture(rawTextures.curbMap, 1, 14, THREE.SRGBColorSpace),
      startLineMap,
    };
  }, [rawTextures]);

  useEffect(() => {
    return () => {
      textures.asphaltMap.dispose();
      textures.asphaltRoughness.dispose();
      textures.curbMap.dispose();
      textures.startLineMap.dispose();
    };
  }, [textures]);

  return (
    <group>
      {/* Physics ground + road deck */}
      <RigidBody type="fixed" colliders={false} restitution={0.2} friction={1}>
        <CuboidCollider args={[40, 0.5, 60]} position={[0, -0.5, 0]} />
        <CuboidCollider args={[0.7, 0.35, 60]} position={[-7.6, 0.15, 0]} />
        <CuboidCollider args={[0.7, 0.35, 60]} position={[7.6, 0.15, 0]} />
      </RigidBody>

      {/* Sunlit grass terrain surround */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#3c994a" roughness={0.95} />
      </mesh>

      {/* Main asphalt straightaway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} receiveShadow>
        <planeGeometry args={[14, 96]} />
        <meshStandardMaterial
          map={textures.asphaltMap}
          roughnessMap={textures.asphaltRoughness}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>

      {/* Checkered start/finish line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[13.6, 3.2]} />
        <meshStandardMaterial map={textures.startLineMap} roughness={0.65} />
      </mesh>

      {/* Left & Right checkered apex curbs */}
      <mesh position={[-7.55, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.1, 0.16, 96]} />
        <meshStandardMaterial map={textures.curbMap} roughness={0.75} />
      </mesh>
      <mesh position={[7.55, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.1, 0.16, 96]} />
        <meshStandardMaterial map={textures.curbMap} roughness={0.75} />
      </mesh>
    </group>
  );
}

function CalibrationProps() {
  const gantryGltf = useGLTF(publicUrl('/assets/props/start_gantry.glb'));
  const chevronGltf = useGLTF(publicUrl('/assets/props/chevron_board.glb'));
  const boostPadGltf = useGLTF(publicUrl('/assets/props/boost_pad.glb'));

  const gantryScene = useMemo(() => gantryGltf.scene.clone(true), [gantryGltf.scene]);
  const chevronLeft = useMemo(() => chevronGltf.scene.clone(true), [chevronGltf.scene]);
  const chevronRight = useMemo(() => chevronGltf.scene.clone(true), [chevronGltf.scene]);
  const boostPadLeft = useMemo(() => boostPadGltf.scene.clone(true), [boostPadGltf.scene]);
  const boostPadRight = useMemo(() => boostPadGltf.scene.clone(true), [boostPadGltf.scene]);

  useEffect(() => {
    for (const root of [gantryScene, chevronLeft, chevronRight, boostPadLeft, boostPadRight]) {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
    }
    return () => {
      for (const root of [gantryScene, chevronLeft, chevronRight, boostPadLeft, boostPadRight]) {
        disposeObject3D(root);
      }
    };
  }, [gantryScene, chevronLeft, chevronRight, boostPadLeft, boostPadRight]);

  return (
    <group>
      <primitive object={gantryScene} position={[0, 0, 0]} />
      <primitive
        object={chevronLeft}
        position={[-9.5, 0, -24]}
        rotation={[0, Math.PI * 0.14, 0]}
      />
      <primitive
        object={chevronRight}
        position={[9.5, 0, -24]}
        rotation={[0, -Math.PI * 0.14, 0]}
      />
      <primitive object={boostPadLeft} position={[-3.2, 0.01, -12]} />
      <primitive object={boostPadRight} position={[3.2, 0.01, -12]} />
    </group>
  );
}

function PhysicsCalibrationProbe() {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const incrementPhysicsSteps = useGameStore((s) => s.incrementPhysicsSteps);
  const clockRef = useRef(new FixedStepClock(FIXED_TIMESTEP));
  const pendingStepsRef = useRef(0);

  useFrame((_state, delta) => {
    const executed = clockRef.current.advance(delta, () => {
      const body = bodyRef.current;
      if (!body) return;
      const pos = body.translation();
      // Gently reset calibration beacon if it rolls far away
      if (Math.abs(pos.x) > 7 || Math.abs(pos.z) > 25 || pos.y < -2) {
        body.setTranslation({ x: 0, y: 3.4, z: 3.5 }, true);
        body.setLinvel({ x: 0.4, y: 0, z: -1.8 }, true);
      }
    });

    pendingStepsRef.current += executed;
    if (pendingStepsRef.current >= 15) {
      incrementPhysicsSteps(pendingStepsRef.current);
      pendingStepsRef.current = 0;
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 3.4, 3.5]}
      colliders="ball"
      restitution={0.55}
      linearVelocity={[0.4, 0, -1.8]}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial
          color="#ffb800"
          emissive="#f59e0b"
          emissiveIntensity={0.28}
          metalness={0.35}
          roughness={0.25}
        />
      </mesh>
    </RigidBody>
  );
}

export function CalibrationStage() {
  const quality = useGameStore((s) => s.settings.quality);
  const dpr: [number, number] = quality === 'low' ? [1, 1] : quality === 'medium' ? [1, 1.5] : [1, 2];

  return (
    <div className="kl-canvas-wrap">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 5.2, 13.5], fov: 50, near: 0.2, far: 400 }}
      >
        <color attach="background" args={['#1c6ed8']} />
        <fog attach="fog" args={['#7dd3fc', 38, 135]} />

        <ambientLight intensity={0.55} color="#dbeafe" />
        <directionalLight
          position={[18, 28, 16]}
          intensity={1.9}
          color="#fff7ed"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={2}
          shadow-camera-far={90}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />

        <Suspense fallback={null}>
          <Environment resolution={256} frames={1}>
            <Lightformer
              form="rect"
              intensity={2.2}
              color="#fff7ed"
              position={[0, 14, -10]}
              scale={[30, 10, 1]}
              rotation={[Math.PI / 4, 0, 0]}
            />
            <Lightformer
              form="ring"
              intensity={1.3}
              color="#60a5fa"
              position={[-12, 8, 8]}
              scale={12}
            />
            <Lightformer
              form="rect"
              intensity={0.8}
              color="#34d399"
              position={[0, -6, 0]}
              scale={[40, 40, 1]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
          </Environment>
          <Physics gravity={[0, -24, 0]} timeStep={FIXED_TIMESTEP}>
            <TrackFoundationMesh />
            <CalibrationProps />
            <PhysicsCalibrationProbe />
          </Physics>
        </Suspense>

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI * 0.46}
          minDistance={6}
          maxDistance={28}
          target={[0, 1.8, -3]}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(publicUrl('/assets/props/start_gantry.glb'));
useGLTF.preload(publicUrl('/assets/props/chevron_board.glb'));
useGLTF.preload(publicUrl('/assets/props/boost_pad.glb'));
