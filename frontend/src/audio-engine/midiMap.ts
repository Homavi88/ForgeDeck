import { PAD_IDS } from "./DrumMachine";
import type { Deck } from "./Deck";
import type { Mixer } from "./Mixer";
import type { DrumMachine } from "./DrumMachine";

export type MidiBindings = {
  cc: Record<string, string>;
  notes: Record<string, string>;
};

function deckTargets(): string[] {
  const out: string[] = [];
  for (const side of ["A", "B"] as const) {
    out.push(`${side}.play`, `${side}.cue`, `${side}.pfl`, `${side}.keylock`, `${side}.loop.off`);
    for (const n of [1, 2, 3, 4]) out.push(`${side}.hotcue.${n}`);
    for (const n of [1, 2, 4, 8, 16]) out.push(`${side}.loop.${n}`);
  }
  return out;
}

export const MIDI_TARGETS = [
  "master.volume",
  "crossfader",
  "A.volume",
  "B.volume",
  "A.pan",
  "B.pan",
  "A.filter",
  "B.filter",
  "A.eq.low",
  "B.eq.low",
  ...deckTargets(),
  ...PAD_IDS.map((id) => `pad:${id}`),
] as const;

/** Pioneer-ish DDJ-400-style notes (ch1=A, ch2=B). Not an official dump. */
function pioneerNoteDefaults(): Record<string, string> {
  const notes: Record<string, string> = Object.fromEntries(PAD_IDS.map((id, i) => [String(36 + i), `pad:${id}`]));
  for (const [ch, side] of [
    [1, "A"],
    [2, "B"],
  ] as const) {
    for (let i = 0; i < 4; i++) notes[`${ch}:${i}`] = `${side}.hotcue.${i + 1}`;
    notes[`${ch}:11`] = `${side}.play`;
    notes[`${ch}:12`] = `${side}.cue`;
    notes[`${ch}:16`] = `${side}.loop.4`;
    notes[`${ch}:18`] = `${side}.loop.off`;
    notes[`${ch}:84`] = `${side}.pfl`;
    notes[`${ch}:8`] = `${side}.keylock`;
  }
  return notes;
}

/** Pioneer-ish DDJ/CDJ-style CC map used when no custom bindings are stored. */
export const DEFAULT_MIDI: MidiBindings = {
  cc: {
    "7": "master.volume",
    "8": "crossfader",
    "10": "A.pan",
    "11": "B.pan",
    "13": "crossfader",
    "16": "A.volume",
    "17": "B.volume",
    "19": "A.eq.low",
    "20": "A.filter",
    "21": "B.filter",
    "23": "B.eq.low",
  },
  notes: pioneerNoteDefaults(),
};

const STORAGE_KEY = "pf_midi_map";

export function loadMidiBindings(): MidiBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_MIDI);
    const parsed = JSON.parse(raw) as MidiBindings;
    return {
      cc: { ...DEFAULT_MIDI.cc, ...(parsed.cc || {}) },
      notes: { ...DEFAULT_MIDI.notes, ...(parsed.notes || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_MIDI);
  }
}

export function persistMidiBindings(bindings: MidiBindings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

export function midiBindingKey(channel: number, number: number): string {
  return `${channel}:${number}`;
}

/** Prefer `channel:number` (1:1 per deck); fall back to the bare number from older maps. */
export function lookupMidiTarget(
  bindings: MidiBindings,
  kind: "cc" | "note",
  channel: number,
  number: number,
): string | undefined {
  const table = kind === "cc" ? bindings.cc : bindings.notes;
  return table[midiBindingKey(channel, number)] || table[String(number)];
}

export type MidiHost = {
  mixer: Mixer;
  drums: DrumMachine;
  ctx: AudioContext;
  decks: { A: Deck; B: Deck };
  transport: { bpm: number };
  onPflChange?: (side: "A" | "B", on: boolean) => void;
  onKeyLockChange?: (side: "A" | "B", on: boolean) => void;
};

export function applyMidiTarget(eng: MidiHost, target: string, value: number, noteOn = true): void {
  const v = Math.max(0, Math.min(1, value));
  const mix = eng.mixer;
  if (target === "master.volume") mix.master.setVolume(v);
  else if (target === "crossfader") mix.setCrossfader(v);
  else if (target === "A.volume") mix.channels.A.setVolume(v);
  else if (target === "B.volume") mix.channels.B.setVolume(v);
  else if (target === "A.pan") mix.channels.A.setPan(v * 2 - 1);
  else if (target === "B.pan") mix.channels.B.setPan(v * 2 - 1);
  else if (target === "A.filter") mix.channels.A.filter.setKnob(v * 2 - 1);
  else if (target === "B.filter") mix.channels.B.filter.setKnob(v * 2 - 1);
  else if (target === "A.eq.low") {
    const eq = mix.channels.A.eq;
    eq.set((v - 0.5) * 24, eq.mid.gain.value, eq.high.gain.value);
  } else if (target === "B.eq.low") {
    const eq = mix.channels.B.eq;
    eq.set((v - 0.5) * 24, eq.mid.gain.value, eq.high.gain.value);
  } else if (target.startsWith("pad:") && noteOn && v > 0) {
    const raw = target.slice(4);
    const idx = Number(raw);
    const id = Number.isInteger(idx) && PAD_IDS[idx] ? PAD_IDS[idx] : raw;
    eng.drums.trigger(id, eng.ctx.currentTime, v);
  } else if (noteOn && v > 0) {
    applyDeckNote(eng, target);
  }
}

function applyDeckNote(eng: MidiHost, target: string): void {
  const play = /^(A|B)\.play$/.exec(target);
  if (play) {
    eng.decks[play[1] as "A" | "B"].toggle();
    return;
  }
  const cue = /^(A|B)\.cue$/.exec(target);
  if (cue) {
    eng.decks[cue[1] as "A" | "B"].cuePress();
    return;
  }
  const pfl = /^(A|B)\.pfl$/.exec(target);
  if (pfl) {
    const side = pfl[1] as "A" | "B";
    const ch = eng.mixer.channels[side];
    const on = (ch?.pflOut.gain.value ?? 0) < 0.5;
    eng.mixer.setPfl(side, on);
    eng.onPflChange?.(side, on);
    return;
  }
  const key = /^(A|B)\.keylock$/.exec(target);
  if (key) {
    const side = key[1] as "A" | "B";
    const next = !eng.decks[side].keyLock;
    eng.decks[side].setKeyLock(next);
    eng.onKeyLockChange?.(side, next);
    return;
  }
  const hot = /^(A|B)\.hotcue\.([1-4])$/.exec(target);
  if (hot) {
    eng.decks[hot[1] as "A" | "B"].jumpHotcue(Number(hot[2]));
    return;
  }
  const loopOff = /^(A|B)\.loop\.off$/.exec(target);
  if (loopOff) {
    eng.decks[loopOff[1] as "A" | "B"].clearLoop();
    return;
  }
  const loop = /^(A|B)\.loop\.(1|2|4|8|16)$/.exec(target);
  if (loop) {
    eng.decks[loop[1] as "A" | "B"].loopBars(Number(loop[2]), eng.transport.bpm);
  }
}
