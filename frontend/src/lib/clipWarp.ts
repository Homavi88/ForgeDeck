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

/** Piecewise warp: source seconds ↔ clip-local bars. destBar 0 = clip start. */
export type WarpMarker = { srcSec: number; destBar: number };

export type WarpSegment = {
  destStartBar: number;
  destEndBar: number;
  srcStart: number;
  srcEnd: number;
};

export function normalizeWarpMarkers(
  markers: WarpMarker[] | undefined,
  lengthBars: number,
  durationSec: number,
): WarpMarker[] {
  const len = Math.max(0.125, lengthBars);
  const dur = Math.max(0.05, durationSec);
  const raw = (markers || [])
    .filter((m) => Number.isFinite(m.srcSec) && Number.isFinite(m.destBar))
    .map((m) => ({
      srcSec: Math.max(0, Math.min(dur, m.srcSec)),
      destBar: Math.max(0, Math.min(len, m.destBar)),
    }));
  raw.sort((a, b) => a.destBar - b.destBar || a.srcSec - b.srcSec);
  const out: WarpMarker[] = [];
  for (const m of raw) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(m.destBar - prev.destBar) < 0.001) {
      out[out.length - 1] = m;
      continue;
    }
    if (prev && m.srcSec < prev.srcSec) continue;
    out.push(m);
  }
  if (!out.length) return [];
  if (out[0].destBar > 0.001) out.unshift({ srcSec: 0, destBar: 0 });
  const last = out[out.length - 1];
  if (last.destBar < len - 0.001) out.push({ srcSec: dur, destBar: len });
  return out;
}

/** Identity warp from analysis onsets (or beats). Drag destBar to put a transient on the grid. */
export function seedWarpFromOnsets(
  onsets: number[] | undefined,
  beats: number[] | undefined,
  sourceBpm: number,
  durationSec: number,
  lengthBars: number,
  offsetSec = 0,
): WarpMarker[] {
  const hits = (onsets && onsets.length >= 2 ? onsets : beats || []).filter(
    (t) => t >= offsetSec + 0.02 && t < durationSec - 0.02,
  );
  const bpm = sourceBpm > 20 ? sourceBpm : 120;
  const barSec = (60 / bpm) * 4;
  const markers: WarpMarker[] = [{ srcSec: offsetSec, destBar: 0 }];
  for (const t of hits) {
    const destBar = (t - offsetSec) / barSec;
    if (destBar <= 0.04 || destBar >= lengthBars - 0.04) continue;
    markers.push({ srcSec: t, destBar });
  }
  markers.push({
    srcSec: Math.min(durationSec, offsetSec + lengthBars * barSec),
    destBar: lengthBars,
  });
  return normalizeWarpMarkers(markers, lengthBars, durationSec);
}

export function moveWarpMarker(
  markers: WarpMarker[],
  index: number,
  destBar: number,
  lengthBars: number,
  durationSec: number,
): WarpMarker[] {
  const next = markers.map((m, i) => (i === index ? { ...m, destBar } : { ...m }));
  const prev = next[index - 1];
  const after = next[index + 1];
  const lo = prev ? prev.destBar + 0.02 : 0;
  const hi = after ? after.destBar - 0.02 : lengthBars;
  next[index] = { ...next[index], destBar: Math.max(lo, Math.min(hi, destBar)) };
  return normalizeWarpMarkers(next, lengthBars, durationSec);
}

export function warpSegments(markers: WarpMarker[], lengthBars: number, durationSec: number): WarpSegment[] {
  const pts = normalizeWarpMarkers(markers, lengthBars, durationSec);
  const segs: WarpSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b.destBar - a.destBar < 0.01) continue;
    segs.push({
      destStartBar: a.destBar,
      destEndBar: b.destBar,
      srcStart: a.srcSec,
      srcEnd: Math.max(a.srcSec + 0.01, b.srcSec),
    });
  }
  return segs;
}

/** Source seconds at a clip-local bar, using markers or uniform BPM. */
export function srcSecAtDestBar(
  destBar: number,
  markers: WarpMarker[] | undefined,
  sourceBpm: number,
  offsetSec = 0,
): number {
  const pts = markers && markers.length >= 2 ? markers : null;
  if (!pts) {
    const bpm = sourceBpm > 20 ? sourceBpm : 120;
    return offsetSec + destBar * ((60 / bpm) * 4);
  }
  const sorted = [...pts].sort((a, b) => a.destBar - b.destBar);
  if (destBar <= sorted[0].destBar) return sorted[0].srcSec;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (destBar <= b.destBar) {
      const u = (destBar - a.destBar) / Math.max(0.0001, b.destBar - a.destBar);
      return a.srcSec + u * (b.srcSec - a.srcSec);
    }
  }
  return sorted[sorted.length - 1].srcSec;
}
