import { useEffect, useRef, useState } from 'react';
import { DRIFT_TIERS } from '../../game/core/constants';
import type { GameMode } from '../../game/core/types';
import type { InputManager } from '../../game/input/inputManager';

type TouchActionKey = 'drift' | 'useItem' | 'brake' | 'recover' | 'accelerate';

export interface TouchControlsProps {
  inputManager: InputManager;
  mode: GameMode;
  autoAccelerate: boolean;
  driftTier: 0 | 1 | 2 | 3;
  driftActive: boolean;
  heldItemName: string | null;
  heldItemIcon: string | null;
  onUserGesture: () => void;
}

function computeSteerFromPad(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0;
  const centerX = rect.left + rect.width * 0.5;
  const halfSpan = Math.max(24, rect.width * 0.4);
  const raw = (clientX - centerX) / halfSpan;
  if (Math.abs(raw) < 0.08) return 0;
  return Math.max(-1, Math.min(1, raw));
}

export function TouchControls({
  inputManager,
  mode,
  autoAccelerate,
  driftTier,
  driftActive,
  heldItemName,
  heldItemIcon,
  onUserGesture,
}: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const steerPointerIdRef = useRef<number | null>(null);
  const actionPointersRef = useRef<Record<TouchActionKey, Set<number>>>({
    drift: new Set(),
    useItem: new Set(),
    brake: new Set(),
    recover: new Set(),
    accelerate: new Set(),
  });

  const [steerUi, setSteerUi] = useState(0);
  const [activeState, setActiveState] = useState<Record<TouchActionKey, boolean>>({
    drift: false,
    useItem: false,
    brake: false,
    recover: false,
    accelerate: false,
  });

  useEffect(() => {
    const clearAllTouches = () => {
      steerPointerIdRef.current = null;
      const pointers = actionPointersRef.current;
      (Object.keys(pointers) as TouchActionKey[]).forEach((k) => {
        pointers[k].clear();
      });
      setSteerUi(0);
      setActiveState({
        drift: false,
        useItem: false,
        brake: false,
        recover: false,
        accelerate: false,
      });
      inputManager.resetVirtualInput();
    };

    const handleGlobalPointerRelease = (e: PointerEvent) => {
      if (steerPointerIdRef.current === e.pointerId) {
        steerPointerIdRef.current = null;
        setSteerUi(0);
        inputManager.setVirtualInput({ steer: 0 });
      }
      const pointers = actionPointersRef.current;
      (Object.keys(pointers) as TouchActionKey[]).forEach((action) => {
        if (pointers[action].delete(e.pointerId) && pointers[action].size === 0) {
          setActiveState((prev) => (prev[action] ? { ...prev, [action]: false } : prev));
          if (action === 'brake') inputManager.setVirtualInput({ brake: 0 });
          else if (action === 'accelerate') inputManager.setVirtualInput({ throttle: 0 });
          else if (action === 'drift') inputManager.setVirtualInput({ drift: false });
          else if (action === 'useItem') inputManager.setVirtualInput({ useItem: false });
          else if (action === 'recover') inputManager.setVirtualInput({ recover: false });
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) clearAllTouches();
    };

    window.addEventListener('pointerup', handleGlobalPointerRelease);
    window.addEventListener('pointercancel', handleGlobalPointerRelease);
    window.addEventListener('blur', clearAllTouches);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerRelease);
      window.removeEventListener('pointercancel', handleGlobalPointerRelease);
      window.removeEventListener('blur', clearAllTouches);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      inputManager.resetVirtualInput();
    };
  }, [inputManager]);

  const handleSteerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onUserGesture();
    if (steerPointerIdRef.current !== null) return;
    steerPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events without OS capture support still work cleanly
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const steer = computeSteerFromPad(e.clientX, rect);
    setSteerUi(steer);
    inputManager.setVirtualInput({ steer });
  };

  const handleSteerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (steerPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const rect = (padRef.current ?? e.currentTarget).getBoundingClientRect();
    const steer = computeSteerFromPad(e.clientX, rect);
    setSteerUi(steer);
    inputManager.setVirtualInput({ steer });
  };

  const handleSteerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (steerPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    steerPointerIdRef.current = null;
    setSteerUi(0);
    inputManager.setVirtualInput({ steer: 0 });
  };

  const pushActionValue = (action: TouchActionKey, active: boolean) => {
    setActiveState((prev) => (prev[action] === active ? prev : { ...prev, [action]: active }));
    if (action === 'brake') {
      inputManager.setVirtualInput({ brake: active ? 1 : 0 });
    } else if (action === 'accelerate') {
      inputManager.setVirtualInput({ throttle: active ? 1 : 0 });
    } else if (action === 'drift') {
      inputManager.setVirtualInput({ drift: active });
    } else if (action === 'useItem') {
      inputManager.setVirtualInput({ useItem: active });
    } else if (action === 'recover' && active) {
      // One-shot pulse prevents repeated recovery triggers if finger stays pressed > 0.55s (MÉDIO-07)
      inputManager.triggerRecoverOnce();
    }
  };

  const handleActionDown = (action: TouchActionKey, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onUserGesture();
    const set = actionPointersRef.current[action];
    set.add(e.pointerId);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore for synthetic events
    }
    pushActionValue(action, true);
  };

  const handleActionRelease = (
    action: TouchActionKey,
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    const set = actionPointersRef.current[action];
    set.delete(e.pointerId);
    pushActionValue(action, set.size > 0);
  };

  const driftTierColor =
    driftTier > 0 ? DRIFT_TIERS[driftTier - 1].sparkColor : undefined;

  return (
    <div
      className="kl-touch-overlay"
      data-testid="touch-controls"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Left Zone: Horizontal Multitouch Steering Pad */}
      <div
        ref={padRef}
        className={`kl-touch-steer-pad ${steerUi !== 0 ? 'engaged' : ''}`}
        data-testid="touch-steer-pad"
        role="group"
        aria-label="Direção Touch"
        onPointerDown={handleSteerDown}
        onPointerMove={handleSteerMove}
        onPointerUp={handleSteerUp}
        onPointerCancel={handleSteerUp}
        onLostPointerCapture={handleSteerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="kl-touch-steer-arrow" aria-hidden="true">
          ◀
        </span>
        <div
          className="kl-touch-steer-knob"
          style={{ transform: `translate3d(${Math.round(steerUi * 52)}px, 0, 0)` }}
          aria-hidden="true"
        />
        <span className="kl-touch-steer-arrow" aria-hidden="true">
          ▶
        </span>
      </div>

      {/* Right Zone: Independent Multitouch Action Cluster */}
      <div className="kl-touch-action-cluster" data-testid="touch-action-cluster">
        <div className="kl-touch-row-top">
          <button
            type="button"
            className={`kl-touch-btn kl-touch-btn-util ${activeState.recover ? 'active' : ''}`}
            data-testid="touch-btn-recover"
            aria-label="Recuperar Kart"
            onPointerDown={(e) => handleActionDown('recover', e)}
            onPointerUp={(e) => handleActionRelease('recover', e)}
            onPointerCancel={(e) => handleActionRelease('recover', e)}
            onLostPointerCapture={(e) => handleActionRelease('recover', e)}
            onContextMenu={(e) => e.preventDefault()}
          >
            RECUP.
          </button>

          {mode !== 'time-trial' && (
            <button
              type="button"
              className={`kl-touch-btn kl-touch-btn-item ${heldItemName ? 'ready' : ''} ${activeState.useItem ? 'active' : ''}`}
              data-testid="touch-btn-item"
              aria-label={heldItemName ? `Usar ${heldItemName}` : 'Usar Item'}
              onPointerDown={(e) => handleActionDown('useItem', e)}
              onPointerUp={(e) => handleActionRelease('useItem', e)}
              onPointerCancel={(e) => handleActionRelease('useItem', e)}
              onLostPointerCapture={(e) => handleActionRelease('useItem', e)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {heldItemIcon ? (
                <img src={heldItemIcon} alt="" className="kl-touch-item-icon" width={28} height={28} />
              ) : (
                <span>ITEM</span>
              )}
            </button>
          )}

          {autoAccelerate ? (
            <span className="kl-touch-auto-badge" data-testid="touch-auto-accel-badge">
              ACEL. AUTO
            </span>
          ) : (
            <button
              type="button"
              className={`kl-touch-btn kl-touch-btn-accel ${activeState.accelerate ? 'active' : ''}`}
              data-testid="touch-btn-accelerate"
              aria-label="Acelerar"
              onPointerDown={(e) => handleActionDown('accelerate', e)}
              onPointerUp={(e) => handleActionRelease('accelerate', e)}
              onPointerCancel={(e) => handleActionRelease('accelerate', e)}
              onLostPointerCapture={(e) => handleActionRelease('accelerate', e)}
              onContextMenu={(e) => e.preventDefault()}
            >
              ACEL.
            </button>
          )}
        </div>

        <div className="kl-touch-row-bottom">
          <button
            type="button"
            className={`kl-touch-btn kl-touch-btn-brake ${activeState.brake ? 'active' : ''}`}
            data-testid="touch-btn-brake"
            aria-label="Freio e Ré"
            onPointerDown={(e) => handleActionDown('brake', e)}
            onPointerUp={(e) => handleActionRelease('brake', e)}
            onPointerCancel={(e) => handleActionRelease('brake', e)}
            onLostPointerCapture={(e) => handleActionRelease('brake', e)}
            onContextMenu={(e) => e.preventDefault()}
          >
            FREIO / RÉ
          </button>

          <button
            type="button"
            className={`kl-touch-btn kl-touch-btn-drift ${activeState.drift || driftActive ? 'active' : ''}`}
            data-testid="touch-btn-drift"
            aria-label="Drift e Salto"
            style={
              driftTierColor
                ? { borderColor: driftTierColor, boxShadow: `0 0 18px ${driftTierColor}80` }
                : undefined
            }
            onPointerDown={(e) => handleActionDown('drift', e)}
            onPointerUp={(e) => handleActionRelease('drift', e)}
            onPointerCancel={(e) => handleActionRelease('drift', e)}
            onLostPointerCapture={(e) => handleActionRelease('drift', e)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {driftTier > 0 ? `DRIFT ${driftTier}` : 'DRIFT'}
          </button>
        </div>
      </div>
    </div>
  );
}
