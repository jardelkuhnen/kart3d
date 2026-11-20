import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../game/core/constants';
import {
  InputManager,
  applyAnalogDeadzone,
  mapGamepadToInput,
  mapKeyboardStateToInput,
} from '../game/input/inputManager';

describe('Input Mapping (Keyboard, Remapping & Gamepad API)', () => {
  it('maps default WASD, Arrow, Space, Shift and R keys accurately', () => {
    const input = mapKeyboardStateToInput(
      new Set(['KeyW', 'KeyA', 'Space', 'ShiftLeft']),
      DEFAULT_BINDINGS,
      1.0,
    );
    expect(input.throttle).toBe(1);
    expect(input.brake).toBe(0);
    expect(input.steer).toBe(-1);
    expect(input.drift).toBe(true);
    expect(input.useItem).toBe(true);
    expect(input.recover).toBe(false);
  });

  it('supports custom remapped bindings and steering sensitivity clamping', () => {
    const custom = {
      ...DEFAULT_BINDINGS,
      accelerate: ['KeyI'],
      steerRight: ['KeyL'],
      drift: ['KeyK'],
    };

    const input = mapKeyboardStateToInput(new Set(['KeyI', 'KeyL', 'KeyK']), custom, 0.75);
    expect(input.throttle).toBe(1);
    expect(input.steer).toBe(0.75);
    expect(input.drift).toBe(true);
  });

  it('applies analog deadzone and maps standard Gamepad axes/triggers', () => {
    expect(applyAnalogDeadzone(0.08, 0.14)).toBe(0);
    expect(applyAnalogDeadzone(1.0, 0.14)).toBeCloseTo(1, 5);

    const mapped = mapGamepadToInput(
      {
        axes: [0.57, 0],
        buttons: [
          { pressed: false, value: 0 }, // A
          { pressed: false, value: 0 }, // B
          { pressed: true, value: 1 }, // X -> useItem
          { pressed: false, value: 0 }, // Y
          { pressed: false, value: 0 }, // LB
          { pressed: true, value: 1 }, // RB -> drift
          { pressed: false, value: 0 }, // LT
          { pressed: true, value: 0.9 }, // RT -> throttle
          { pressed: false, value: 0 },
          { pressed: true, value: 1 }, // Start -> pause
        ],
      },
      0.14,
      1.0,
    );

    expect(mapped.kart.throttle).toBeCloseTo(0.9, 5);
    expect(mapped.kart.steer).toBeCloseTo(0.5, 5);
    expect(mapped.kart.drift).toBe(true);
    expect(mapped.kart.useItem).toBe(true);
    expect(mapped.pausePressed).toBe(true);
  });

  it('queues a single-step recover pulse via triggerRecoverOnce() for HUD button use', () => {
    const manager = new InputManager(DEFAULT_BINDINGS);
    expect(manager.pollKartOnly().recover).toBe(false);

    manager.triggerRecoverOnce();
    expect(manager.pollKartOnly().recover).toBe(true);
    expect(manager.pollKartOnly().recover).toBe(false);
  });

  it('does not preventDefault Space or Arrow keys outside active race gameplay (ALTO-02)', () => {
    const manager = new InputManager(DEFAULT_BINDINGS);
    manager.attach();

    // Default (menus/settings): Space & ArrowRight must NOT be blocked
    const spaceMenu = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    const arrowMenu = new KeyboardEvent('keydown', { code: 'ArrowRight', cancelable: true });
    window.dispatchEvent(spaceMenu);
    window.dispatchEvent(arrowMenu);
    expect(spaceMenu.defaultPrevented).toBe(false);
    expect(arrowMenu.defaultPrevented).toBe(false);

    // Active race gameplay: Space & ArrowRight ARE captured
    manager.setCaptureGameplayKeys(true);
    const spaceRace = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    const arrowRace = new KeyboardEvent('keydown', { code: 'ArrowRight', cancelable: true });
    window.dispatchEvent(spaceRace);
    window.dispatchEvent(arrowRace);
    expect(spaceRace.defaultPrevented).toBe(true);
    expect(arrowRace.defaultPrevented).toBe(true);

    manager.detach();
  });
});
