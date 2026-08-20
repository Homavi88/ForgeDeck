import type { OscType } from "../types";
import { fillNoise } from "./utils";

/** Offline-rendered one-shots so the drum machine works before any sample upload. */
export async function makeDefaultKit(ctx: AudioContext): Promise<Record<string, AudioBuffer>> {
  const kick = await render(ctx, 0.45, (offline) => {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, 0);
    osc.frequency.exponentialRampToValueAtTime(38, 0.12);
    gain.gain.setValueAtTime(1, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.42);
    osc.connect(gain).connect(offline.destination);
    osc.start();
  });

  const snare = await render(ctx, 0.28, (offline) => {
    const noiseBuf = offline.createBuffer(1, offline.sampleRate * 0.28, offline.sampleRate);
    fillNoise(noiseBuf);
    const noise = offline.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = offline.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    const ng = offline.createGain();
    ng.gain.setValueAtTime(0.9, 0);
    ng.gain.exponentialRampToValueAtTime(0.001, 0.22);
    noise.connect(bp).connect(ng).connect(offline.destination);
    const osc = offline.createOscillator();
    osc.frequency.value = 180;
    const og = offline.createGain();
    og.gain.setValueAtTime(0.5, 0);
    og.gain.exponentialRampToValueAtTime(0.001, 0.12);
    osc.connect(og).connect(offline.destination);
    noise.start();
    osc.start();
  });

  const hat = await render(ctx, 0.12, (offline) => {
    const noiseBuf = offline.createBuffer(1, offline.sampleRate * 0.12, offline.sampleRate);
    fillNoise(noiseBuf);
    const src = offline.createBufferSource();
    src.buffer = noiseBuf;
    const hp = offline.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8000;
    const g = offline.createGain();
    g.gain.setValueAtTime(0.35, 0);
    g.gain.exponentialRampToValueAtTime(0.001, 0.08);
    src.connect(hp).connect(g).connect(offline.destination);
    src.start();
  });

  const clap = await render(ctx, 0.3, (offline) => {
    const noiseBuf = offline.createBuffer(1, offline.sampleRate * 0.3, offline.sampleRate);
    fillNoise(noiseBuf);
    const src = offline.createBufferSource();
    src.buffer = noiseBuf;
    const bp = offline.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    const g = offline.createGain();
    g.gain.setValueAtTime(0.001, 0);
    g.gain.setValueAtTime(0.8, 0.01);
    g.gain.setValueAtTime(0.15, 0.03);
    g.gain.setValueAtTime(0.7, 0.045);
    g.gain.exponentialRampToValueAtTime(0.001, 0.28);
    src.connect(bp).connect(g).connect(offline.destination);
    src.start();
  });

  const perc = await render(ctx, 0.2, (offline) => {
    const osc = offline.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(620, 0);
    osc.frequency.exponentialRampToValueAtTime(180, 0.12);
    const g = offline.createGain();
    g.gain.setValueAtTime(0.5, 0);
    g.gain.exponentialRampToValueAtTime(0.001, 0.18);
    osc.connect(g).connect(offline.destination);
    osc.start();
  });

  return { kick, snare, hat, clap, perc, ride: hat, tom: perc, fx: clap };
}

async function render(
  ctx: AudioContext,
  seconds: number,
  graph: (offline: OfflineAudioContext) => void,
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  graph(offline);
  return offline.startRendering();
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const OSC_TYPES: OscType[] = ["sine", "square", "sawtooth", "triangle"];
