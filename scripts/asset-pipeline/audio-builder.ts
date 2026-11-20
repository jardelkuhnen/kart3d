import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SynthNote {
  freqHz: number;
  endFreqHz?: number;
  startSec: number;
  durationSec: number;
  waveform: 'sine' | 'triangle' | 'square' | 'saw' | 'noise';
  gain: number;
  attackSec?: number;
  releaseSec?: number;
}

function sampleWaveform(type: SynthNote['waveform'], phase: number, noiseSeed: number): number {
  const frac = phase - Math.floor(phase);
  switch (type) {
    case 'sine':
      return Math.sin(phase * Math.PI * 2);
    case 'triangle':
      return 1 - 4 * Math.abs(Math.round(frac - 0.25) - (frac - 0.25));
    case 'square':
      return frac < 0.5 ? 0.75 : -0.75;
    case 'saw':
      return 2 * frac - 1;
    case 'noise': {
      const s = Math.sin(noiseSeed * 12.9898 + phase * 78.233) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    }
  }
}

export function synthesizeNotesToWav(
  notes: readonly SynthNote[],
  totalDurationSec: number,
  sampleRate = 44100,
): Buffer {
  const totalSamples = Math.max(1, Math.ceil(totalDurationSec * sampleRate));
  const mix = new Float32Array(totalSamples);

  for (let nIdx = 0; nIdx < notes.length; nIdx += 1) {
    const note = notes[nIdx];
    const startSample = Math.max(0, Math.floor(note.startSec * sampleRate));
    const noteSamples = Math.max(1, Math.floor(note.durationSec * sampleRate));
    const endSample = Math.min(totalSamples, startSample + noteSamples);
    const attackSamples = Math.max(1, Math.floor((note.attackSec ?? 0.008) * sampleRate));
    const releaseSamples = Math.max(1, Math.floor((note.releaseSec ?? 0.06) * sampleRate));

    let phase = 0;
    for (let i = startSample; i < endSample; i += 1) {
      const localIdx = i - startSample;
      const tNorm = localIdx / noteSamples;
      const freq =
        note.endFreqHz !== undefined
          ? note.freqHz + (note.endFreqHz - note.freqHz) * tNorm
          : note.freqHz;

      let env = 1;
      if (localIdx < attackSamples) {
        env = localIdx / attackSamples;
      } else if (noteSamples - localIdx < releaseSamples) {
        env = Math.max(0, (noteSamples - localIdx) / releaseSamples);
      }

      phase += freq / sampleRate;
      mix[i] += sampleWaveform(note.waveform, phase, i + nIdx * 997) * note.gain * env;
    }
  }

  // Soft limiter + 16-bit PCM WAV encoding
  const dataSize = totalSamples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); // PCM chunk size
  wav.writeUInt16LE(1, 20); // PCM format
  wav.writeUInt16LE(1, 22); // Mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < totalSamples; i += 1) {
    const softClipped = Math.tanh(mix[i]);
    const pcm = Math.max(-32767, Math.min(32767, Math.round(softClipped * 32000)));
    wav.writeInt16LE(pcm, 44 + i * 2);
  }

  return wav;
}

export async function encodeWavToOgg(wavBuffer: Buffer, outOggPath: string): Promise<number> {
  await fs.mkdir(path.dirname(outOggPath), { recursive: true });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kl3d-audio-'));
  const tmpWav = path.join(tmpDir, 'input.wav');

  try {
    await fs.writeFile(tmpWav, wavBuffer);
    await execFileAsync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      tmpWav,
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
      outOggPath,
    ]);
    const stat = await fs.stat(outOggPath);
    return stat.size;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function generateUiClickOgg(outPath: string): Promise<number> {
  const wav = synthesizeNotesToWav(
    [
      {
        freqHz: 960,
        endFreqHz: 620,
        startSec: 0,
        durationSec: 0.055,
        waveform: 'triangle',
        gain: 0.55,
        attackSec: 0.002,
        releaseSec: 0.03,
      },
      {
        freqHz: 1440,
        endFreqHz: 1120,
        startSec: 0,
        durationSec: 0.03,
        waveform: 'sine',
        gain: 0.3,
        attackSec: 0.001,
        releaseSec: 0.02,
      },
    ],
    0.075,
  );
  return encodeWavToOgg(wav, outPath);
}

