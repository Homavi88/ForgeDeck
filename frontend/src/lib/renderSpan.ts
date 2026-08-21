import { PAD_IDS } from "../audio-engine/DrumMachine";
import { arrangeIdForMix } from "./mix";
import type { DrumSteps, MidiNote, TimelineClip } from "../types";

export const MAX_RENDER_SEC = 8 * 60;
export const DEFAULT_LANE_BARS = 8;
export const MIN_MIX_SEC = 4;

export type RenderSpan = { startBar: number; lengthBars: number };

export function durationBars(durationSec: number, bpm: number): number {
  const b = bpm > 20 ? bpm : 120;
  const d = durationSec > 0.05 ? durationSec : 0.125;
  return Math.max(0.125, (d * b) / 60 / 4);
}

export function normalizeSpan(span: RenderSpan, maxBars = 512): RenderSpan {
  const startBar = Math.max(0, Number.isFinite(span.startBar) ? span.startBar : 0);
  const lengthBars = Math.max(0.125, Math.min(maxBars, Number.isFinite(span.lengthBars) ? span.lengthBars : DEFAULT_LANE_BARS));
  return { startBar, lengthBars };
}

/** Bars covering clips / notes / drums on one mixer channel (A, drums, synth, or prodLane). */
export function laneRenderSpan(
  mixId: string,
  clips: TimelineClip[],
  notes: MidiNote[],
  drumSteps: DrumSteps,
  opts?: { deckDurationSec?: number; bpm?: number },
): RenderSpan {
  const trackId = arrangeIdForMix(mixId);
  const mine = clips.filter((c) => c.trackId === trackId);
  let start = Infinity;
  let end = 0;
  for (const c of mine) {
    start = Math.min(start, c.startBar);
    end = Math.max(end, c.startBar + c.lengthBars);
  }
  if (mixId === "synth" && notes.length) {
    const loop = 16;
    const maxStep = Math.max(...notes.map((n) => n.startStep + n.length), 0);
    end = Math.max(end, Math.max(DEFAULT_LANE_BARS, Math.ceil(maxStep / loop)));
    start = Number.isFinite(start) ? start : 0;
  }
  if (mixId === "drums") {
    const has = PAD_IDS.some((id) => (drumSteps[id] || []).some((v) => v > 0));
    if (has) {
      start = Number.isFinite(start) ? start : 0;
      end = Math.max(end, DEFAULT_LANE_BARS);
    }
  }
  if ((mixId === "A" || mixId === "B") && opts?.deckDurationSec) {
    start = Number.isFinite(start) ? start : 0;
    end = Math.max(end, durationBars(opts.deckDurationSec, opts.bpm || 120));
  }
  if (!Number.isFinite(start) || end <= start) {
    return { startBar: 0, lengthBars: DEFAULT_LANE_BARS };
  }
  return normalizeSpan({ startBar: start, lengthBars: end - start });
}

/** Full-mix bounce window: decks, clips, notes, drums, automation. Starts at bar 0. */
export function mixRenderSpan(
  clips: TimelineClip[],
  notes: MidiNote[],
  drumSteps: DrumSteps,
  automation: Array<{ points: Array<{ time: number }> }>,
  opts?: { deckDurationsSec?: number[]; bpm?: number },
): RenderSpan {
  const bpm = opts?.bpm && opts.bpm > 20 ? opts.bpm : 120;
  const barSec = (60 / bpm) * 4;
  let seconds = MIN_MIX_SEC;
  for (const d of opts?.deckDurationsSec || []) {
    if (d > 0) seconds = Math.max(seconds, d);
  }
  for (const clip of clips) {
    seconds = Math.max(seconds, (clip.startBar + clip.lengthBars) * barSec);
  }
  for (const n of notes) {
    seconds = Math.max(seconds, ((n.startStep + n.length) / 16) * barSec);
  }
  for (const lane of automation) {
    for (const p of lane.points) seconds = Math.max(seconds, (p.time || 0) + 0.25);
  }
  const hasDrums = PAD_IDS.some((id) => (drumSteps[id] || []).some((v) => v > 0));
  if (hasDrums) seconds = Math.max(seconds, DEFAULT_LANE_BARS * barSec);
  seconds = Math.min(Math.max(seconds, MIN_MIX_SEC), MAX_RENDER_SEC);
  return normalizeSpan({ startBar: 0, lengthBars: seconds / barSec });
}
