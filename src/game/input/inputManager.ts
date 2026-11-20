import type { ControlBindings } from '../core/types';
import type { KartInputState } from '../physics/kartController';

export interface MappedInputFrame {
  kart: KartInputState;
  pausePressed: boolean;
  anyKeyActive: boolean;
}

export function isAnyBoundCodePressed(
  pressedCodes: ReadonlySet<string>,
  codes: readonly string[],
): boolean {
  for (const code of codes) {
    if (pressedCodes.has(code)) return true;
  }
  return false;
}

export function mapKeyboardStateToInput(
  pressedCodes: ReadonlySet<string>,
  bindings: ControlBindings,
  steeringSensitivity = 1.0,
): KartInputState {
  const throttle = isAnyBoundCodePressed(pressedCodes, bindings.accelerate) ? 1 : 0;
  const brake = isAnyBoundCodePressed(pressedCodes, bindings.brake) ? 1 : 0;
  const left = isAnyBoundCodePressed(pressedCodes, bindings.steerLeft);
  const right = isAnyBoundCodePressed(pressedCodes, bindings.steerRight);

  let rawSteer = 0;
  if (left) rawSteer -= 1;
  if (right) rawSteer += 1;

  const steer = Math.max(-1, Math.min(1, rawSteer * steeringSensitivity));

  return {
    throttle,
    brake,
    steer,
    drift: isAnyBoundCodePressed(pressedCodes, bindings.drift),
    useItem: isAnyBoundCodePressed(pressedCodes, bindings.useItem),
    recover: isAnyBoundCodePressed(pressedCodes, bindings.recover),
  };
}

export function applyAnalogDeadzone(value: number, deadzone: number): number {
  const absVal = Math.abs(value);
  if (absVal <= deadzone) return 0;
  const normalized = (absVal - deadzone) / Math.max(0.01, 1 - deadzone);
  return Math.sign(value) * Math.min(1, normalized);
}

export interface GamepadSnapshot {
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
}

export function mapGamepadToInput(
  gamepad: GamepadSnapshot | null,
  deadzone = 0.14,
  steeringSensitivity = 1.0,
): { kart: KartInputState; pausePressed: boolean } {
  if (!gamepad) {
    return {
      kart: { throttle: 0, brake: 0, steer: 0, drift: false, useItem: false, recover: false },
      pausePressed: false,
    };
  }

  const rawAxisX = gamepad.axes[0] ?? 0;
  const steer = Math.max(
    -1,
    Math.min(1, applyAnalogDeadzone(rawAxisX, deadzone) * steeringSensitivity),
  );

  // Standard W3C Gamepad mapping:
  // 0 = A (bottom), 1 = B (right), 2 = X (left), 3 = Y (top)
  // 4 = LB, 5 = RB, 6 = LT, 7 = RT, 9 = Start
  const rtValue = gamepad.buttons[7]?.value ?? 0;
  const ltValue = gamepad.buttons[6]?.value ?? 0;
  const btnA = gamepad.buttons[0]?.pressed ?? false;
  const btnB = gamepad.buttons[1]?.pressed ?? false;
  const btnX = gamepad.buttons[2]?.pressed ?? false;
  const btnY = gamepad.buttons[3]?.pressed ?? false;
  const btnLB = gamepad.buttons[4]?.pressed ?? false;
  const btnRB = gamepad.buttons[5]?.pressed ?? false;
  const btnStart = gamepad.buttons[9]?.pressed ?? false;

  const throttle = Math.max(rtValue, btnA ? 1 : 0);
  const brake = Math.max(ltValue, btnB ? 1 : 0);

  return {
    kart: {
      throttle,
      brake,
      steer,
      drift: btnRB || btnLB,
      useItem: btnX,
      recover: btnY,
    },
    pausePressed: btnStart,
  };
}

export interface VirtualTouchInput {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  useItem: boolean;
  recover: boolean;
}

const EMPTY_VIRTUAL_INPUT: VirtualTouchInput = {
  steer: 0,
  throttle: 0,
  brake: 0,
  drift: false,
  useItem: false,
  recover: false,
};

export function mergeKartInputs(
  kb: KartInputState,
  gp: KartInputState,
  vt: VirtualTouchInput,
  steeringSensitivity = 1.0,
  autoAccelerateActive = false,
): KartInputState {
  const virtualSteer = Math.max(-1, Math.min(1, vt.steer * steeringSensitivity));
  let steer = kb.steer;
  if (Math.abs(gp.steer) > Math.abs(steer)) {
    steer = gp.steer;
  }
  if (Math.abs(virtualSteer) > Math.abs(steer)) {
    steer = virtualSteer;
  }

  const brake = Math.max(kb.brake, gp.brake, vt.brake);
  const autoThrottle = autoAccelerateActive && brake <= 0.05 ? 1 : 0;

  return {
    throttle: Math.max(kb.throttle, gp.throttle, vt.throttle, autoThrottle),
    brake,
    steer,
    drift: kb.drift || gp.drift || vt.drift,
    useItem: kb.useItem || gp.useItem || vt.useItem,
    recover: kb.recover || gp.recover || vt.recover,
  };
}