export async function generateUiConfirmOgg(outPath: string): Promise<number> {
  const wav = synthesizeNotesToWav(
    [
      {
        freqHz: 523.25, // C5
        startSec: 0,
        durationSec: 0.09,
        waveform: 'triangle',
        gain: 0.45,
        attackSec: 0.004,
        releaseSec: 0.04,
      },
      {
        freqHz: 659.25, // E5
        startSec: 0.055,
        durationSec: 0.1,
        waveform: 'triangle',
        gain: 0.48,
        attackSec: 0.004,
        releaseSec: 0.045,
      },
      {
        freqHz: 783.99, // G5
        startSec: 0.11,
        durationSec: 0.18,
        waveform: 'sine',
        gain: 0.52,
        attackSec: 0.005,
        releaseSec: 0.12,
      },
    ],
    0.32,
  );
  return encodeWavToOgg(wav, outPath);
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export async function generateMenuThemeOgg(outPath: string): Promise<number> {
  const bpm = 128;
  const beat = 60 / bpm;
  const notes: SynthNote[] = [];
  const melody = [60, 64, 67, 72, 71, 67, 64, 67, 62, 65, 69, 74, 72, 69, 67, 64];
  const bass = [36, 36, 43, 43, 41, 41, 43, 43];

  for (let i = 0; i < melody.length; i += 1) {
    notes.push({
      freqHz: midiToHz(melody[i]),
      startSec: i * beat * 0.5,
      durationSec: beat * 0.44,
      waveform: 'triangle',
      gain: 0.36,
      attackSec: 0.01,
      releaseSec: 0.08,
    });
  }
  for (let i = 0; i < bass.length; i += 1) {
    notes.push({
      freqHz: midiToHz(bass[i]),
      startSec: i * beat,
      durationSec: beat * 0.85,
      waveform: 'sine',
      gain: 0.4,
      attackSec: 0.01,
      releaseSec: 0.12,
    });
  }

  return encodeWavToOgg(synthesizeNotesToWav(notes, melody.length * beat * 0.5), outPath);
}

export async function generateRaceMusicOgg(outPath: string): Promise<number> {
  const bpm = 142;
  const step = 60 / bpm / 2; // eighth notes
  const notes: SynthNote[] = [];
  // Energetic 32-step coastal arcade racing loop
  const lead = [
    64, 67, 71, 76, 74, 71, 69, 67,
    64, 67, 71, 74, 76, 79, 76, 74,
    65, 69, 72, 77, 76, 72, 71, 69,
    67, 71, 74, 79, 76, 74, 71, 67,
  ];
  const bassRoots = [40, 40, 40, 40, 43, 43, 43, 43, 41, 41, 41, 41, 43, 43, 47, 47];

  for (let i = 0; i < lead.length; i += 1) {
    notes.push({
      freqHz: midiToHz(lead[i]),
      startSec: i * step,
      durationSec: step * 0.82,
      waveform: 'saw',
      gain: 0.2,
      attackSec: 0.008,
      releaseSec: 0.06,
    });
    // Crisp hi-hat pulse
    notes.push({
      freqHz: 2400,
      startSec: i * step,
      durationSec: 0.035,
      waveform: 'noise',
      gain: i % 2 === 1 ? 0.11 : 0.05,
      attackSec: 0.002,
      releaseSec: 0.02,
    });
  }
  for (let i = 0; i < bassRoots.length; i += 1) {
    notes.push({
      freqHz: midiToHz(bassRoots[i]),
      startSec: i * step * 2,
      durationSec: step * 1.7,
      waveform: 'triangle',
      gain: 0.42,
      attackSec: 0.008,
      releaseSec: 0.08,
    });
  }

  return encodeWavToOgg(synthesizeNotesToWav(notes, lead.length * step), outPath);
}

export async function generateVictoryFanfareOgg(outPath: string): Promise<number> {
  const notes: SynthNote[] = [
    { freqHz: 523.25, startSec: 0.0, durationSec: 0.14, waveform: 'triangle', gain: 0.48 },
    { freqHz: 659.25, startSec: 0.13, durationSec: 0.14, waveform: 'triangle', gain: 0.5 },
    { freqHz: 783.99, startSec: 0.26, durationSec: 0.16, waveform: 'triangle', gain: 0.52 },
    { freqHz: 1046.5, startSec: 0.42, durationSec: 0.72, waveform: 'triangle', gain: 0.55, releaseSec: 0.35 },
    { freqHz: 523.25, startSec: 0.42, durationSec: 0.72, waveform: 'sine', gain: 0.35, releaseSec: 0.35 },
  ];
  return encodeWavToOgg(synthesizeNotesToWav(notes, 1.25), outPath);
}

export async function generateDefeatThemeOgg(outPath: string): Promise<number> {
  const notes: SynthNote[] = [
    { freqHz: 440, startSec: 0.0, durationSec: 0.24, waveform: 'triangle', gain: 0.42 },
    { freqHz: 392, startSec: 0.24, durationSec: 0.24, waveform: 'triangle', gain: 0.42 },
    { freqHz: 349.23, startSec: 0.48, durationSec: 0.28, waveform: 'triangle', gain: 0.42 },
    { freqHz: 293.66, endFreqHz: 261.63, startSec: 0.76, durationSec: 0.55, waveform: 'sine', gain: 0.46, releaseSec: 0.25 },
  ];
  return encodeWavToOgg(synthesizeNotesToWav(notes, 1.4), outPath);
}

export async function generateAmbienceCoastalOgg(outPath: string): Promise<number> {
  // Gentle multi-layered surf & coastal breeze swell (4s seamless loop)
  const duration = 4.0;
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const mix = new Float32Array(totalSamples);
  let lp = 0;

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const swell = 0.35 + 0.25 * Math.sin((t / duration) * Math.PI * 2);
    const white = Math.sin(i * 12.9898) * 43758.5453;
    const noise = (white - Math.floor(white)) * 2 - 1;
    lp = lp * 0.96 + noise * 0.04;
    mix[i] = lp * swell * 1.4;
  }

  const dataSize = totalSamples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < totalSamples; i += 1) {
    wav.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(Math.tanh(mix[i]) * 26000))), 44 + i * 2);
  }
  return encodeWavToOgg(wav, outPath);
}

