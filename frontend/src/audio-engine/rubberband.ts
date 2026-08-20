/**
 * Rubber Band WASM key lock (CDJ master tempo).
 *
 * Pitch fader changes *tempo* via BufferSource.playbackRate. Rubber Band
 * pitch-shifts by 1/rate so the musical key stays put. WSOLA remains the
 * fallback if the worklet/WASM fails to load.
 *
 * rubberband-web is GPL-2.0-or-later (Rubber Band Library).
 */
import { createRubberBandNode } from "rubberband-web";

export const RUBBERBAND_PROCESSOR_URL = "/worklets/rubberband-processor.js";

export type RubberBandWorklet = AudioWorkletNode & {
  setPitch(pitch: number): void;
  setTempo(tempo: number): void;
  setHighQuality(enabled: boolean): void;
  close(): void;
};

const loaded = new WeakSet<BaseAudioContext>();

/** Inverse of the pitch-fader rate: +3.2% tempo keeps the original key. */
export function keyLockPitchScale(rate: number): number {
  const r = Number.isFinite(rate) && rate > 0.05 ? rate : 1;
  return 1 / r;
}

export async function warmupRubberBand(ctx: BaseAudioContext): Promise<boolean> {
  if (loaded.has(ctx)) return true;
  try {
    await ctx.audioWorklet.addModule(RUBBERBAND_PROCESSOR_URL);
    loaded.add(ctx);
    return true;
  } catch {
    return false;
  }
}

export async function createKeyLockNode(ctx: BaseAudioContext): Promise<RubberBandWorklet | null> {
  try {
    await warmupRubberBand(ctx);
    const node = (await createRubberBandNode(ctx, RUBBERBAND_PROCESSOR_URL)) as RubberBandWorklet;
    node.setHighQuality(true);
    node.setTempo(1);
    node.setPitch(1);
    return node;
  } catch {
    return null;
  }
}

export function applyKeyLock(node: RubberBandWorklet, rate: number): void {
  node.setTempo(1);
  node.setPitch(keyLockPitchScale(rate));
  node.setHighQuality(true);
}
