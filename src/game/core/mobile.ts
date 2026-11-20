import type { QualityLevel, TouchControlsMode } from './types';

export function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const hasOntouch = 'ontouchstart' in window;
  const hasTouchPoints = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return hasOntouch || hasTouchPoints || hasCoarsePointer;
}

export function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (!detectTouchDevice()) return false;
  const narrowShortEdge = Math.min(window.innerWidth, window.innerHeight) <= 900;
  const mobileUa =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
  return narrowShortEdge || mobileUa;
}

export function getRecommendedInitialQuality(isMobile: boolean): QualityLevel {
  return isMobile ? 'low' : 'high';
}

export function clampCanvasDpr(
  presetDpr: [number, number],
  isMobile: boolean,
): [number, number] {
  const maxCap = isMobile ? 1.5 : Math.max(1, presetDpr[1]);
  return [Math.min(presetDpr[0], maxCap), Math.min(presetDpr[1], maxCap)];
}

export function resolveTouchControlsVisible(
  mode: TouchControlsMode,
  isTouchDevice: boolean,
): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return isTouchDevice;
}
