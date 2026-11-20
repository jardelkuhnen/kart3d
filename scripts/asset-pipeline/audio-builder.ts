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
