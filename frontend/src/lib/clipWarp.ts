import { parseKey } from "./musicTheory";

/** Project tempo vs clip/file analysis BPM. 1 = already in time. */
export function clipTempoRate(sourceBpm: number | undefined, projectBpm: number): number {
  const src = sourceBpm && sourceBpm > 20 ? sourceBpm : projectBpm || 120;
  const dst = projectBpm && projectBpm > 20 ? projectBpm : src;
  const rate = dst / src;
  return Number.isFinite(rate) && rate > 0.05 ? Math.min(4, Math.max(0.25, rate)) : 1;
}

/** Shortest signed semitone delta between two named keys (tonic only). */
export function keySemitoneDelta(sourceKey: string | undefined, projectKey: string | undefined): number {
  if (!sourceKey || !projectKey) return 0;
  const a = parseKey(sourceKey).tonic;
  const b = parseKey(projectKey).tonic;
  let d = b - a;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

/** Clip length in bars from file duration + source BPM (Ableton-style). */
export function loopLengthBars(durationSec: number | undefined, bpm: number | undefined): number {
  const b = bpm && bpm > 20 ? bpm : 120;
  const d = durationSec && durationSec > 0.05 ? durationSec : 8;
  const bars = (d * b) / 60 / 4;
  return Math.max(1, Math.min(64, Math.round(bars) || 4));
}

export function fmtMixTime(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
