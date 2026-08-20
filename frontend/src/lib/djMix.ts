/** Beat-phase, gain-match and mix helpers for DJ decks. Audio stays in the engine. */

export type BeatGridInput = {
  position: number;
  bpm: number;
  beats: number[];
};

export type LoudnessInput = {
  loudness_db?: number | null;
  loudness_rms?: number | null;
  peak?: number | null;
};

export function beatPhase(pos: number, beats: number[], bpm: number): { phase: number; beatDur: number } {
  const bpmSafe = Math.max(1, bpm);
  if (beats.length >= 2) {
    let i = 0;
    while (i + 1 < beats.length && beats[i + 1] <= pos) i++;
    const start = beats[i];
    const end = beats[i + 1] ?? start + 60 / bpmSafe;
    const dur = Math.max(1e-4, end - start);
    let phase = (pos - start) / dur;
    phase = ((phase % 1) + 1) % 1;
    return { phase, beatDur: dur };
  }
  const beatDur = 60 / bpmSafe;
  const phase = ((pos / beatDur) % 1 + 1) % 1;
  return { phase, beatDur };
}

export function wrapBeatOffset(beats: number): number {
  let x = beats % 1;
  if (x > 0.5) x -= 1;
  if (x < -0.5) x += 1;
  return x;
}

/** How far B is off A, in beats (−0.5…0.5) and milliseconds of A's current beat. */
export function beatOffset(a: BeatGridInput, b: BeatGridInput): { ms: number; beats: number } {
  const pa = beatPhase(a.position, a.beats, a.bpm);
  const pb = beatPhase(b.position, b.beats, b.bpm);
  const beats = wrapBeatOffset(pb.phase - pa.phase);
  return { ms: beats * pa.beatDur * 1000, beats };
}

/** Buffer time to seek the slave so its beat phase matches the master. */
export function phaseAlignSeek(slave: BeatGridInput, master: BeatGridInput): number {
  const pm = beatPhase(master.position, master.beats, master.bpm);
  const ps = beatPhase(slave.position, slave.beats, slave.bpm);
  const d = wrapBeatOffset(pm.phase - ps.phase);
  return Math.max(0, slave.position + d * ps.beatDur);
}

function loudnessOf(a: LoudnessInput): number | null {
  if (typeof a.loudness_db === "number" && Number.isFinite(a.loudness_db)) return a.loudness_db;
  if (typeof a.loudness_rms === "number" && a.loudness_rms > 0) return 20 * Math.log10(a.loudness_rms);
  return null;
}

/** Channel trim (dB) so `self` matches `other`. Clamped to ±clampDb and peak headroom. */
export function matchGainDb(
  self: LoudnessInput,
  other: LoudnessInput,
  clampDb = 12,
): { db: number; clamped: boolean } | null {
  const selfLu = loudnessOf(self);
  const otherLu = loudnessOf(other);
  if (selfLu == null || otherLu == null) return null;
  let db = otherLu - selfLu;
  const peak = typeof self.peak === "number" && self.peak > 0 ? self.peak : 0.9;
  const headroom = 20 * Math.log10(0.99 / Math.max(1e-6, peak));
  if (db > headroom) db = headroom;
  const clamped = db > clampDb || db < -clampDb;
  db = Math.max(-clampDb, Math.min(clampDb, db));
  return { db, clamped };
}
