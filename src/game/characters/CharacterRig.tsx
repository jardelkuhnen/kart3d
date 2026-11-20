import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { disposeObject3D } from '../core/assetLoader';
import type { CharacterAnimState } from '../core/types';

export interface CharacterRigProps {
  modelPath: string;
  animState: CharacterAnimState;
  steerAngle?: number;
}

export function CharacterRig({ modelPath, animState, steerAngle = 0 }: CharacterRigProps) {
  const gltf = useGLTF(modelPath);

  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeStateRef = useRef<CharacterAnimState | null>(null);
  const headNodeRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    clonedScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      if (obj.name === 'Head') {
        headNodeRef.current = obj;
      }
    });

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    const actions: Record<string, THREE.AnimationAction> = {};

    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      if (clip.name === 'hit' || clip.name === 'defeat') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      actions[clip.name] = action;
    }
    actionsRef.current = actions;

    // Start immediately in idle
    const initial = actions[animState] ?? actions.idle ?? Object.values(actions)[0];
    if (initial) {
      initial.reset().play();
      activeStateRef.current = animState;
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      disposeObject3D(clonedScene);
      mixerRef.current = null;
      actionsRef.current = {};
      activeStateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, gltf.animations]);

  useEffect(() => {
    const actions = actionsRef.current;
    const prevName = activeStateRef.current;
    if (prevName === animState) return;

    const nextAction = actions[animState] ?? actions.idle;
    if (!nextAction) return;

    const prevAction = prevName ? actions[prevName] : undefined;
    nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, 0.16, true);
    }
    activeStateRef.current = animState;
  }, [animState]);

  useFrame((_state, delta) => {
    const mixer = mixerRef.current;
    if (mixer) {
      mixer.update(Math.min(delta, 0.05));
    }
    if (headNodeRef.current) {
      // Subtle responsive head anticipation into turns on top of clip pose
      headNodeRef.current.rotation.y += -steerAngle * 0.12;
    }
  });

  return <primitive object={clonedScene} />;
}
