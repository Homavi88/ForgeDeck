import type { MidiNote } from "../types";
import { CHORD_STAMPS, type ChordStampId } from "./musicTheory";

export const PIANO_LOW = 24;
export const PIANO_HIGH = 96;
export const COL_W = 18;
export const ROW_H = 16;
export const KEY_W = 52;
export const SNAP_OPTIONS = [1, 2, 4] as const;

export function snapFloor(step: number, snap: number): number {
  return Math.floor(step / snap) * snap;
}

export function clampNote(n: MidiNote, loop: number): MidiNote {
  const start = Math.max(0, Math.min(loop - 1, n.startStep));
  const length = Math.max(1, Math.min(loop - start, n.length));
  const pitch = Math.max(PIANO_LOW, Math.min(PIANO_HIGH, n.pitch));
  const velocity = Math.max(0.05, Math.min(1, n.velocity));
  return { ...n, startStep: start, length, pitch, velocity };
}

export function noteAt(notes: MidiNote[], pitch: number, step: number): MidiNote | undefined {
  return notes.find((n) => n.pitch === pitch && step >= n.startStep && step < n.startStep + n.length);
}

export function hitResize(note: MidiNote, step: number): boolean {
  return step === note.startStep + note.length - 1 && note.length >= 1;
}

export function quantizeNotes(notes: MidiNote[], ids: Set<string>, snap: number, loop: number): MidiNote[] {
  return notes.map((n) => {
    if (!ids.has(n.id)) return n;
    return clampNote({ ...n, startStep: snapFloor(n.startStep, snap) }, loop);
  });
}

export function humanizeVelocity(notes: MidiNote[], ids: Set<string>, amount = 0.12): MidiNote[] {
  return notes.map((n) => {
    if (!ids.has(n.id)) return n;
    const jitter = (Math.random() * 2 - 1) * amount;
    return { ...n, velocity: Math.max(0.15, Math.min(1, n.velocity + jitter)) };
  });
}

export function shiftNotes(
  notes: MidiNote[],
  ids: Set<string>,
  dStep: number,
  dPitch: number,
  loop: number,
): MidiNote[] {
  return notes.map((n) => {
    if (!ids.has(n.id)) return n;
    return clampNote({ ...n, startStep: n.startStep + dStep, pitch: n.pitch + dPitch }, loop);
  });
}

export function duplicateNotes(notes: MidiNote[], ids: Set<string>, loop: number): MidiNote[] {
  const sel = notes.filter((n) => ids.has(n.id));
  if (!sel.length) return notes;
  const start = Math.min(...sel.map((n) => n.startStep));
  const end = Math.max(...sel.map((n) => n.startStep + n.length));
  const span = Math.max(1, end - start);
  const copies = sel
    .map((n) =>
      clampNote(
        { ...n, id: crypto.randomUUID(), startStep: n.startStep + span },
        loop,
      ),
    )
    .filter((n) => n.startStep + n.length <= loop && !sel.some((s) => s.startStep === n.startStep && s.pitch === n.pitch));
  return [...notes, ...copies];
}

export function stampChord(
  notes: MidiNote[],
  root: number,
  start: number,
  length: number,
  stamp: ChordStampId,
  loop: number,
): MidiNote[] {
  const spec = CHORD_STAMPS.find((c) => c.id === stamp);
  if (!spec) return notes;
  const next = notes.filter((n) => !(n.startStep === start && spec.intervals.includes(n.pitch - root)));
  for (const iv of spec.intervals) {
    next.push(
      clampNote(
        { id: crypto.randomUUID(), pitch: root + iv, startStep: start, length, velocity: 0.7 },
        loop,
      ),
    );
  }
  return next;
}

export function setVelocities(notes: MidiNote[], ids: Set<string>, velocity: number): MidiNote[] {
  const v = Math.max(0.05, Math.min(1, velocity));
  return notes.map((n) => (ids.has(n.id) ? { ...n, velocity: v } : n));
}