export class InputManager {
  private readonly pressedCodes = new Set<string>();
  private virtualInput: VirtualTouchInput = { ...EMPTY_VIRTUAL_INPUT };
  private autoAccelerateActive = false;
  private pauseEdgeTriggered = false;
  private prevGamepadPause = false;
  private bindings: ControlBindings;
  private steeringSensitivity: number;
  private gamepadDeadzone: number;
  private attached = false;

  constructor(
    bindings: ControlBindings,
    steeringSensitivity = 1.0,
    gamepadDeadzone = 0.14,
  ) {
    this.bindings = bindings;
    this.steeringSensitivity = steeringSensitivity;
    this.gamepadDeadzone = gamepadDeadzone;
  }

  public updateConfig(
    bindings: ControlBindings,
    steeringSensitivity: number,
    gamepadDeadzone: number,
  ): void {
    this.bindings = bindings;
    this.steeringSensitivity = steeringSensitivity;
    this.gamepadDeadzone = gamepadDeadzone;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code === 'Space' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight'
    ) {
      event.preventDefault();
    }
    if (!this.pressedCodes.has(event.code) && this.bindings.pause.includes(event.code)) {
      this.pauseEdgeTriggered = true;
    }
    this.pressedCodes.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedCodes.delete(event.code);
  };

  public setVirtualInput(partial: Partial<VirtualTouchInput>): void {
    const nextSteer =
      partial.steer !== undefined
        ? Math.max(-1, Math.min(1, partial.steer))
        : this.virtualInput.steer;
    const nextThrottle =
      partial.throttle !== undefined
        ? Math.max(0, Math.min(1, partial.throttle))
        : this.virtualInput.throttle;
    const nextBrake =
      partial.brake !== undefined
        ? Math.max(0, Math.min(1, partial.brake))
        : this.virtualInput.brake;

    this.virtualInput = {
      steer: nextSteer,
      throttle: nextThrottle,
      brake: nextBrake,
      drift: partial.drift ?? this.virtualInput.drift,
      useItem: partial.useItem ?? this.virtualInput.useItem,
      recover: partial.recover ?? this.virtualInput.recover,
    };
  }

  public resetVirtualInput(): void {
    this.virtualInput = { ...EMPTY_VIRTUAL_INPUT };
  }

  public getVirtualInput(): VirtualTouchInput {
    return { ...this.virtualInput };
  }

  public setAutoAccelerate(active: boolean): void {
    this.autoAccelerateActive = active;
  }

  private readonly handleWindowBlur = (): void => {
    this.pressedCodes.clear();
    this.resetVirtualInput();
  };

  public attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.attached = true;
  }

  public detach(): void {
    if (!this.attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.pressedCodes.clear();
    this.resetVirtualInput();
    this.attached = false;
  }

  private getActiveGamepad(): Gamepad | null {
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const pads = navigator.getGamepads();
      return pads.find((pad) => pad && pad.connected) ?? null;
    }
    return null;
  }

  public pollKartOnly(): KartInputState {
    const kb = mapKeyboardStateToInput(
      this.pressedCodes,
      this.bindings,
      this.steeringSensitivity,
    );

    const activePad = this.getActiveGamepad();
    const gp = activePad
      ? mapGamepadToInput(activePad, this.gamepadDeadzone, this.steeringSensitivity).kart
      : { throttle: 0, brake: 0, steer: 0, drift: false, useItem: false, recover: false };

    return mergeKartInputs(
      kb,
      gp,
      this.virtualInput,
      this.steeringSensitivity,
      this.autoAccelerateActive,
    );
  }

  public consumePausePressed(): boolean {
    const activePad = this.getActiveGamepad();
    const gpPauseNow = activePad
      ? mapGamepadToInput(activePad, this.gamepadDeadzone, this.steeringSensitivity).pausePressed
      : false;
    const gpPauseEdge = gpPauseNow && !this.prevGamepadPause;
    this.prevGamepadPause = gpPauseNow;

    const triggered = this.pauseEdgeTriggered || gpPauseEdge;
    this.pauseEdgeTriggered = false;
    return triggered;
  }

  public poll(): MappedInputFrame {
    const virtualActive =
      Math.abs(this.virtualInput.steer) > 0.01 ||
      this.virtualInput.throttle > 0.01 ||
      this.virtualInput.brake > 0.01 ||
      this.virtualInput.drift ||
      this.virtualInput.useItem ||
      this.virtualInput.recover;

    return {
      kart: this.pollKartOnly(),
      pausePressed: this.consumePausePressed(),
      anyKeyActive: this.pressedCodes.size > 0 || virtualActive,
    };
  }
}
