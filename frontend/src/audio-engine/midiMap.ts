import { PAD_IDS } from "./DrumMachine";
import type { Mixer } from "./Mixer";
import type { DrumMachine } from "./DrumMachine";

export type MidiBindings = {
  cc: Record<string, string>;
  notes: Record<string, string>;
};

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
  ...PAD_IDS.map((id) => `pad:${id}`),
] as const;

export const DEFAULT_MIDI: MidiBindings = {
  cc: {
    "7": "master.volume",
    "10": "A.pan",
    "13": "crossfader",
    "16": "A.volume",
    "17": "B.volume",
    "20": "A.filter",
    "21": "B.filter",
  },
  notes: Object.fromEntries(PAD_IDS.map((id, i) => [String(36 + i), `pad:${id}`])),
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

export function applyMidiTarget(
  eng: { mixer: Mixer; drums: DrumMachine; ctx: AudioContext },
  target: string,
  value: number,
  noteOn = true,
): void {
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
  }
}
