/**
 * Warped clip playback shared by live Timeline/Session and offline bounce.
 * Tempo: BufferSource.playbackRate = projectBpm / sourceBpm.
 * Pitch: Rubber Band (same worklet as deck key lock). Fallback = playbackRate only.
 */
import { applyClipWarp, createKeyLockNode, type RubberBandWorklet } from "./rubberband";
import { clipTempoRate, keySemitoneDelta, warpSegments, type WarpMarker } from "../lib/clipWarp";

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
  warpMarkers?: WarpMarker[] | null;
  lengthBars?: number | null;
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
  const fileOffset = Math.max(0, params.audioOffsetSec || 0);
  const markers =
    params.warpMarkers &&
    params.warpMarkers.length >= 2 &&
    (params.lengthBars || 0) > 0.1 &&
    !loop &&
    !params.reverse
      ? params.warpMarkers
      : null;
  if (markers) {
    return scheduleMarkedClip(ctx, bufferToPlay, fadeGain, clipGain, t0, remaining, skip, durationSec, params, fadeAdj, markers);
  }
  const rb = await connectWarpedSource(ctx, src, fadeGain, rate, semis);
  const play = Math.max(0.02, remaining);
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

async function scheduleMarkedClip(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  fadeGain: GainNode,
  clipGain: GainNode,
  t0: number,
  remaining: number,
  skip: number,
  durationSec: number,
  params: ClipWarpParams,
  _fade: ClipFade | undefined,
  markers: WarpMarker[],
): Promise<WarpedVoice> {
  const lengthBars = Math.max(0.125, params.lengthBars || 1);
  const barSec = durationSec / lengthBars;
  const semis = clipWarpSemitones(params);
  const segs = warpSegments(markers, lengthBars, buffer.duration);
  const sources: AudioBufferSourceNode[] = [];
  const rbs: RubberBandWorklet[] = [];
  const dummy = ctx.createBufferSource();
  dummy.buffer = buffer;
  for (const seg of segs) {
    const destStart = seg.destStartBar * barSec;
    const destEnd = seg.destEndBar * barSec;
    if (destEnd <= skip) continue;
    const playStartDest = Math.max(destStart, skip);
    const destLen = destEnd - destStart;
    if (destLen < 0.02) continue;
    const u = (playStartDest - destStart) / destLen;
    const srcStart = seg.srcStart + u * (seg.srcEnd - seg.srcStart);
    const playLen = Math.min(remaining, destEnd - playStartDest);
    if (playLen < 0.02) continue;
    const srcLen = (playLen / destLen) * (seg.srcEnd - seg.srcStart);
    const rate = srcLen / playLen;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rb = await connectWarpedSource(ctx, src, fadeGain, rate, semis);
    const when = t0 + (playStartDest - skip);
    const offset = Math.min(Math.max(0, srcStart), Math.max(0, buffer.duration - 0.01));
    src.start(when, offset);
    try {
      src.stop(when + playLen);
    } catch {
      /* offline */
    }
    sources.push(src);
    if (rb) rbs.push(rb);
  }
  return {
    source: sources[0] || dummy,
    rb: rbs[0] || null,
    fade: fadeGain,
    stop: (at?: number) => {
      for (const s of sources) {
        try {
          s.stop(at);
        } catch {
          /* already stopped */
        }
      }
      for (const rb of rbs) {
        try {
          rb.disconnect();
          rb.close();
        } catch {
          /* ignore */
        }
      }
      try {
        fadeGain.disconnect();
        clipGain.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