export function pasteNotes(notes: MidiNote[], clip: MidiNote[], atStep: number, loop: number): MidiNote[] {
  if (!clip.length) return notes;
  const origin = Math.min(...clip.map((n) => n.startStep));
  const copies = clip.map((n) =>
    clampNote({ ...n, id: crypto.randomUUID(), startStep: n.startStep - origin + atStep }, loop),
  );
  return [...notes, ...copies];
}

export function marqueeIds(
  notes: MidiNote[],
  pitch0: number,
  pitch1: number,
  step0: number,
  step1: number,
): string[] {
  const pLo = Math.min(pitch0, pitch1);
  const pHi = Math.max(pitch0, pitch1);
  const sLo = Math.min(step0, step1);
  const sHi = Math.max(step0, step1);
  return notes
    .filter((n) => n.pitch >= pLo && n.pitch <= pHi && n.startStep + n.length > sLo && n.startStep <= sHi)
    .map((n) => n.id);
}

export function rotateRow(values: number[], length: number, dir: 1 | -1): number[] {
  const head = values.slice(0, length);
  const tail = values.slice(length);
  if (!head.length) return values;
  const rotated = dir === 1 ? [head[head.length - 1], ...head.slice(0, -1)] : [...head.slice(1), head[0]];
  return [...rotated, ...tail];
}

export type ArpMode = "up" | "down" | "upDown" | "random";

export const ARP_MODES: ArpMode[] = ["up", "down", "upDown", "random"];

function arpSequence(pitches: number[], mode: ArpMode): number[] {
  if (!pitches.length) return [];
  if (mode === "down") return [...pitches].reverse();
  if (mode === "upDown" && pitches.length > 1) return [...pitches, ...pitches.slice(1, -1).reverse()];
  return pitches;
}

export function arpeggiate(
  notes: MidiNote[],
  ids: Set<string>,
  mode: ArpMode,
  snap: number,
  octaves: number,
  loop: number,
): MidiNote[] {
  const sel = notes.filter((n) => ids.has(n.id));
  if (!sel.length) return notes;
  const start = Math.min(...sel.map((n) => n.startStep));
  const end = Math.max(...sel.map((n) => n.startStep + n.length));
  let pitches = [...new Set(sel.map((n) => n.pitch))].sort((a, b) => a - b);
  if (octaves > 1) {
    for (const p of [...pitches]) {
      const up = p + 12;
      if (up <= PIANO_HIGH && !pitches.includes(up)) pitches.push(up);
    }
    pitches.sort((a, b) => a - b);
  }
  const seq = arpSequence(pitches, mode);
  if (!seq.length) return notes;
  const vel = sel.reduce((s, n) => s + n.velocity, 0) / sel.length;
  const rest = notes.filter((n) => !ids.has(n.id));
  const added: MidiNote[] = [];
  let i = 0;
  const step = Math.max(1, snap);
  for (let t = start; t < Math.min(end, loop); t += step) {
    const pitch = mode === "random" ? pitches[Math.floor(Math.random() * pitches.length)] : seq[i % seq.length];
    i += 1;
    added.push(
      clampNote({ id: crypto.randomUUID(), pitch, startStep: t, length: step, velocity: vel }, loop),
    );
  }
  return [...rest, ...added];
}

/** Stagger a chord: `up` = low→high, `down` = high→low (guitar-style). */
export function strumNotes(notes: MidiNote[], ids: Set<string>, delay: number, up: boolean, loop: number): MidiNote[] {
  const sel = notes
    .filter((n) => ids.has(n.id))
    .sort((a, b) => (up ? a.pitch - b.pitch : b.pitch - a.pitch));
  if (sel.length < 2) return notes;
  const origin = Math.min(...sel.map((n) => n.startStep));
  const gap = Math.max(1, delay);
  const moved = new Map<string, MidiNote>();
  sel.forEach((n, i) => {
    moved.set(n.id, clampNote({ ...n, startStep: origin + i * gap }, loop));
  });
  return notes.map((n) => moved.get(n.id) ?? n);
}
