/**
 * Warped clip playback shared by live Timeline/Session and offline bounce.
 * Tempo: BufferSource.playbackRate = projectBpm / sourceBpm.
 * Pitch: Rubber Band (same worklet as deck key lock). Fallback = playbackRate only.
 */
import { applyClipWarp, createKeyLockNode, type RubberBandWorklet } from "./rubberband";
import { clipTempoRate, keySemitoneDelta } from "../lib/clipWarp";

export type ClipWarpParams = {
  sourceBpm?: number | null;
  projectBpm: number;
  sourceKey?: string | null;
  projectKey?: string | null;
  keyFollow?: boolean | null;
  transpose?: number | null;
  gain?: number | null;
  reverse?: boolean | null;
  audioOffsetSec?: number | null;
};

export type ClipFade = {
  fadeInSec?: number;
  fadeOutSec?: number;
};

export type WarpedVoice = {
  source: AudioBufferSourceNode;
  rb: RubberBandWorklet | null;
  fade: GainNode | null;
  stop: (when?: number) => void;
};

export function clipWarpRate(p: ClipWarpParams): number {
  return clipTempoRate(p.sourceBpm ?? undefined, p.projectBpm);
}

export function clipWarpSemitones(p: ClipWarpParams): number {
  const extra = typeof p.transpose === "number" && Number.isFinite(p.transpose) ? p.transpose : 0;
  if (!p.keyFollow) return extra;
  return keySemitoneDelta(p.sourceKey ?? undefined, p.projectKey ?? undefined) + extra;
}

export async function connectWarpedSource(
  ctx: BaseAudioContext,
  src: AudioBufferSourceNode,
  dest: AudioNode,
  rate: number,
  pitchSemitones: number,
): Promise<RubberBandWorklet | null> {
  const r = Number.isFinite(rate) && rate > 0.05 ? rate : 1;
  src.playbackRate.value = r;
  const needWarp = Math.abs(r - 1) > 0.002 || Math.abs(pitchSemitones) > 0.05;
  if (!needWarp) {
    src.connect(dest);
    return null;
  }
  const rb = await createKeyLockNode(ctx);
  if (rb) {
    src.connect(rb);
    rb.connect(dest);
    applyClipWarp(rb, r, pitchSemitones);
    return rb;
  }
  src.playbackRate.value = r * Math.pow(2, pitchSemitones / 12);
  src.connect(dest);
  return null;
}

function scheduleFade(gain: GainNode, when: number, durationSec: number, fade: ClipFade | undefined, loop: boolean): void {
  const g = gain.gain;
  const dur = Math.max(0.02, durationSec);
  let fadeIn = Math.max(0, fade?.fadeInSec || 0);
  let fadeOut = loop ? 0 : Math.max(0, fade?.fadeOutSec || 0);
  if (fadeIn + fadeOut > dur) {
    const s = dur / (fadeIn + fadeOut);
    fadeIn *= s;
    fadeOut *= s;
  }
  g.cancelScheduledValues(when);
  if (fadeIn > 0.001) {
    g.setValueAtTime(0.0001, when);
    g.linearRampToValueAtTime(1, when + fadeIn);
  } else {
    g.setValueAtTime(1, when);
  }
  if (fadeOut > 0.001) {
    const outStart = when + dur - fadeOut;
    g.setValueAtTime(1, Math.max(when + fadeIn, outStart));
    g.linearRampToValueAtTime(0.0001, when + dur);
  }
}

export async function scheduleWarpedClip(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  dest: AudioNode,
  when: number,
  durationSec: number,
  params: ClipWarpParams,
  loop: boolean,
  fade?: ClipFade,
): Promise<WarpedVoice> {
  const src = ctx.createBufferSource();
  let bufferToPlay = buffer;
  if (params.reverse) {
    bufferToPlay = ctx.createBuffer(buffer.numberOfChannels, buffer.length, ctx.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const a = buffer.getChannelData(c);
      const b = bufferToPlay.getChannelData(c);
      for (let i = 0; i < a.length; i++) b[i] = a[a.length - 1 - i];
    }
  }
  src.buffer = bufferToPlay;
  const rate = clipWarpRate(params);
  const semis = clipWarpSemitones(params);
  if (loop) src.loop = true;
  const fadeGain = ctx.createGain();
  const clipGain = ctx.createGain();
  clipGain.gain.value = Math.max(0, Math.min(4, params.gain == null ? 1 : params.gain));
  fadeGain.connect(clipGain);
  clipGain.connect(dest);
  const skip = when < 0 ? -when : 0;
  const remaining = durationSec - skip;
  if (remaining <= 0.02) {
    return {
      source: src,
      rb: null,
      fade: fadeGain,
      stop: () => undefined,
    };
  }
  const t0 = Math.max(0, when);
  const fadeAdj = skip > 0.001 ? { fadeInSec: 0, fadeOutSec: fade?.fadeOutSec } : fade;
  scheduleFade(fadeGain, t0, remaining, fadeAdj, loop);
  const rb = await connectWarpedSource(ctx, src, fadeGain, rate, semis);
  const play = Math.max(0.02, remaining);
  const fileOffset = Math.max(0, params.audioOffsetSec || 0);
  const offset = Math.min(Math.max(0, skip * rate + fileOffset), Math.max(0, bufferToPlay.duration - 0.01));
  src.start(t0, offset);
  if (!loop && Number.isFinite(t0 + play)) {
    try {
      src.stop(t0 + play);
    } catch {
      /* offline may ignore */
    }
  }
  return {
    source: src,
    rb,
    fade: fadeGain,
    stop: (at?: number) => {
      try {
        src.stop(at);
      } catch {
        /* already stopped */
      }
      try {
        rb?.disconnect();
        rb?.close();
      } catch {
        /* ignore */
      }
      try {
        fadeGain.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
