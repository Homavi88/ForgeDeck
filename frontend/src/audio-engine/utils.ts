/**
 * ForgeDeck Web Audio engine
 *
 * Python cannot do low-latency playback in the browser. All realtime sound
 * is generated here with the Web Audio API. BufferSource nodes are one-shot:
 * seeking, pitch changes, and loop edits recreate the source while keeping
 * the same AudioBuffer in memory.
 */

import { getToken } from "../api/client";

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export type XfaderCurve = "smooth" | "sharp" | "cut";

export function equalPower(x: number): { a: number; b: number } {
  const t = Math.min(1, Math.max(0, x));
  return { a: Math.cos(t * 0.5 * Math.PI), b: Math.sin(t * 0.5 * Math.PI) };
}

/** DJ xfader: smooth = constant-power mix, sharp = small center overlap, cut = both-on until the edges (scratch). */
export function xfaderGains(x: number, curve: XfaderCurve = "smooth"): { a: number; b: number } {
  const t = Math.min(1, Math.max(0, x));
  if (curve === "smooth") return equalPower(t);
  if (curve === "sharp") {
    const width = 0.22;
    const start = 0.5 - width / 2;
    const end = 0.5 + width / 2;
    if (t <= start) return { a: 1, b: 0 };
    if (t >= end) return { a: 0, b: 1 };
    return equalPower((t - start) / width);
  }
  const edge = 0.07;
  let a = 1;
  let b = 1;
  if (t <= edge) b = t / edge;
  else if (t >= 1 - edge) a = (1 - t) / edge;
  return { a, b };
}

export async function decodeUrl(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const headers: HeadersInit = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Audio fetch failed (${res.status})`);
  const buf = await res.arrayBuffer();
  return ctx.decodeAudioData(buf.slice(0));
}

/** Generate a short decaying impulse for convolution reverb. */
export function impulseResponse(ctx: BaseAudioContext, seconds = 1.8, decay = 2.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}

export function fillNoise(buffer: AudioBuffer, color: "white" | "pink" = "white"): void {
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === "pink") {
        b0 = 0.98 * b0 + 0.02 * white;
        data[i] = b0;
      } else {
        data[i] = white;
      }
    }
  }
}
