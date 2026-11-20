import type { ControlBindings } from '../core/types';

const CODE_LABELS: Record<string, string> = {
  Space: 'ESPAÇO',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
  ControlLeft: 'CTRL',
  ControlRight: 'CTRL',
  AltLeft: 'ALT',
  AltRight: 'ALT',
  Escape: 'ESC',
  Enter: 'ENTER',
  Backspace: 'BACKSPACE',
  Tab: 'TAB',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

export function formatKeyCode(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  return code;
}

export function formatBindingShort(codes: readonly string[]): string {
  const unique = Array.from(new Set(codes.map(formatKeyCode)));
  return unique.join(' / ');
}

export function formatPrimaryKey(codes: readonly string[]): string {
  return codes.length > 0 ? formatKeyCode(codes[0]) : '';
}

export function formatDrivingBindingsSummary(bindings: ControlBindings): {
  drive: string;
  drift: string;
  useItem: string;
  recover: string;
} {
  const driveKeys = [
    formatPrimaryKey(bindings.accelerate),
    formatPrimaryKey(bindings.steerLeft),
    formatPrimaryKey(bindings.brake),
    formatPrimaryKey(bindings.steerRight),
  ].join('');
  const hasArrows = bindings.accelerate.includes('ArrowUp');
  const drive =
    driveKeys === 'WASD' && hasArrows
      ? 'WASD / Setas'
      : `${formatPrimaryKey(bindings.accelerate)}/${formatPrimaryKey(bindings.brake)}/${formatPrimaryKey(bindings.steerLeft)}/${formatPrimaryKey(bindings.steerRight)}`;
  return {
    drive,
    drift: formatBindingShort(bindings.drift),
    useItem: formatBindingShort(bindings.useItem),
    recover: formatBindingShort(bindings.recover),
  };
}
