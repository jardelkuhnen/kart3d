import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RacePhase, RaceProgressTracker } from '../racing/raceManager';
import { type TrackLayoutDef, evaluateCatmullRom } from '../tracks/trackGeometry';
import type { LiveKartPose } from '../core/types';

export interface RaceCameraProps {
  layout: TrackLayoutDef;
  poseRef: React.MutableRefObject<LiveKartPose>;
  trackerRef: React.MutableRefObject<RaceProgressTracker>;
}

export function RaceCamera({ layout, poseRef, trackerRef }: RaceCameraProps) {
  const smoothPosRef = useRef(new THREE.Vector3(0, 6, 52));
  const smoothLookRef = useRef(new THREE.Vector3(0, 1.5, 34));
  const introTimeRef = useRef(0);
  const finishAngleRef = useRef(0);
  const prevPhaseRef = useRef<RacePhase>('intro');

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const pose = poseRef.current;
    const phase = trackerRef.current.phase;
    const justEnteredCountdown = phase === 'countdown' && prevPhaseRef.current !== 'countdown';
    prevPhaseRef.current = phase;
    const perspCam = state.camera as THREE.PerspectiveCamera;

    if (phase === 'intro') {
      introTimeRef.current = (introTimeRef.current + dt * 0.14) % 1;
      const camPt = evaluateCatmullRom(layout.introCameraPoints, introTimeRef.current, true);
      const lookPt = evaluateCatmullRom(
        layout.introCameraPoints,
        (introTimeRef.current + 0.18) % 1,
        true,
      );
      smoothPosRef.current.lerp(
        new THREE.Vector3(camPt.x, camPt.y, camPt.z),
        1 - Math.exp(-3.5 * dt),
      );
      smoothLookRef.current.lerp(
        new THREE.Vector3(lookPt.x * 0.5, 2.5, lookPt.z * 0.5),
        1 - Math.exp(-3.5 * dt),
      );
      perspCam.fov += (54 - perspCam.fov) * (1 - Math.exp(-4 * dt));
    } else if (phase === 'finished') {
      finishAngleRef.current += dt * 0.85;
      const orbitX = pose.x + Math.sin(finishAngleRef.current) * 6.5;
      const orbitZ = pose.z + Math.cos(finishAngleRef.current) * 6.5;
      const targetPos = new THREE.Vector3(orbitX, pose.y + 2.4, orbitZ);
      const targetLook = new THREE.Vector3(pose.x, pose.y + 1.1, pose.z);
      smoothPosRef.current.lerp(targetPos, 1 - Math.exp(-4 * dt));
      smoothLookRef.current.lerp(targetLook, 1 - Math.exp(-5 * dt));
      perspCam.fov += (52 - perspCam.fov) * (1 - Math.exp(-5 * dt));
    } else {
      const speedNorm = Math.min(1, Math.max(0, pose.forwardSpeed / 36));
      const cameraYaw = pose.yaw + pose.visualSlipYaw * 0.35;
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);

      const followDist =
        phase === 'countdown'
          ? 5.6
          : 5.9 + speedNorm * 1.45 + (pose.boostActive ? 1.1 : 0);
      const followHeight = phase === 'countdown' ? 2.45 : 2.65 + speedNorm * 0.35;

      const rawCamX = pose.x - forwardX * followDist;
      const rawCamZ = pose.z - forwardZ * followDist;
      const rawCamY = Math.max(pose.groundHeight + 1.4, pose.y + followHeight);

      const targetPos = new THREE.Vector3(rawCamX, rawCamY, rawCamZ);
      const targetLook = new THREE.Vector3(
        pose.x + forwardX * 6.0,
        pose.y + 1.35,
        pose.z + forwardZ * 6.0,
      );

      if (justEnteredCountdown) {
        smoothPosRef.current.copy(targetPos);
        smoothLookRef.current.copy(targetLook);
      } else {
        smoothPosRef.current.lerp(targetPos, 1 - Math.exp(-8.5 * dt));
        smoothLookRef.current.lerp(targetLook, 1 - Math.exp(-12.0 * dt));
      }

      const targetFov = pose.boostActive ? 68 : 56 + speedNorm * 6;
      perspCam.fov += (targetFov - perspCam.fov) * (1 - Math.exp(-7 * dt));
    }

    perspCam.updateProjectionMatrix();
    perspCam.position.copy(smoothPosRef.current);
    perspCam.lookAt(smoothLookRef.current);

    if (phase === 'racing') {
      perspCam.rotation.z += -pose.steerAngle * 0.032;
    }
  });

  return null;
}