export async function generateRaceSfxLibrary(sfxDir: string): Promise<Record<string, number>> {
  const specs: Record<string, { duration: number; notes: SynthNote[] }> = {
    countdown_beep: {
      duration: 0.22,
      notes: [{ freqHz: 440, startSec: 0, durationSec: 0.18, waveform: 'triangle', gain: 0.55 }],
    },
    countdown_go: {
      duration: 0.42,
      notes: [
        { freqHz: 880, startSec: 0, durationSec: 0.36, waveform: 'triangle', gain: 0.6 },
        { freqHz: 1108.73, startSec: 0.02, durationSec: 0.34, waveform: 'sine', gain: 0.4 },
      ],
    },
    drift_spark: {
      duration: 0.18,
      notes: [
        { freqHz: 1100, endFreqHz: 1750, startSec: 0, durationSec: 0.14, waveform: 'triangle', gain: 0.42 },
        { freqHz: 1800, startSec: 0, durationSec: 0.08, waveform: 'noise', gain: 0.25 },
      ],
    },
    turbo_boost: {
      duration: 0.48,
      notes: [
        { freqHz: 220, endFreqHz: 660, startSec: 0, durationSec: 0.42, waveform: 'saw', gain: 0.45 },
        { freqHz: 880, endFreqHz: 1320, startSec: 0.04, durationSec: 0.35, waveform: 'noise', gain: 0.28 },
      ],
    },
    collision_hit: {
      duration: 0.28,
      notes: [
        { freqHz: 180, endFreqHz: 55, startSec: 0, durationSec: 0.22, waveform: 'square', gain: 0.6 },
        { freqHz: 600, startSec: 0, durationSec: 0.12, waveform: 'noise', gain: 0.45 },
      ],
    },
    jump_launch: {
      duration: 0.26,
      notes: [{ freqHz: 280, endFreqHz: 760, startSec: 0, durationSec: 0.22, waveform: 'sine', gain: 0.52 }],
    },
    land_thud: {
      duration: 0.16,
      notes: [
        { freqHz: 140, endFreqHz: 50, startSec: 0, durationSec: 0.14, waveform: 'sine', gain: 0.6 },
        { freqHz: 320, startSec: 0, durationSec: 0.06, waveform: 'noise', gain: 0.25 },
      ],
    },
    item_pickup: {
      duration: 0.28,
      notes: [
        { freqHz: 587.33, startSec: 0, durationSec: 0.08, waveform: 'triangle', gain: 0.46 },
        { freqHz: 880, startSec: 0.07, durationSec: 0.16, waveform: 'sine', gain: 0.52 },
      ],
    },
    item_use: {
      duration: 0.3,
      notes: [
        { freqHz: 660, endFreqHz: 1080, startSec: 0, durationSec: 0.24, waveform: 'triangle', gain: 0.5 },
      ],
    },
    lap_complete: {
      duration: 0.5,
      notes: [
        { freqHz: 587.33, startSec: 0, durationSec: 0.11, waveform: 'triangle', gain: 0.5 },
        { freqHz: 739.99, startSec: 0.11, durationSec: 0.11, waveform: 'triangle', gain: 0.5 },
        { freqHz: 880, startSec: 0.22, durationSec: 0.24, waveform: 'triangle', gain: 0.56 },
      ],
    },
    race_finish: {
      duration: 0.72,
      notes: [
        { freqHz: 523.25, startSec: 0, durationSec: 0.12, waveform: 'triangle', gain: 0.5 },
        { freqHz: 659.25, startSec: 0.11, durationSec: 0.12, waveform: 'triangle', gain: 0.5 },
        { freqHz: 783.99, startSec: 0.22, durationSec: 0.14, waveform: 'triangle', gain: 0.52 },
        { freqHz: 1046.5, startSec: 0.35, durationSec: 0.34, waveform: 'sine', gain: 0.58 },
      ],
    },
  };

  const results: Record<string, number> = {};
  const keys = Object.keys(specs);
  await Promise.all(
    keys.map(async (key) => {
      const spec = specs[key];
      const wav = synthesizeNotesToWav(spec.notes, spec.duration);
      results[key] = await encodeWavToOgg(wav, path.join(sfxDir, `${key}.ogg`));
    }),
  );
  return results;
}
