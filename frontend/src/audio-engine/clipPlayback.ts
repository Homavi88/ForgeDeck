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
};

export type WarpedVoice = {
  source: AudioBufferSourceNode;
  rb: RubberBandWorklet | null;
  stop: (when?: number) => void;
};

export function clipWarpRate(p: ClipWarpParams): number {
  return clipTempoRate(p.sourceBpm ?? undefined, p.projectBpm);
}

export function clipWarpSemitones(p: ClipWarpParams): number {
  if (!p.keyFollow) return 0;
  return keySemitoneDelta(p.sourceKey ?? undefined, p.projectKey ?? undefined);
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

export async function scheduleWarpedClip(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  dest: AudioNode,
  when: number,
  durationSec: number,
  params: ClipWarpParams,
  loop: boolean,
): Promise<WarpedVoice> {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const rate = clipWarpRate(params);
  const semis = clipWarpSemitones(params);
  if (loop) src.loop = true;
  const rb = await connectWarpedSource(ctx, src, dest, rate, semis);
  const play = Math.max(0.02, durationSec);
  src.start(when);
  if (!loop && Number.isFinite(when + play)) {
    try {
      src.stop(when + play);
    } catch {
      /* offline may ignore */
    }
  }
  return {
    source: src,
    rb,
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
    },
  };
}
